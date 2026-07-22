/* Golden Moms - Tesoreria redesign local-only
   Loaded after app.js. RPC-first, legacy read fallback. */
(function(){
  'use strict';

  const GT = {
    view: 'inicio',
    engineReady: null,
    engineError: '',
    snapshot: null,
    players: [],
    playerMap: new Map(),
    movementFilter: 'all',
    sessionToken: '',
    sessionExpiresAt: 0,
    rpcClient: null
  };

  const incomeTypes = [
    ['monthly_fee','Cuota mensual'], ['cdp','Aporte CDP'], ['prize','Premio monetario'], ['other','Otro ingreso']
  ];
  const activityTypes = [
    ['campeonato','Campeonato'], ['celebracion','Celebracion'], ['tercer_tiempo','Tercer tiempo'], ['cumpleanos','Cumpleanos'], ['otro','Otro']
  ];
  const tabs = [
    ['inicio','Inicio'], ['ingresos','Ingresos'], ['actividades','Actividades'], ['config','Configuracion']
  ];

  function user(){ try { return currentUser || null; } catch(e){ return null; } }
  function roleOf(u){ return String(u && u.role || '').toLowerCase(); }
  function isTreasuryRole(u){ return ['admin','capitana','tesorera'].includes(roleOf(u || user())); }
  function canConfigure(u){ return ['admin','tesorera'].includes(roleOf(u || user())); }
  function h(v){ return (typeof escapeHTML === 'function' ? escapeHTML(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))); }
  function n(v){ return Math.round(Number(v)||0); }
  function money(v){ return '$' + n(v).toLocaleString('es-CL'); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function year(){ return new Date().getFullYear(); }
  function month(){ return new Date().getMonth()+1; }
  function toast(msg){ if(typeof showToast === 'function') showToast(msg, 4200); else alert(msg); }
  function opKey(kind){ const c = typeof crypto !== 'undefined' ? crypto : null; return 'gm-' + kind + '-' + (c && c.randomUUID ? c.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)); }
  function missingMsg(){ return 'Motor financiero pendiente: ejecuta y valida los SQL 001-005 en Supabase. Esta accion esta preparada como RPC y no se ejecuta en modo legacy.'; }
  function isMissing(error){ const m=String((error&&error.message)||'').toLowerCase(); return error && (error.code === '42P01' || m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find')); }
  function player(id){ return GT.playerMap.get(String(id)); }
  function pname(p){ return (p && (p.apodo || p.nombre)) || 'Sin nombre'; }
  function pnameById(id){ return pname(player(id)); }
  const TREAS_RPC_KEY = 'gm_treasury_rpc_session';
  function loadTreasuryRpcSession(){
    try{
      const raw=sessionStorage.getItem(TREAS_RPC_KEY); if(!raw) return false;
      const parsed=JSON.parse(raw); const exp=Date.parse(parsed.expires_at||'') || Number(parsed.expiresAt||0);
      if(!parsed.session_token || !exp || exp<=Date.now()){ sessionStorage.removeItem(TREAS_RPC_KEY); GT.sessionToken=''; GT.sessionExpiresAt=0; GT.rpcClient=null; return false; }
      GT.sessionToken=parsed.session_token; GT.sessionExpiresAt=exp; return true;
    }catch(e){ GT.sessionToken=''; GT.sessionExpiresAt=0; GT.rpcClient=null; return false; }
  }
  function saveTreasuryRpcSession(data){
    const token=data&&data.session_token; const exp=data&&data.expires_at; if(!token||!exp) return false;
    GT.sessionToken=token; GT.sessionExpiresAt=Date.parse(exp)||0; GT.rpcClient=null;
    try{ sessionStorage.setItem(TREAS_RPC_KEY, JSON.stringify({session_token:token,expires_at:exp})); }catch(e){}
    return true;
  }
  function clearTreasuryRpcSession(){ GT.sessionToken=''; GT.sessionExpiresAt=0; GT.rpcClient=null; try{ sessionStorage.removeItem(TREAS_RPC_KEY); }catch(e){} }
  function hasTreasuryRpcSession(){ return loadTreasuryRpcSession(); }
  function rpcClient(){
    if(!hasTreasuryRpcSession()) return supa;
    if(GT.rpcClient) return GT.rpcClient;
    try{
      const factory = (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) ? window.supabase.createClient : (typeof createClient === 'function' ? createClient : null);
      if(!factory || typeof SUPA_CONFIG === 'undefined') return supa;
      GT.rpcClient = factory(SUPA_CONFIG.url, SUPA_CONFIG.key, { global:{ headers:{ 'x-gm-treasury-session': GT.sessionToken } } });
      return GT.rpcClient;
    }catch(e){ return supa; }
  }

  async function select(table, cols, opts){
    try{
      if(!supa || !IS_CONNECTED) return { data:[], error:new Error('Sin conexion') };
      let q = rpcClient().from(table).select(cols || '*');
      (opts && opts.eq || []).forEach(x => { q = q.eq(x[0], x[1]); });
      (opts && opts.order || []).forEach(x => { q = q.order(x[0], { ascending: !!x[1] }); });
      if(opts && opts.limit) q = q.limit(opts.limit);
      const r = await q;
      return { data:r.data || [], error:r.error || null };
    } catch(e){ return { data:[], error:e }; }
  }

  async function detectEngine(force){
    if(GT.engineReady !== null && !force) return GT.engineReady;
    GT.engineError = '';
    if(!supa || !IS_CONNECTED){ GT.engineReady=false; GT.engineError='Sin conexion'; return false; }
    const r = await rpcClient().from('treasury_movements').select('id').limit(1);
    if(r.error){ GT.engineReady=false; GT.engineError = isMissing(r.error) ? 'Tablas nuevas no aplicadas' : (r.error.message || 'No se pudo leer Tesoreria'); return false; }
    GT.engineReady=true; return true;
  }

  async function loadPlayers(){
    const r = await select('players','id,apodo,nombre,celular,equipos,estado,numero_camiseta,rol,email',{ order:[['apodo',true]] });
    GT.players = r.data || [];
    GT.playerMap = new Map(GT.players.map(p => [String(p.id), p]));
  }

  function signed(m){ return (m.direction === 'in' ? 1 : -1) * n(m.amount); }
  function availableBalance(movements){ return (movements||[]).filter(m => (m.status||'posted') !== 'reversed').filter(m => (m.availability_class||'team_fund') === 'team_fund').reduce((s,m)=>s+signed(m),0); }
  function pendingPlayers(monthlyFees, debts){ const ids=new Set(); (monthlyFees||[]).filter(f=>f.status==='pending').forEach(f=>ids.add(String(f.player_id))); (debts||[]).filter(d=>d.status==='pending').forEach(d=>ids.add(String(d.player_id))); return ids; }
  function activeSetting(settings){ return (settings||[]).find(s => Number(s.year)===year() && s.is_active) || (settings||[]).find(s=>s.is_active) || (settings||[])[0] || {}; }
  function dtPending(settings, monthlyFees, links){ const linked=new Set((links||[]).map(x=>String(x.monthly_fee_id))); const rows=(monthlyFees||[]).filter(f=>f.status==='paid' && !linked.has(String(f.id))); const cfg=activeSetting(settings); return { count:rows.length, unit:n(cfg.dt_amount || rows[0]&&rows[0].dt_amount), amount:rows.reduce((s,f)=>s+n(f.dt_amount || cfg.dt_amount),0) }; }
  function personalAdvances(activities, debts){
    const map = new Map();
    (activities||[]).filter(a=>a.payer_player_id).forEach(a=>{
      const payer=String(a.payer_player_id); const ds=(debts||[]).filter(d=>String(d.activity_id)===String(a.id));
      const own=ds.filter(d=>String(d.player_id)===payer).reduce((s,d)=>s+n(d.assigned_amount),0);
      const original=Math.max(n(a.total_cost)-n(a.team_contribution)-own,0);
      const recovered=ds.filter(d=>String(d.beneficiary_player_id||payer)===payer && d.status==='paid').reduce((s,d)=>s+n(d.assigned_amount),0);
      const pending=Math.max(original-recovered,0); if(!original && !pending) return;
      const cur=map.get(payer)||{ player_id:payer, original_amount:0, recovered_amount:0, pending_amount:0, items:[] };
      cur.original_amount+=original; cur.recovered_amount+=recovered; cur.pending_amount+=pending; cur.items.push({ activity:a, original_amount:original, recovered_amount:recovered, pending_amount:pending }); map.set(payer,cur);
    });
    return Array.from(map.values()).filter(x=>x.pending_amount>0);
  }

  async function loadNew(){
    await loadPlayers();
    const all = await Promise.all([
      select('treasury_settings','*',{order:[['year',false]]}), select('treasury_income','*',{order:[['created_at',false]]}),
      select('monthly_fees','*',{order:[['year',false],['month',false]]}), select('player_credits','*',{order:[['created_at',true]]}),
      select('treasury_activities','*',{order:[['created_at',false]]}), select('activity_debts','*',{order:[['created_at',false]]}),
      select('payments','*',{order:[['created_at',false]]}), select('payment_allocations','*',{order:[['created_at',false]]}),
      select('treasury_movements','*',{order:[['effective_date',false]], limit:200}), select('dt_payments','*',{order:[['created_at',false]]}),
      select('dt_payment_fees','*',{order:[['created_at',false]]}), select('treasury_audit_log','*',{order:[['created_at',false]], limit:80})
    ]);
    const s = { mode:'new', settings:all[0].data, income:all[1].data, monthlyFees:all[2].data, credits:all[3].data, activities:all[4].data, debts:all[5].data, payments:all[6].data, allocations:all[7].data, movements:all[8].data, dtPayments:all[9].data, dtPaymentFees:all[10].data, audit:all[11].data };
    s.availableBalance=availableBalance(s.movements); s.pendingIncomeAmount=s.income.filter(i=>i.status==='pending').reduce((x,i)=>x+n(i.amount),0); s.pendingIncomeCount=s.income.filter(i=>i.status==='pending').length; s.personalAdvances=personalAdvances(s.activities,s.debts); s.pendingPlayers=pendingPlayers(s.monthlyFees,s.debts); s.dtPending=dtPending(s.settings,s.monthlyFees,s.dtPaymentFees);
    GT.snapshot=s; return s;
  }

  async function loadLegacy(){
    await loadPlayers();
    const all = await Promise.all([select('fees','*',{order:[['created_at',false]]}), select('fee_payments','*'), select('expenses','*',{order:[['created_at',false]]}), select('expense_payments','*'), select('treas_events','*',{order:[['created_at',false]]}), select('treas_event_payments','*')]);
    const fees=all[0].data, fps=all[1].data, exps=all[2].data, eps=all[3].data, tes=all[4].data, tps=all[5].data;
    const feeMap=new Map(fees.map(f=>[String(f.id),f])); const expMap=new Map(exps.map(e=>[String(e.id),e])); const teMap=new Map(tes.map(e=>[String(e.id),e]));
    let income=0, pending=0; const ids=new Set(); const moves=[];
    fps.forEach(p=>{ const f=feeMap.get(String(p.fee_id)); const a=n(p.amount==null?f&&f.amount:p.amount); if(p.paid){ income+=a; moves.push({ concept:f&&f.title||'Cuota legacy', amount:a, direction:'in', movement_type:'legacy_fee_payment', effective_date:p.paid_at||f&&f.created_at, status:'posted', availability_class:'team_fund' }); } else { pending+=a; if(p.player_id) ids.add(String(p.player_id)); } });
    eps.forEach(p=>{ const e=expMap.get(String(p.expense_id)); const a=n(p.amount); if(p.paid){ income+=a; moves.push({ concept:e&&e.title||'Cobro egreso legacy', amount:a, direction:'in', movement_type:'legacy_expense_payment', effective_date:p.paid_at||e&&e.created_at, status:'posted', availability_class:'team_fund' }); } else { pending+=a; if(p.player_id) ids.add(String(p.player_id)); } });
    tps.forEach(p=>{ const e=teMap.get(String(p.treas_event_id)); const a=n(p.amount==null?e&&e.amount:p.amount); if(p.paid){ income+=a; moves.push({ concept:e&&e.title||'Evento legacy', amount:a, direction:'in', movement_type:'legacy_treas_event_payment', effective_date:p.paid_at||e&&e.created_at, status:'posted', availability_class:'team_fund' }); } else { pending+=a; if(p.player_id) ids.add(String(p.player_id)); } });
    const expenseOut=exps.reduce((s,e)=>s+n(e.total_amount),0); exps.forEach(e=>moves.push({ concept:e.title||'Egreso legacy', amount:n(e.total_amount), direction:'out', movement_type:'legacy_expense', effective_date:e.date||e.created_at, status:'posted', availability_class:'team_fund' }));
    const adv=fees.reduce((s,f)=>s+n(f.advance_credit),0);
    const s={ mode:'legacy', legacy:{fees,feePays:fps,expenses:exps,expPays:eps,treasEvents:tes,treasEventPays:tps}, settings:[], income:[], monthlyFees:[], credits:[], activities:[], debts:[], movements:moves.sort((a,b)=>String(b.effective_date||'').localeCompare(String(a.effective_date||''))).slice(0,80), audit:[], availableBalance:income-expenseOut, pendingLegacyAmount:pending, pendingIncomeAmount:0, pendingIncomeCount:0, pendingPlayers:ids, personalAdvances:adv?[{player_id:null,original_amount:adv,recovered_amount:0,pending_amount:adv,items:[]}]:[], dtPending:{amount:0,count:0,unit:0} };
    GT.snapshot=s; return s;
  }

  async function load(force){ return (await detectEngine(force)) ? loadNew() : loadLegacy(); }
  async function rpc(name,args,msg){ if(!hasTreasuryRpcSession()){ toast('Ingresa nuevamente a Tesorera para autorizar operaciones.'); renderLock(); return null; } if(!(await detectEngine(true))){ toast(missingMsg()); return null; } const r=await rpcClient().rpc(name,args||{}); if(r.error){ toast(isMissing(r.error)?missingMsg():(r.error.message||'No se pudo ejecutar')); console.warn('[Treasury RPC]',name,r.error); return null; } if(msg) toast(msg); await render(true); return r.data; }
  function requireEngine(){ if(!GT.engineReady){ toast(missingMsg()); return false; } return true; }

  function shell(){
    const visibleTabs=tabs.filter(t=>t[0]!=='config'||canConfigure()).map(t=>'<button class="treasury-tab" type="button" data-treas-view="'+t[0]+'">'+t[1]+'</button>').join('');
    return '<div class="treasury-redesign" id="treasuryRedesign"><div class="treasury-head"><div><div class="section-title">Tesorera</div><div class="section-sub">Cuotas, pagos y egresos del equipo</div></div><button class="btn" id="treasuryRefreshBtn" type="button">Actualizar</button></div><div class="treasury-mode" id="treasuryModeBanner"></div><div class="treasury-tabs" role="tablist">'+visibleTabs+'</div><div class="treasury-kpi-grid" id="treasuryKpis"></div><div id="treasuryViewBody"></div></div>';
  }
  function ensureShell(){ const sec=document.getElementById('v-fees'); if(!sec) return; if(!sec.querySelector('#treasuryRedesign')){ sec.innerHTML=shell(); sec.querySelector('#treasuryRefreshBtn').addEventListener('click',()=>render(true)); sec.querySelectorAll('[data-treas-view]').forEach(b=>b.addEventListener('click',()=>{GT.view=b.dataset.treasView; body();})); } }
  function kpi(label,value,sub,tone){ return '<div class="treasury-kpi '+(tone||'')+'"><div class="treasury-kpi-value">'+h(value)+'</div><div class="treasury-kpi-label">'+h(label)+'</div>'+(sub?'<div class="treasury-kpi-sub">'+h(sub)+'</div>':'')+'</div>'; }
  function banner(){ const b=document.getElementById('treasuryModeBanner'); if(!b) return; b.className='treasury-mode '+(GT.engineReady?'ready':'legacy'); b.textContent=GT.engineReady?(hasTreasuryRpcSession()?'Motor financiero nuevo detectado. Operaciones criticas usan RPCs.':'Motor financiero nuevo detectado. Ingresa a Tesorera para autorizar operaciones.'):'Modo local-only/legacy: SQL y RPCs preparados, pendientes de ejecutar y validar en Supabase. '+(GT.engineError||''); }
  function kpis(){ const s=GT.snapshot||{}; const personal=(s.personalAdvances||[]).reduce((x,a)=>x+n(a.pending_amount),0); const el=document.getElementById('treasuryKpis'); if(!el) return; el.innerHTML=kpi('Saldo disponible',money(s.availableBalance),'Derivado de movimientos',s.availableBalance>=0?'good':'danger')+kpi('Adelantos por devolver',money(personal),(s.personalAdvances||[]).length+' persona(s)',personal?'warn':'good')+kpi('Jugadoras con pendientes',String((s.pendingPlayers||new Set()).size||0),'Cuotas o deudas','warn')+kpi('Pago DT pendiente',money(s.dtPending&&s.dtPending.amount),(s.dtPending&&s.dtPending.count||0)+' cuota(s)',s.dtPending&&s.dtPending.amount?'danger':'good')+kpi('Ingresos por confirmar',money(s.pendingIncomeAmount||0),(s.pendingIncomeCount||0)+' registro(s)',s.pendingIncomeAmount?'warn':''); }
  function body(){ document.querySelectorAll('#treasuryRedesign [data-treas-view]').forEach(b=>b.classList.toggle('active',b.dataset.treasView===GT.view)); banner(); kpis(); if(GT.view==='ingresos') incomes(); else if(GT.view==='actividades') activities(); else if(GT.view==='config') config(); else home(); bindActions(); }

  function home(){ const s=GT.snapshot||{}; const moves=(s.movements||[]).filter(m=>GT.movementFilter==='all'||String(m.movement_type||'').includes(GT.movementFilter)).slice(0,20); const adv=(s.personalAdvances||[]).map(a=>'<div class="treasury-row"><div><strong>'+h(a.player_id?pnameById(a.player_id):'Legacy sin beneficiaria')+'</strong><div class="muted">Original '+money(a.original_amount)+' - Recuperado '+money(a.recovered_amount)+'</div></div><span class="pill warn">'+money(a.pending_amount)+'</span></div>').join('')||'<div class="empty-state">Sin adelantos personales pendientes</div>'; const rows=moves.map(m=>'<div class="treasury-row"><div><strong>'+h(m.concept||m.movement_type||'Movimiento')+'</strong><div class="muted">'+h(m.movement_type||'')+' - '+h(String(m.effective_date||m.created_at||'').slice(0,10))+'</div></div><span class="money '+(m.direction==='out'?'out':'in')+'">'+(m.direction==='out'?'- ':'+ ')+money(m.amount)+'</span></div>').join('')||'<div class="empty-state">Sin movimientos</div>'; document.getElementById('treasuryViewBody').innerHTML='<section class="treasury-panel"><div class="treasury-panel-title">Dinero personal pendiente de devolver</div>'+adv+'</section><section class="treasury-panel"><div class="treasury-panel-head"><div class="treasury-panel-title">Ultimos movimientos</div><select id="treasuryMovementFilter" class="input compact"><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Egresos</option><option value="dt">Pago DT</option><option value="team_contribution">Aportes del equipo</option></select></div>'+rows+'</section><section class="treasury-panel"><div class="treasury-panel-title">Pago DT</div><div class="treasury-dt-box"><div><strong>'+money(s.dtPending&&s.dtPending.amount)+'</strong><div class="muted">'+(s.dtPending&&s.dtPending.count||0)+' cuota(s)</div></div><button class="btn p" data-action="pay-dt">Pagar DT</button></div></section>'; const f=document.getElementById('treasuryMovementFilter'); if(f){ f.value=GT.movementFilter; f.addEventListener('change',e=>{GT.movementFilter=e.target.value; home();}); } }
  function incomeLabel(t){ const x=incomeTypes.find(i=>i[0]===t); return x?x[1]:t||'Ingreso'; }
  function credit(pid){ return (GT.snapshot.credits||[]).filter(c=>String(c.player_id)===String(pid)&&c.status!=='used').reduce((s,c)=>s+n(c.remaining_amount),0); }
  function waIcon(){ return typeof WA_ICON !== 'undefined' ? WA_ICON : ''; }
  function wa(p,concept,amount){ const icon=waIcon(); const msg='Hola '+pname(p)+'! Te recordamos que tienes pendiente '+concept+' por '+money(amount)+'. Saludos, equipo Golden Moms'; const phone=String(p&&p.celular||'').replace(/\D/g,'').replace(/^56/,''); return phone?'<a class="btn-wa" href="https://wa.me/56'+phone+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener noreferrer">'+icon+' Recordar</a>':'<a class="btn-wa" href="#" data-wa-missing="1">'+icon+' Recordar</a>'; }
  function incomes(){ const s=GT.snapshot||{}; const note=s.mode==='legacy'?'<div class="treasury-note">Pendiente legacy estimado: '+money(s.pendingLegacyAmount||0)+'. Para operar cuotas nuevas ejecuta SQL/RPC.</div>':''; const ir=(s.income||[]).map(i=>'<div class="treasury-card-row"><div><strong>'+h(i.concept)+'</strong><div class="muted">'+h(incomeLabel(i.income_type))+' - '+h(i.status)+'</div></div><div class="treasury-actions"><span class="money in">'+money(i.amount)+'</span>'+(i.status==='pending'?'<button class="btn" data-action="confirm-income" data-id="'+i.id+'">Confirmar</button><button class="btn" data-action="cancel-income" data-id="'+i.id+'">Cancelar</button>':'')+'</div></div>').join('')||'<div class="empty-state">Sin ingresos nuevos</div>'; const fr=(s.monthlyFees||[]).slice(0,80).map(f=>{const p=player(f.player_id); const due=Math.max(n(f.gross_amount)-credit(f.player_id),0); return '<div class="treasury-card-row"><div><strong>'+h(pname(p))+'</strong><div class="muted">'+String(f.month).padStart(2,'0')+'/'+f.year+' - '+h(f.status)+' - credito '+money(credit(f.player_id))+'</div></div><div class="treasury-actions"><span>'+money(due)+'</span>'+(f.status==='pending'?'<button class="btn" data-action="cancel-fee" data-id="'+f.id+'">No cobrar</button><button class="btn p" data-action="pay-fee" data-id="'+f.id+'">Pagar</button>'+wa(p,'cuota '+String(f.month).padStart(2,'0')+'/'+f.year,due):'')+'</div></div>';}).join('')||'<div class="empty-state">Sin cuotas mensuales del nuevo modelo</div>'; const cr=(s.credits||[]).filter(c=>c.status!=='used'&&n(c.remaining_amount)>0).map(c=>'<div class="treasury-row"><span>'+h(pnameById(c.player_id))+'</span><strong>'+money(c.remaining_amount)+'</strong></div>').join('')||'<div class="empty-state">Sin creditos disponibles</div>'; document.getElementById('treasuryViewBody').innerHTML=note+'<div class="treasury-toolbar"><button class="btn p" data-action="new-income">Nuevo ingreso</button><button class="btn" data-action="generate-fees">Generar cuotas</button></div><section class="treasury-panel"><div class="treasury-panel-title">Ingresos extraordinarios</div>'+ir+'</section><section class="treasury-panel"><div class="treasury-panel-title">Cuotas mensuales</div>'+fr+'</section><section class="treasury-panel"><div class="treasury-panel-title">Creditos a favor</div>'+cr+'</section>'; }
  function activities(){ const s=GT.snapshot||{}; const legacy=s.mode==='legacy'?'<div class="treasury-note">Las tablas legacy se leen solo como referencia. Nuevas actividades requieren SQL/RPC.</div>':''; const rows=(s.activities||[]).map(a=>{ const ds=(s.debts||[]).filter(d=>String(d.activity_id)===String(a.id)); const pending=ds.filter(d=>d.status==='pending').length; const dr=ds.map(d=>debtRow(a,d)).join('')||'<div class="empty-state">Sin deudas asignadas</div>'; return '<section class="treasury-panel"><div class="treasury-panel-head"><div><div class="treasury-panel-title">'+h(a.name)+'</div><div class="muted">'+h(a.activity_type)+' - '+h(a.administrative_status)+' - '+(ds.length-pending)+'/'+ds.length+' pagadas</div></div><span class="pill '+(pending?'warn':'good')+'">'+(pending?'Pendiente':'Completada')+'</span></div>'+dr+'<div class="treasury-toolbar"><button class="btn" data-action="add-debt" data-id="'+a.id+'">Agregar persona</button></div></section>'; }).join('') || legacyRows(s); document.getElementById('treasuryViewBody').innerHTML=legacy+'<div class="treasury-toolbar"><button class="btn p" data-action="new-activity">Nueva actividad/gasto</button></div>'+rows; }
  function debtRow(a,d){ const p=player(d.player_id); const amount=n(d.assigned_amount); const actions=d.status==='pending'?'<button class="btn p" data-action="pay-debt" data-id="'+d.id+'">Pagada</button><button class="btn" data-action="no-charge" data-id="'+d.id+'">No cobrar</button>'+wa(p,a.name,amount):''; return '<div class="treasury-card-row"><div><strong>'+h(pname(p))+'</strong><div class="muted">Beneficia a '+h(d.beneficiary_player_id?pnameById(d.beneficiary_player_id):pnameById(a.payer_player_id))+' - '+h(d.status)+'</div></div><div class="treasury-actions"><span>'+money(amount)+'</span>'+actions+'</div></div>'; }
  function legacyRows(s){ const l=s.legacy||{}; const fees=(l.fees||[]).slice(0,20).map(f=>'<div class="treasury-card-row"><div><strong>'+h(f.title)+'</strong><div class="muted">Legacy fees - '+h(f.team||'')+'</div></div><span>'+money(f.total_amount||f.amount)+'</span></div>').join(''); const exps=(l.expenses||[]).slice(0,20).map(e=>'<div class="treasury-card-row"><div><strong>'+h(e.title)+'</strong><div class="muted">Legacy expenses - '+h(e.team||'')+'</div></div><span>'+money(e.total_amount)+'</span></div>').join(''); return '<section class="treasury-panel"><div class="treasury-panel-title">Registros legacy recientes</div>'+(fees+exps||'<div class="empty-state">Sin registros legacy</div>')+'</section>'; }
  function config(){ if(!canConfigure()){ document.getElementById('treasuryViewBody').innerHTML='<section class="treasury-panel"><div class="empty-state">Configuracion visible solo para Administradora o rol Tesorera cuando exista.</div></section>'; return; } const s=GT.snapshot||{}; const rows=(s.settings||[]).map(c=>'<div class="treasury-card-row"><div><strong>'+c.year+'</strong><div class="muted">Cuota '+money(c.monthly_fee_amount)+' = DT '+money(c.dt_amount)+' + Fondo '+money(c.team_fund_amount)+' - '+(c.is_active?'Activa':'Inactiva')+'</div></div><span>'+h(c.valid_from||'')+'</span></div>').join('')||'<div class="empty-state">Sin configuraciones nuevas</div>'; const audit=(s.audit||[]).slice(0,30).map(a=>'<div class="treasury-row"><div><strong>'+h(a.action)+'</strong><div class="muted">'+h(a.entity_type)+' - '+h(String(a.created_at||'').slice(0,16))+'</div></div><span class="muted">'+h(a.operation_id||'')+'</span></div>').join('')||'<div class="empty-state">Sin auditoria nueva</div>'; document.getElementById('treasuryViewBody').innerHTML='<div class="treasury-toolbar"><button class="btn p" data-action="new-setting">Nueva configuracion</button><button class="btn" data-action="historical-adjustment">Ajuste historico</button></div><section class="treasury-panel"><div class="treasury-panel-title">Configuracion anual</div>'+rows+'</section><section class="treasury-panel"><div class="treasury-panel-title">Auditoria reciente</div>'+audit+'</section><section class="treasury-panel"><div class="treasury-note">SQL preparado en supabase/sql. Pendiente de ejecutar y validar.</div></section>'; }

  function bindActions(){ const root=document.getElementById('treasuryViewBody'); if(!root) return; root.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click', action)); root.querySelectorAll('[data-wa-missing]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); toast('Esta jugadora no tiene numero de WhatsApp registrado.');})); }
  function action(e){ const a=e.currentTarget.dataset.action, id=e.currentTarget.dataset.id; if(a==='new-income') return incomeModal(); if(a==='confirm-income') return rpc('treasury_confirm_income',{p_income_id:id,p_received_at:new Date().toISOString(),p_idempotency_key:opKey('confirm-income')},'Ingreso confirmado'); if(a==='cancel-income'){ const r=prompt('Motivo de cancelacion:'); if(r) return rpc('treasury_cancel_income',{p_income_id:id,p_reason:r,p_idempotency_key:opKey('cancel-income')},'Ingreso cancelado'); } if(a==='generate-fees') return generateFeesModal(); if(a==='pay-fee') return feePayModal(id); if(a==='cancel-fee'){ const r=prompt('Motivo para no cobrar esta cuota:'); if(r) return rpc('treasury_cancel_monthly_fee',{p_monthly_fee_id:id,p_reason:r,p_idempotency_key:opKey('cancel-fee')},'Cuota marcada como No cobrar'); } if(a==='pay-dt') return dtModal(); if(a==='new-activity') return activityModal(); if(a==='add-debt') return addDebtModal(id); if(a==='pay-debt') return rpc('treasury_register_activity_debt_payment',{p_activity_debt_id:id,p_paid_at:new Date().toISOString(),p_idempotency_key:opKey('debt-payment')},'Deuda pagada'); if(a==='no-charge'){ const r=prompt('Motivo para No cobrar:'); if(r) return rpc('treasury_mark_debt_no_charge',{p_activity_debt_id:id,p_reason:r,p_idempotency_key:opKey('no-charge')},'Marcada como No cobrar'); } if(a==='new-setting') return settingModal(); if(a==='historical-adjustment') return adjustmentModal(); }
  function modal(title, html, onSubmit){ const old=document.getElementById('treasuryActionModal'); if(old) old.remove(); const bg=document.createElement('div'); bg.id='treasuryActionModal'; bg.className='modal-bg'; bg.style.display='flex'; bg.innerHTML='<form class="modal treasury-action-modal" role="dialog" aria-modal="true"><div class="modal-title"><div class="modal-title-icon">$</div><span>'+h(title)+'</span></div>'+html+'<div class="modal-actions"><button class="btn" type="button" data-close="1">Cancelar</button><button class="btn p" type="submit">Guardar</button></div></form>'; document.body.appendChild(bg); bg.querySelector('[data-close]').addEventListener('click',()=>bg.remove()); bg.addEventListener('click',e=>{if(e.target===bg) bg.remove();}); bg.querySelector('form').addEventListener('submit',async e=>{e.preventDefault(); await onSubmit(new FormData(e.currentTarget), e.currentTarget); bg.remove();}); }
  function opts(list,sel){ return list.map(x=>'<option value="'+x[0]+'" '+(x[0]===sel?'selected':'')+'>'+h(x[1])+'</option>').join(''); }
  function playerOpts(){ return GT.players.map(p=>'<option value="'+p.id+'">'+h(pname(p))+'</option>').join(''); }
  function incomeModal(){ if(!requireEngine()) return; modal('Nuevo ingreso','<div class="form-row"><div class="form-group"><label class="form-label">Tipo</label><select name="income_type" class="input">'+opts(incomeTypes,'cdp')+'</select></div><div class="form-group"><label class="form-label">Monto</label><input name="amount" class="input" type="number" min="1" required></div></div><label class="form-label">Concepto</label><input name="concept" class="input" required><div class="form-row"><div class="form-group"><label class="form-label">Fecha esperada</label><input name="expected_date" class="input" type="date" value="'+today()+'"></div><div class="form-group"><label class="form-label">Origen</label><input name="source" class="input"></div></div><label class="form-label">Observacion</label><textarea name="notes" class="input" rows="3"></textarea>', fd=>rpc('treasury_create_income',{p_payload:Object.fromEntries(fd),p_idempotency_key:opKey('income')},'Ingreso guardado pendiente')); }
  async function generateFeesModal(){ if(!requireEngine()) return; await loadPlayers(); const rest=GT.players.filter(p=>p.estado==='reposo').map(p=>'<label class="treasury-check"><input type="checkbox" data-extra-player="'+p.id+'"> <span>'+h(pname(p))+' <small>reposo</small></span></label>').join('')||'<div class="empty-state">No hay jugadoras en reposo para agregar</div>'; modal('Generar cuotas','<div class="treasury-note">Se generaran para las jugadoras activas del equipo seleccionado. Marca jugadoras en reposo solo si corresponde cobrarles este mes.</div><div class="form-row"><div class="form-group"><label class="form-label">Ano</label><input name="year" class="input" type="number" value="'+year()+'" required></div><div class="form-group"><label class="form-label">Mes</label><input name="month" class="input" type="number" min="1" max="12" value="'+month()+'" required></div></div><label class="form-label">Equipo</label><select name="team" class="input"><option>Golden Moms</option><option>Dreams</option><option>Power</option><option>Todos</option></select><div class="form-section-title">Agregar jugadoras en reposo</div><div class="treasury-player-picker compact">'+rest+'</div>', (fd,form)=>{ const extra=[...form.querySelectorAll('[data-extra-player]')].filter(c=>c.checked).map(c=>c.dataset.extraPlayer); return rpc('treasury_generate_monthly_fees',{p_year:Number(fd.get('year')),p_month:Number(fd.get('month')),p_team:fd.get('team'),p_extra_player_ids:extra,p_idempotency_key:opKey('generate-fees')},'Cuotas generadas'); }); }
  function feePayModal(id){ if(!requireEngine()) return; const f=(GT.snapshot.monthlyFees||[]).find(x=>String(x.id)===String(id)); if(!f) return; const due=Math.max(n(f.gross_amount)-credit(f.player_id),0); modal('Registrar pago de cuota','<div class="treasury-note">'+h(pnameById(f.player_id))+' - Pendiente '+money(due)+' - Credito '+money(credit(f.player_id))+'</div><label class="form-label">Monto recibido</label><input name="amount_received" class="input" type="number" min="0" value="'+due+'" required><label class="form-label">Fecha pago</label><input name="paid_at" class="input" type="date" value="'+today()+'">', fd=>rpc('treasury_create_monthly_fee_payment',{p_monthly_fee_id:id,p_amount_received:Number(fd.get('amount_received')),p_paid_at:fd.get('paid_at'),p_idempotency_key:opKey('fee-payment')},'Pago registrado')); }
  function dtModal(){ if(!requireEngine()) return; const dt=GT.snapshot.dtPending||{}; if(!dt.amount){toast('No hay pago DT pendiente.'); return;} modal('Pagar DT','<div class="treasury-note">Total '+money(dt.amount)+' por '+(dt.count||0)+' cuotas.</div><div class="form-row"><div class="form-group"><label class="form-label">Ano</label><input name="year" class="input" type="number" value="'+year()+'" required></div><div class="form-group"><label class="form-label">Mes</label><input name="month" class="input" type="number" value="'+month()+'" required></div></div>', fd=>rpc('treasury_register_dt_payment',{p_year:Number(fd.get('year')),p_month:Number(fd.get('month')),p_idempotency_key:opKey('dt-payment')},'Pago DT registrado')); }
  async function activityModal(){ if(!requireEngine()) return; await loadPlayers(); const rows=GT.players.filter(p=>p.estado==='activo').map(p=>'<label class="treasury-check"><input type="checkbox" data-player-id="'+p.id+'"> <span>'+h(pname(p))+'</span><input class="input compact" type="number" min="0" data-amount-for="'+p.id+'" placeholder="Monto"></label>').join(''); modal('Nueva actividad o gasto','<div class="treasury-note">Si el equipo paga todo y no se debe cobrar a nadie, deja participantes vacio y usa Equipo/Tesoreria como pagador.</div><div class="form-row"><div class="form-group"><label class="form-label">Nombre</label><input name="name" class="input" required></div><div class="form-group"><label class="form-label">Tipo</label><select name="activity_type" class="input">'+opts(activityTypes,'campeonato')+'</select></div></div><div class="form-row"><div class="form-group"><label class="form-label">Fecha</label><input name="activity_date" class="input" type="date" value="'+today()+'"></div><div class="form-group"><label class="form-label">Costo total</label><input name="total_cost" class="input" type="number" min="1" required></div></div><div class="form-row"><div class="form-group"><label class="form-label">Aporte equipo</label><input name="team_contribution" class="input" type="number" min="0" value="0"></div><div class="form-group"><label class="form-label">Pagado por</label><select name="payer_player_id" class="input"><option value="">Equipo/Tesoreria</option>'+playerOpts()+'</select></div></div><label class="form-label">Distribucion</label><select name="distribution_type" class="input"><option value="equal">Igualitaria</option><option value="individual">Individual</option></select><div class="form-section-title">Participantes a cobrar</div><div class="treasury-player-picker">'+rows+'</div>', (fd,form)=>{ const payload=Object.fromEntries(fd); const selected=[...form.querySelectorAll('[data-player-id]')].filter(c=>c.checked); const payer=fd.get('payer_player_id'); const distribution=fd.get('distribution_type'); if(payer && distribution==='equal' && !selected.some(c=>c.dataset.playerId===payer)){ const payerCheck=form.querySelector('[data-player-id="'+payer+'"]'); if(payerCheck) selected.push(payerCheck); } if(payer && distribution==='individual' && !selected.some(c=>c.dataset.playerId===payer)){ toast('Incluye a la persona que pago y asigna su propio monto para descontarlo.'); return; } const debts=selected.map(c=>({player_id:c.dataset.playerId,assigned_amount:Number(form.querySelector('[data-amount-for="'+c.dataset.playerId+'"]').value)||0})); return rpc('treasury_create_activity_with_debts',{p_payload:payload,p_debts:debts,p_idempotency_key:opKey('activity')},'Actividad creada'); }); }
  async function addDebtModal(id){ if(!requireEngine()) return; await loadPlayers(); const options=GT.players.map(p=>'<option value="'+p.id+'">'+h(pname(p))+(p.estado==='reposo'?' (reposo)':'')+'</option>').join(''); modal('Agregar persona','<label class="form-label">Jugadora</label><select name="player_id" class="input" required>'+options+'</select><label class="form-label">Monto</label><input name="assigned_amount" class="input" type="number" min="1" required>', fd=>rpc('treasury_add_activity_debt',{p_activity_id:id,p_player_id:fd.get('player_id'),p_assigned_amount:Number(fd.get('assigned_amount')),p_idempotency_key:opKey('add-debt')},'Persona agregada')); }  function settingModal(){ if(!requireEngine()) return; modal('Configuracion anual','<div class="form-row"><div class="form-group"><label class="form-label">Ano</label><input name="year" class="input" type="number" value="'+year()+'" required></div><div class="form-group"><label class="form-label">Valor cuota</label><input name="monthly_fee_amount" class="input" type="number" required></div></div><div class="form-row"><div class="form-group"><label class="form-label">Monto DT</label><input name="dt_amount" class="input" type="number" required></div><div class="form-group"><label class="form-label">Monto fondo</label><input name="team_fund_amount" class="input" type="number" required></div></div><label class="form-label">Vigente desde</label><input name="valid_from" class="input" type="date" value="'+today()+'"><label class="form-label">Observacion</label><textarea name="notes" class="input" rows="3"></textarea>', fd=>{ const p=Object.fromEntries(fd); if(n(p.monthly_fee_amount)!==n(p.dt_amount)+n(p.team_fund_amount)){ toast('La cuota debe ser igual a DT + Fondo.'); return; } return rpc('treasury_upsert_settings',{p_payload:p,p_idempotency_key:opKey('settings')},'Configuracion guardada'); }); }
  function adjustmentModal(){ if(!requireEngine()) return; modal('Ajuste historico','<label class="form-label">Tipo</label><select name="adjustment_type" class="input"><option value="initial_balance">Saldo inicial</option><option value="positive_correction">Correccion positiva</option><option value="negative_correction">Correccion negativa</option><option value="other">Otro</option></select><label class="form-label">Monto</label><input name="amount" class="input" type="number" min="1" required><label class="form-label">Motivo</label><input name="reason" class="input" required><label class="form-label">Descripcion</label><textarea name="description" class="input" rows="3"></textarea>', fd=>rpc('treasury_create_historical_adjustment',{p_payload:Object.fromEntries(fd),p_idempotency_key:opKey('adjustment')},'Ajuste registrado')); }

  async function render(force){ if(!hasTreasuryRpcSession()){ renderLock(); return; } hideLock(); ensureShell(); const b=document.getElementById('treasuryViewBody'); if(b && !GT.snapshot) b.innerHTML='<div class="empty-state">Cargando Tesoreria...</div>'; await load(force); if(GT.view==='config'&&!canConfigure()) GT.view='inicio'; body(); }
  function storedSession(){ try{ const raw=sessionStorage.getItem(TREAS_KEY); if(!raw) return false; const parsed=raw==='1'?{role:'admin',expiresAt:Date.now()+1}:JSON.parse(raw); return isTreasuryRole(parsed) && (!parsed.expiresAt || parsed.expiresAt>Date.now()); }catch(e){ return false; } }
  function renderLock(){ const sec=document.getElementById('v-fees'); if(!sec) return; sec.innerHTML='<div class="treas-lock" id="treasLock" style="display:flex"><div class="treas-lock-box"><div class="treas-lock-icon">$</div><div class="treas-lock-title">Tesorera</div><div class="treas-lock-sub">Ingresa una cuenta administradora, capitana o tesorera para abrir este modulo</div><input id="treasUserInput" class="treas-lock-input" placeholder="Usuario"><input type="password" id="treasPwdInput" class="treas-lock-input treas-lock-pass" placeholder="Contrasena"><div class="treas-lock-err" id="treasPwdErr"></div><button class="btn p" id="treasUnlockBtn" type="button" style="width:100%">Entrar</button></div></div>'; document.getElementById('treasUnlockBtn').addEventListener('click',unlock); document.getElementById('treasPwdInput').addEventListener('keydown',e=>{if(e.key==='Enter') unlock();}); }
  async function unlock(){
    const username=(document.getElementById('treasUserInput').value||'').trim().toLowerCase();
    const password=document.getElementById('treasPwdInput').value||'';
    const err=document.getElementById('treasPwdErr');
    if(!username||!password){err.textContent='Ingresa usuario y contrasena'; return;}
    try{
      const sr=await supa.rpc('treasury_create_session',{p_username:username,p_password:password});
      if(sr.error) throw sr.error;
      saveTreasuryRpcSession(sr.data||{});
      const u=(sr.data&&sr.data.user)||{username,role:'tesorera'};
      if(typeof saveSession==='function') saveSession(u);
      setTreasAuth(u, sr.data);
      if(typeof hideLoginScreen==='function') hideLoginScreen();
      if(typeof updateUserUI==='function') updateUserUI();
      if(typeof addAdminControls==='function') addAdminControls();
      render(true);
      return;
    }catch(authErr){
      if(isMissing(authErr)){ err.textContent='Ejecuta 009_treasury_custom_auth_bridge.sql en Supabase.'; return; }
      err.textContent=authErr.message||'No se pudo autorizar Tesorera';
    }
  }
  function hideLock(){ const l=document.getElementById('treasLock'); if(l) l.style.display='none'; }

  window.GoldenTreasury = { render, detectEngine, callRpc:rpc, isTreasuryRole, buildWhatsAppReminder:(x)=>wa(x.player,x.concept,x.amount) };
  window.checkTreasAuth = function(){ return hasTreasuryRpcSession(); };
  window.setTreasAuth = function(u, sessionData){ if(sessionData) saveTreasuryRpcSession(sessionData); try{ sessionStorage.setItem(TREAS_KEY, JSON.stringify({username:u&&u.username||'',role:u&&u.role||'admin',expiresAt:Date.now()+TREAS_SESSION_MS})); }catch(e){} try{ treasUnlocked=true; }catch(e){} };
  window.showTreasLock = renderLock;
  window.hideTreasLock = hideLock;
  window.renderTreasury = render;
  window.preloadMonthlyCuotas = async function(){ console.info('preloadMonthlyCuotas legacy desactivado: usar treasury_generate_monthly_fees RPC.'); };
})();
