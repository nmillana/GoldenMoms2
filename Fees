/* ═══════════════════════════════════════════════════════
   fees.js — Cuotas, WA helpers, Notificaciones, Tesorera
   ═══════════════════════════════════════════════════════ */
'use strict';
import { supa, IS_CONNECTED, currentUser, editingTreasEventId, setEditingTreasEventId } from './state.js';
import { TEAMS } from './config.js';
import { escapeHTML, showToast, showError } from './helpers.js';

/* ═══════════════════════════════════════════════════════════
   CUOTAS
   ══════════════════════════════════════════════════════════ */
const feeModalBg=document.getElementById('feeModalBg');
let editingFeeId=null;
let feePaymentsState={}; // player_id → boolean

async function openFeeModal(fee=null){
  editingFeeId=fee?.id||null;
  feePaymentsState={};
  document.getElementById('feeModalTitle').textContent=fee?'Editar cuota':'Nueva cuota';
  document.getElementById('fee_id').value=fee?.id||'';
  document.getElementById('fee_title').value=fee?.title||'';
  document.getElementById('fee_amount').value=fee?.amount||'';
  document.getElementById('fee_due').value=fee?.due_date||'';
  document.getElementById('fee_team').value=fee?.team||'Golden Moms';
  document.getElementById('btnDeleteFee').style.display=fee?'':'none';

  // Load payment statuses
  const pgrid=document.getElementById('fee_payments_grid');
  pgrid.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px">Cargando jugadoras…</div>';
  feeModalBg.style.display='flex';

  if(!supa||!IS_CONNECTED){ pgrid.innerHTML='<div style="color:var(--muted)">Sin conexión</div>'; return; }
  try{
    // Load players
    if(!allPlayers.length){
      const {data}=await supa.from('players').select('id,apodo,nombre,numero_camiseta,equipos').order('apodo',{ascending:true});
      allPlayers=data||[];
    }
    const teamFilter=document.getElementById('fee_team').value;
    let filtered=allPlayers;
    if(teamFilter!=='Todos') filtered=filtered.filter(p=>Array.isArray(p.equipos)&&p.equipos.includes(teamFilter));

    // Load existing payments if editing
    if(fee?.id){
      const {data:payments}=await supa.from('fee_payments').select('player_id,paid').eq('fee_id',fee.id);
      for(const pay of (payments||[])){ feePaymentsState[pay.player_id]=pay.paid; }
    }

    renderFeePaymentsGrid(filtered);
  } catch(err){ pgrid.innerHTML='<div style="color:var(--danger)">Error cargando jugadoras</div>'; }
}

function renderFeePaymentsGrid(players){
  const pgrid=document.getElementById('fee_payments_grid');
  pgrid.innerHTML='';
  for(const p of players){
    const paid=feePaymentsState[p.id]||false;
    const row=document.createElement('div');row.className='fee-player-row';
    const av=document.createElement('div');av.className='att-avatar';av.style.width='28px';av.style.height='28px';av.style.fontSize='11px';
    av.textContent=(p.apodo||p.nombre||'?')[0].toUpperCase();
    const nm=document.createElement('div');nm.className='fee-player-name';nm.textContent=p.apodo||p.nombre||'—';
    const toggle=document.createElement('button');toggle.type='button';
    toggle.className='fee-toggle '+(paid?'paid':'unpaid');
    toggle.textContent=paid?'✅ Pagó':'❌ Debe';
    toggle.dataset.pid=p.id;
    toggle.addEventListener('click',()=>{
      feePaymentsState[p.id]=!feePaymentsState[p.id];
      toggle.className='fee-toggle '+(feePaymentsState[p.id]?'paid':'unpaid');
      toggle.textContent=feePaymentsState[p.id]?'✅ Pagó':'❌ Debe';
    });
    row.appendChild(av);row.appendChild(nm);row.appendChild(toggle);
    pgrid.appendChild(row);
  }
}

document.getElementById('fee_team').addEventListener('change', ()=>{
  if(!allPlayers.length) return;
  const t=document.getElementById('fee_team').value;
  const filtered=t==='Todos'?allPlayers:allPlayers.filter(p=>Array.isArray(p.equipos)&&p.equipos.includes(t));
  renderFeePaymentsGrid(filtered);
});

function closeFeeModal(){ feeModalBg.style.display='none'; editingFeeId=null; feePaymentsState={}; }
document.getElementById('btnNewFee').addEventListener('click',()=>openFeeModal());
document.getElementById('btnCloseFee').addEventListener('click',closeFeeModal);
feeModalBg.addEventListener('click',e=>{ if(e.target===feeModalBg) closeFeeModal(); });

document.getElementById('btnDeleteFee').addEventListener('click', async ()=>{
  if(!editingFeeId||!supa||!IS_CONNECTED) return;
  if(!confirm('¿Eliminar esta cuota y todos sus pagos?')) return;
  try{
    await supa.from('fee_payments').delete().eq('fee_id',editingFeeId);
    const {error}=await supa.from('fees').delete().eq('id',editingFeeId);
    if(error) throw error;
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  closeFeeModal(); renderFees();
});

document.getElementById('btnSaveFee').addEventListener('click', async ()=>{
  const title=document.getElementById('fee_title').value.trim();
  if(!title){ alert('El título es obligatorio.'); return; }
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const amount=document.getElementById('fee_amount').value;
  const payload={
    title,
    amount: amount?parseFloat(amount):null,
    due_date: document.getElementById('fee_due').value||null,
    team: document.getElementById('fee_team').value,
  };
  try{
    let feeId=editingFeeId;
    if(editingFeeId){
      const {error}=await supa.from('fees').update(payload).eq('id',editingFeeId);
      if(error) throw error;
    } else {
      const {data,error}=await supa.from('fees').insert([payload]).select('id');
      if(error) throw error;
      feeId=data?.[0]?.id;
    }
    // Upsert payments
    if(feeId){
      const upserts=Object.entries(feePaymentsState).map(([player_id,paid])=>({
        fee_id:feeId, player_id, paid,
        paid_at: paid ? new Date().toISOString() : null
      }));
      if(upserts.length){
        const {error}=await supa.from('fee_payments').upsert(upserts,{onConflict:'fee_id,player_id'});
        if(error) console.warn('fee_payments upsert:',error);
      }
    }
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  closeFeeModal(); renderFees();
});

async function renderFees(){
  const list=document.getElementById('feesList');
  list.innerHTML='';
  if(!supa||!IS_CONNECTED){ list.innerHTML='<div class="empty-state">Sin conexión</div>'; return; }
  try{
    const {data:fees,error}=await supa.from('fees').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    if(!fees?.length){ list.innerHTML='<div class="empty-state"><span class="empty-state-icon">💰</span>No hay cuotas. ¡Crea la primera!</div>'; return; }

    for(const fee of fees){
      // Load payments for this fee — MUST filter by fee_id
      const {data:payments}=await supa.from('fee_payments').select('player_id,paid').eq('fee_id', fee.id);
      const paidSet=new Set((payments||[]).filter(p=>p.paid).map(p=>p.player_id));
      const totalPayers=(payments||[]).length;
      const paidCount=paidSet.size;
      const pct=totalPayers>0?Math.round(paidCount/totalPayers*100):0;

      const card=document.createElement('div');card.className='fee-card';

      const header=document.createElement('div');header.className='fee-header';
      const left=document.createElement('div');
      const title=document.createElement('div');title.className='fee-title';title.textContent=fee.title;
      const meta=document.createElement('div');meta.className='fee-meta';
      const parts=[];
      if(fee.amount) parts.push('$'+Number(fee.amount).toLocaleString('es-CL'));
      if(fee.due_date) parts.push('Vence: '+safeDateOnly(fee.due_date)?.toLocaleDateString('es-CL',{day:'2-digit',month:'short'})||fee.due_date);
      parts.push(fee.team);
      meta.textContent=parts.join(' · ');
      left.appendChild(title);left.appendChild(meta);

      const right=document.createElement('div');right.style.display='flex';right.style.alignItems='center';right.style.gap='10px';
      const progWrap=document.createElement('div');progWrap.className='fee-progress-wrap';
      progWrap.innerHTML=`<div class="fee-progress-bg"><div class="fee-progress-fill" style="width:${pct}%"></div></div><div class="fee-pct">${paidCount}/${totalPayers}</div>`;
      const editBtn=document.createElement('button');editBtn.className='fee-edit-btn';editBtn.textContent='✏️ Editar';
      editBtn.addEventListener('click',e=>{e.stopPropagation();openFeeModal(fee);});
      right.appendChild(progWrap);right.appendChild(editBtn);

      header.appendChild(left);header.appendChild(right);

      // Collapsible body with per-player status
      const body=document.createElement('div');body.className='fee-body fee-collapsed';
      {
        // Load ALL active players for this team
        const {data:pl}=await supa.from('players').select('id,apodo,nombre,celular,equipos,estado')
          .eq('estado','activo').order('apodo',{ascending:true});
        const allActivePlayers = (pl||[]).filter(p=>fee.team==='Golden Moms'||( Array.isArray(p.equipos)&&p.equipos.includes(fee.team)));
        const paidMap = Object.fromEntries((payments||[]).map(p=>[p.player_id,p]));
        const pay_list = allActivePlayers.map(p=>({ player_id:p.id, paid: paidMap[p.id]?.paid||false, _player:p }));
        if(pay_list.length){
        for(const pay of pay_list){
          const pl=pay._player;
          if(!pl) continue;
          const row=document.createElement('div');row.className='fee-player-row';
          const nm=document.createElement('span');nm.className='fee-player-name';nm.textContent=pl.apodo||pl.nombre||'—';
          const status=document.createElement('span');
          status.className='fee-toggle '+(pay.paid?'paid':'unpaid');
          status.textContent=pay.paid?'✅ Pagó':'❌ Debe';
          // Toggle payment inline
          status.style.cursor='pointer';
          status.addEventListener('click', async ()=>{
            const newPaid=!pay.paid;
            try{
              await supa.from('fee_payments').upsert([{fee_id:fee.id,player_id:pay.player_id,paid:newPaid,paid_at:newPaid?new Date().toISOString():null}],{onConflict:'fee_id,player_id'});
              pay.paid=newPaid;
              status.className='fee-toggle '+(newPaid?'paid':'unpaid');
              status.textContent=newPaid?'✅ Pagó':'❌ Debe';
              waReminder.style.display = newPaid ? 'none' : '';
            } catch(e){ console.warn(e); }
          });
          // WA reminder — only visible if unpaid
          const waReminder = document.createElement('a');
          waReminder.className='btn-wa'; waReminder.target='_blank'; waReminder.rel='noopener noreferrer';
          const playerName = pl.apodo||pl.nombre||'';
          const playerPhone = pl.celular ? pl.celular.replace(/\D/g,'') : '';
          const feeMsg = `Hola ${playerName} 👋 Te recordamos que tienes pendiente la cuota *${fee.title}*${fee.amount?' por $'+Number(fee.amount).toLocaleString('es-CL'):''} del equipo Golden Moms 💚`;
          // If we have their number, send direct; otherwise open chat selector
          if(playerPhone){
            // Direct chat with pre-filled message (works for individual wa.me links)
            const cleanPhone = playerPhone.replace(/^\+?56/,'').replace(/\D/g,'');
            waReminder.href = `https://wa.me/56${cleanPhone}?text=${encodeURIComponent(feeMsg)}`;
          } else {
            // No phone: copy message and open group
            waReminder.href = '#';
            waReminder.addEventListener('click', e=>{
              e.preventDefault();
              waGroupSend(feeMsg);
            });
          }
          waReminder.innerHTML = WA_ICON + (playerPhone ? ' Recordar' : ' Recordar (grupo)');
          waReminder.style.display = pay.paid ? 'none' : '';
          row.appendChild(nm);row.appendChild(status);row.appendChild(waReminder);body.appendChild(row);
        }
        } // end if pay_list.length

        // Group WA reminder button inside fee body
        const unpaidList = pay_list.filter(p=>!p.paid);
        if(unpaidList.length){
          const grpRow = document.createElement('div'); grpRow.style.cssText='padding:8px 0 2px;border-top:1px solid var(--line);margin-top:6px';
          const grpBtn = document.createElement('button'); grpBtn.className='btn'; grpBtn.style.cssText='width:100%;font-size:12px;padding:6px 10px';
          grpBtn.textContent='📢 Recordatorio grupal (' + unpaidList.length + ' deben)';
          grpBtn.addEventListener('click', ()=>{
            const names = unpaidList.map(p=>p._player.apodo||p._player.nombre||'').filter(Boolean);
            const msg = '💰 *Recordatorio cuota — ' + fee.title + '*\n\nFaltan por pagar:\n' + names.map(n=>'• '+n).join('\n') + (fee.amount?'\n\nMonto: $'+Number(fee.amount).toLocaleString('es-CL'):'') + '\n\n💚 Golden Moms';
            if(navigator.share){ navigator.share({text:msg}).catch(()=>{}); }
            else if(navigator.clipboard){ navigator.clipboard.writeText(msg).then(()=>showToast('📋 Mensaje copiado')); }
          });
          grpRow.appendChild(grpBtn); body.appendChild(grpRow);
        }
      }
      // Toggle expand
      header.addEventListener('click',()=>{
        body.classList.toggle('fee-collapsed');
      });
      card.appendChild(header);card.appendChild(body);
      list.appendChild(card);
    }
  } catch(err){ console.error('renderFees',err); list.innerHTML='<div class="empty-state">Error cargando cuotas</div>'; }
}



/* ═══════════════════════════════════════════════════════════
   WHATSAPP HELPERS
   ══════════════════════════════════════════════════════════ */
const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.849L.073 23.927l6.244-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.373l-.36-.214-3.707.972.989-3.614-.234-.373A9.818 9.818 0 1112 21.818z"/></svg>`;

const WA_GROUP = 'https://chat.whatsapp.com/CJlsdVUqSjJAiaXZBaSi41';

function waLink(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

function waGroupLink(text) {
  // ?text= no funciona en links de grupo — copiamos al portapapeles y abrimos el grupo
  try { navigator.clipboard.writeText(text); } catch(e) {}
  return WA_GROUP;
}

// Unified helpers
function showError(msg){ showToast('❌ '+msg, 4000); console.warn('[Error]', msg); }
function showSuccess(msg){ showToast('✅ '+msg, 2500); }

function showToast(msg, duration=2800) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), duration);
}

async function waGroupSend(text) {
  // Copy to clipboard then open group
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Mensaje copiado — pegalo en el grupo');
  } catch(e) {
    showToast('Abriendo grupo de WhatsApp…');
  }
  setTimeout(() => window.open(WA_GROUP, '_blank'), 400);
}

function makeWaBtn(text, label='WhatsApp') {
  const a = document.createElement('a');
  a.className = 'btn-wa';
  a.href = waLink(text);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.innerHTML = WA_ICON + label;
  return a;
}



/* ═══════════════════════════════════════════════════════════
   NOTIFICACIONES — PENDIENTES DE CONFIRMAR ASISTENCIA
   ══════════════════════════════════════════════════════════ */
async function loadNotificationsAdmin() {
  if(!supa || !IS_CONNECTED) return;
  try {
    const now = new Date();
    // Fetch upcoming events (next 14 days) that have attendance records
    const future = new Date(now); future.setDate(future.getDate() + 14);
    const { data:events } = await supa.from('events')
      .select('id, title, datetime, team, type')
      .gte('datetime', now.toISOString())
      .lte('datetime', future.toISOString())
      .order('datetime', {ascending:true});

    if(!events?.length){ updateBell([]); return; }

    // Single bulk query for all attendance (avoids N+1)
    const eventIds = events.map(e=>e.id);
    const { data:allAtt } = await supa.from('attendance')
      .select('event_id, player_id, status')
      .in('event_id', eventIds);

    const attByEvent = {};
    (allAtt||[]).forEach(a=>{
      if(!attByEvent[a.event_id]) attByEvent[a.event_id]=[];
      attByEvent[a.event_id].push(a);
    });

    const pending = [];
    for(const ev of events){
      const att = attByEvent[ev.id]||[];
      const convoked = att.length;
      const dudaCount = att.filter(a=>a.status==='Duda').length;
      if(convoked > 0 && dudaCount > 0){
        const d = new Date(ev.datetime);
        pending.push({
          id: ev.id, title: ev.title,
          dateStr: d.toLocaleDateString('es-CL',{weekday:'short',day:'2-digit',month:'short'}),
          timeStr: d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}),
          team: ev.team, type: ev.type, event: ev,
          pendingCount: dudaCount, total: convoked
        });
      }
    }
    updateBell(pending);
  } catch(err){ console.warn('loadNotifications', err); }
}

function updateBell(pending) {
  const badge  = document.getElementById('bellBadge');
  const list   = document.getElementById('notifList');
  const count  = document.getElementById('notifCount');
  const banner = document.getElementById('pendingBanner');
  const pList  = document.getElementById('pendingList');

  if(!badge || !list) return;

  if(!pending.length){
    badge.classList.add('hidden');
    if(banner) banner.style.display = 'none';
    list.innerHTML = '<div class="notif-empty">Sin pendientes ✅</div>';
    return;
  }

  // Update badge
  badge.textContent = pending.length;
  badge.classList.remove('hidden');
  if(count) count.textContent = pending.length + ' evento' + (pending.length>1?'s':'');

  // Update dropdown list
  list.innerHTML = '';
  pending.forEach(p => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML =
      '<div class="notif-icon">⏳</div>' +
      '<div>' +
        '<div class="notif-title">' + escapeHTML(p.title||'Evento') + '</div>' +
        '<div class="notif-sub">' + p.dateStr + ' · ' + p.timeStr + ' · ' + p.team + '</div>' +
        '<div class="notif-sub" style="color:#92400e;margin-top:3px;font-weight:700">' + p.pendingCount + ' sin confirmar de ' + p.total + '</div>' +
      '</div>';
    item.addEventListener('click', () => {
      closeNotifDropdown();
      // Navigate to events and open attendance modal
      document.querySelectorAll('.nav .tab').forEach(b=>b.classList.remove('active'));
      const evTab = document.querySelector('.nav .tab[data-view="events"]');
      if(evTab) evTab.classList.add('active');
      showView('events');
      setTimeout(() => {
        if(p.type === 'Entrenamiento') openAttModal(p.event);
        else openResultModal(p.event);
      }, 400);
    });
    list.appendChild(item);
  });

  // Update dashboard banner
  if(banner && pList){
    banner.style.display = '';
    pList.innerHTML = '';
    pending.slice(0,3).forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #fde68a;cursor:pointer;font-size:13px';
      row.innerHTML = '<span style="font-size:15px">📅</span><span style="font-weight:700;flex:1">' + escapeHTML(p.title||'') + '</span><span style="color:#92400e;font-size:12px">' + p.dateStr + ' · ' + p.timeStr + '</span>';
      row.addEventListener('click', () => item.click());
      // Actually open the event
      row.addEventListener('click', () => {
        document.querySelectorAll('.nav .tab').forEach(b=>b.classList.remove('active'));
        const evTab = document.querySelector('.nav .tab[data-view="events"]');
        if(evTab) evTab.classList.add('active');
        showView('events');
        setTimeout(() => {
          if(p.type === 'Entrenamiento') openAttModal(p.event);
        }, 400);
      });
      pList.appendChild(row);
    });
    const last = pList.lastChild;
    if(last) last.style.borderBottom = 'none';
  }
}

function closeNotifDropdown(){
  document.getElementById('notifDropdown')?.classList.remove('open');
}

// Bell toggle
document.getElementById('bellBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('notifDropdown')?.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if(!e.target.closest('#bellBtn') && !e.target.closest('#notifDropdown')){
    closeNotifDropdown();
  }
});



/* ═══════════════════════════════════════════════════════════
   PANEL TESORERA — clave + KPIs + eventos especiales
   ══════════════════════════════════════════════════════════ */
// Treasurer password hash — SHA-256 of 'TesoreraGolden'
// To change password: compute SHA-256 of new password and replace the hash below
// Tool: https://emn178.github.io/online-tools/sha256.html
const TREAS_PWD_HASH = '9e9d62dd2039594c7365e0faf3f5f016f4d855bd62fa33fe702ea79488e95d81';
const TREAS_KEY     = 'gm_treas_auth';
const MONTHLY_AMOUNT = 20000;
let treasUnlocked   = false;
let editingTreasEventId = null;

// ── Lock / unlock ─────────────────────────────────────────
function checkTreasAuth(){
  try { return sessionStorage.getItem(TREAS_KEY) === '1'; } catch(e){ return false; }
}
function setTreasAuth(){
  try { sessionStorage.setItem(TREAS_KEY, '1'); } catch(e){}
  treasUnlocked = true;
}

function showTreasLock(){
  const lock = document.getElementById('treasLock');
  if(lock) lock.style.display = 'flex';
}
function hideTreasLock(){
  const lock = document.getElementById('treasLock');
  if(lock) lock.style.display = 'none';
}

document.getElementById('treasUnlockBtn')?.addEventListener('click', async () => {
  const val = document.getElementById('treasPwdInput')?.value || '';
  const err = document.getElementById('treasPwdErr');
  if(!val){ if(err) err.textContent='Ingresá la clave'; return; }
  const h = await sha256(val);
  if(h === TREAS_PWD_HASH){
    setTreasAuth();
    hideTreasLock();
    renderFees();
    renderTreasKPIs();
    renderExpenses();
  } else {
    if(err) err.textContent = '❌ Clave incorrecta';
    document.getElementById('treasPwdInput').value='';
    setTimeout(()=>{ if(err) err.textContent=''; }, 2500);
  }
});
document.getElementById('treasPwdInput')?.addEventListener('keydown', e => {
  if(e.key === 'Enter') document.getElementById('treasUnlockBtn')?.click();
});

// Lock handled inside showView original

// ── Pre-load monthly cuotas if not exist ─────────────────
async function preloadMonthlyCuotas(){
  if(!supa || !IS_CONNECTED) return;
  // Only run if treasurer is unlocked (avoids RLS error for normal users)
  if(!checkTreasAuth()) return;
  try{
    const { data: existing, error: fetchErr } = await supa.from('fees').select('title').like('title','Mensualidad%');
    if(fetchErr){ console.warn('preloadMonthlyCuotas fetch:', fetchErr.message); return; }
    const existingTitles = new Set((existing||[]).map(f=>f.title));
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const year = new Date().getFullYear();
    const toInsert = [];
    months.forEach((m, i) => {
      const title = 'Mensualidad ' + m + ' ' + year;
      if(!existingTitles.has(title)){
        const due = year + '-' + String(i+1).padStart(2,'0') + '-10';
        toInsert.push({ title, amount: MONTHLY_AMOUNT, due_date: due, team: 'Golden Moms' });
      }
    });
    if(toInsert.length){
      const { error: insErr } = await supa.from('fees').insert(toInsert);
      if(insErr) console.warn('preloadMonthlyCuotas insert:', insErr.message);
    }
  } catch(e){ console.warn('preloadMonthlyCuotas', e); }
}

// ── KPI panel ────────────────────────────────────────────
async function renderTreasKPIs(){
  if(!supa || !IS_CONNECTED) return;
  try{
    // Income: all paid fee_payments * their fee amount
    const { data:fees } = await supa.from('fees').select('id,amount');
    const feeAmounts = Object.fromEntries((fees||[]).map(f=>[f.id, Number(f.amount)||0]));

    const { data:payments } = await supa.from('fee_payments').select('fee_id,paid');
    let income = 0;
    (payments||[]).forEach(p => { if(p.paid) income += feeAmounts[p.fee_id]||0; });

    // Treas events income
    const { data:tevents } = await supa.from('treas_events').select('id,amount');
    const tevAmounts = Object.fromEntries((tevents||[]).map(t=>[t.id, Number(t.amount)||0]));
    const { data:tpays } = await supa.from('treas_event_payments').select('treas_event_id,amount,paid');
    (tpays||[]).forEach(p => { if(p.paid) income += Number(p.amount)||tevAmounts[p.treas_event_id]||0; });

    // Expenses from expenses table
    const {data:expenses}=await supa.from('expenses').select('total_amount');
    const expense=(expenses||[]).reduce((s,e)=>s+Number(e.total_amount||0),0);
    const balance = income - expense;

    const fmt = v => '$' + Math.abs(v).toLocaleString('es-CL');
    const el = id => document.getElementById(id);
    if(el('kIncome'))  el('kIncome').textContent  = fmt(income);
    if(el('kExpense')) el('kExpense').textContent  = fmt(expense);
    if(el('kBalance')) el('kBalance').textContent  = fmt(balance);
    const balEl = document.querySelector('.treas-kpi.balance .treas-kpi-val');
    if(balEl) balEl.style.color = balance >= 0 ? 'var(--win)' : 'var(--danger)';
  } catch(e){ console.warn('renderTreasKPIs', e); }
}

// ── Treasurer events ─────────────────────────────────────
async function renderTreasEvents(){
  const list = document.getElementById('treasEventsList');
  if(!list || !supa || !IS_CONNECTED) return;
  list.innerHTML = '';
  try{
    const { data:events } = await supa.from('treas_events').select('*').order('created_at',{ascending:false});
    if(!events?.length){
      list.innerHTML='<div class="empty-state"><span class="empty-state-icon">💸</span>No hay eventos especiales</div>'; return;
    }
    for(const ev of events){
      const { data:pays } = await supa.from('treas_event_payments').select('*').eq('treas_event_id',ev.id);
      const { data:pl } = await supa.from('players').select('id,apodo,nombre,celular').order('apodo',{ascending:true});
      const playerMap = Object.fromEntries((pl||[]).map(p=>[p.id,p]));

      const card = document.createElement('div'); card.className='treas-event-card';

      const head = document.createElement('div'); head.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
      const ht = document.createElement('div');
      ht.innerHTML='<div class="treas-event-title">'+escapeHTML(ev.title||'')+'</div><div class="treas-event-meta">'+(ev.date||'')+(ev.notes?' · '+escapeHTML(ev.notes):'')+'</div>';
      const editB = document.createElement('button'); editB.className='fee-edit-btn'; editB.textContent='✏️ Editar';
      editB.addEventListener('click', () => openTreasEventModal(ev));
      head.appendChild(ht); head.appendChild(editB); card.appendChild(head);

      for(const pay of (pays||[])){
        const pdata = playerMap[pay.player_id]; if(!pdata) continue;
        const row = document.createElement('div'); row.className='treas-player-row';
        const nm = document.createElement('span'); nm.className='treas-player-name'; nm.textContent=pdata.apodo||pdata.nombre||'—';
        const amt = document.createElement('span'); amt.style.cssText='font-size:12px;color:var(--muted);margin-right:6px';
        amt.textContent = '$'+(Number(pay.amount)||0).toLocaleString('es-CL');
        const toggle = document.createElement('span'); toggle.className='fee-toggle '+(pay.paid?'paid':'unpaid');
        toggle.textContent=pay.paid?'✅ Pagó':'❌ Debe'; toggle.style.cursor='pointer';
        toggle.addEventListener('click', async ()=>{
          const np=!pay.paid;
          await supa.from('treas_event_payments').upsert([{treas_event_id:ev.id,player_id:pay.player_id,amount:pay.amount,paid:np,paid_at:np?new Date().toISOString():null}],{onConflict:'treas_event_id,player_id'});
          pay.paid=np; toggle.className='fee-toggle '+(np?'paid':'unpaid'); toggle.textContent=np?'✅ Pagó':'❌ Debe';
          waLink.style.display=np?'none':'';
          renderTreasKPIs();
        });
        // WA reminder
        const waLink = document.createElement('a'); waLink.className='btn-wa'; waLink.target='_blank'; waLink.rel='noopener noreferrer';
        const phone = (pdata.celular||'').replace(/\D/g,'').replace(/^(\+?56)?/,'');
        const msg = 'Hola '+(pdata.apodo||pdata.nombre||'')+' 👋 Te recordamos que tenés pendiente *'+ev.title+'* por $'+(Number(pay.amount)||0).toLocaleString('es-CL')+' del equipo Golden Moms 💚';
        waLink.href = phone ? 'https://wa.me/56'+phone+'?text='+encodeURIComponent(msg) : '#';
        if(!phone) waLink.addEventListener('click',e=>{e.preventDefault();navigator.clipboard?.writeText(msg);showToast('Mensaje copiado');});
        waLink.innerHTML = WA_ICON + ' Recordar';
        waLink.style.display = pay.paid?'none':'';
        row.appendChild(nm); row.appendChild(amt); row.appendChild(toggle); row.appendChild(waLink);
        card.appendChild(row);
      }

      // Group reminder button
      if((pays||[]).some(p=>!p.paid)){
        const grpBtn = document.createElement('button'); grpBtn.className='btn'; grpBtn.style.cssText='margin-top:10px;width:100%';
        grpBtn.innerHTML = WA_ICON + ' Recordatorio grupal';
        grpBtn.addEventListener('click', ()=>{
          const unpaid = (pays||[]).filter(p=>!p.paid).map(p=>{ const pd=playerMap[p.player_id]; return pd?pd.apodo||pd.nombre:''; }).filter(Boolean);
          const msg2 = '📢 *Recordatorio — '+ev.title+'*\n\nFalta pago de:\n'+unpaid.map(n=>'• '+n).join('\n')+'\n\nContacten a la tesorera para regularizar 💚';
          navigator.share ? navigator.share({text:msg2}).catch(()=>{}) : (navigator.clipboard?.writeText(msg2).then(()=>showToast('Copiado')));
        });
        card.appendChild(grpBtn);
      }
      list.appendChild(card);
    }
  } catch(e){ console.error('renderTreasEvents',e); }
}

// ── Open / close treasurer event modal ───────────────────
async function openTreasEventModal(ev=null){
  editingTreasEventId = ev?.id || null;
  document.getElementById('treasEventModalTitle').textContent = ev ? 'Editar evento' : 'Nuevo evento especial';
  document.getElementById('te_title').value  = ev?.title  || '';
  document.getElementById('te_amount').value = ev?.amount || '';
  document.getElementById('te_team').value   = ev?.team   || 'Golden Moms';
  document.getElementById('te_date').value   = ev?.date   || '';
  document.getElementById('te_notes').value  = ev?.notes  || '';
  document.getElementById('btnDeleteTreasEvent').style.display = ev ? '' : 'none';

  // Load players for team
  await loadTreasEventPlayers(ev?.team||'Golden Moms', ev?.id||null);
  document.getElementById('treasEventModalBg').style.display = 'flex';
}

async function loadTreasEventPlayers(team, eventId){
  const grid = document.getElementById('te_players_grid');
  grid.innerHTML = '<span style="color:var(--muted);font-size:12px">Cargando…</span>';
  const { data:players } = await supa.from('players')
    .select('id,apodo,nombre')
    .eq('estado','activo')
    .order('apodo',{ascending:true});
  let existingPays = {};
  if(eventId){
    const { data:pays } = await supa.from('treas_event_payments').select('player_id,amount,paid').eq('treas_event_id',eventId);
    (pays||[]).forEach(p=>{ existingPays[p.player_id]={amount:p.amount,paid:p.paid}; });
  }
  const baseAmount = Number(document.getElementById('te_amount').value)||0;
  const allTeam = team === 'Golden Moms' ? players : (players||[]).filter(p=>{
    // filter by team via separate query — simplified: show all active for now
    return true;
  });
  grid.innerHTML='';
  (allTeam||[]).forEach(p=>{
    const row=document.createElement('div'); row.className='treas-player-row';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.dataset.pid=p.id;
    chk.className='te-player-chk'; chk.checked=!!existingPays[p.id];
    const nm=document.createElement('span'); nm.className='treas-player-name'; nm.textContent=p.apodo||p.nombre||'—';
    const amtIn=document.createElement('input'); amtIn.type='number'; amtIn.className='treas-amount-input';
    amtIn.dataset.pid=p.id; amtIn.placeholder='$';
    amtIn.value=existingPays[p.id]?.amount||baseAmount||'';
    row.appendChild(chk); row.appendChild(nm); row.appendChild(amtIn);
    grid.appendChild(row);
  });
}

document.getElementById('te_team')?.addEventListener('change', ()=>{
  loadTreasEventPlayers(document.getElementById('te_team').value, editingTreasEventId);
});
document.getElementById('te_amount')?.addEventListener('input', ()=>{
  const v = document.getElementById('te_amount').value;
  document.querySelectorAll('.treas-amount-input').forEach(inp=>{ if(!inp.value||inp.value==='0') inp.value=v; });
});

function closeTreasEventModal(){
  document.getElementById('treasEventModalBg').style.display='none';
  editingTreasEventId=null;
}
document.getElementById('btnCancelTreasEvent')?.addEventListener('click', closeTreasEventModal);
document.getElementById('treasEventModalBg')?.addEventListener('click', e=>{ if(e.target===document.getElementById('treasEventModalBg')) closeTreasEventModal(); });

document.getElementById('btnSaveTreasEvent')?.addEventListener('click', async ()=>{
  const title = document.getElementById('te_title').value.trim();
  if(!title){ alert('Falta el nombre del evento'); return; }
  const payload = {
    title,
    amount: Number(document.getElementById('te_amount').value)||0,
    team:   document.getElementById('te_team').value,
    date:   document.getElementById('te_date').value||null,
    notes:  document.getElementById('te_notes').value.trim()||null
  };
  try{
    let evId = editingTreasEventId;
    if(evId){
      await supa.from('treas_events').update(payload).eq('id',evId);
    } else {
      const {data} = await supa.from('treas_events').insert([payload]).select('id');
      evId = data?.[0]?.id;
    }
    // Save player amounts
    const rows = document.querySelectorAll('.te-player-chk');
    const upserts = [];
    rows.forEach(chk=>{
      if(!chk.checked) return;
      const pid = chk.dataset.pid;
      const amtEl = document.querySelector('.treas-amount-input[data-pid="'+pid+'"]');
      upserts.push({ treas_event_id:evId, player_id:pid, amount:Number(amtEl?.value)||0, paid:false });
    });
    if(upserts.length){
      await supa.from('treas_event_payments').upsert(upserts,{onConflict:'treas_event_id,player_id'});
    }
    closeTreasEventModal(); renderTreasKPIs();
    showToast('✅ Evento guardado');
  } catch(e){ alert('Error: '+(e.message||e)); }
});

document.getElementById('btnDeleteTreasEvent')?.addEventListener('click', async ()=>{
  if(!editingTreasEventId || !confirm('¿Eliminar este evento?')) return;
  await supa.from('treas_event_payments').delete().eq('treas_event_id',editingTreasEventId);
  await supa.from('treas_events').delete().eq('id',editingTreasEventId);
  closeTreasEventModal(); renderTreasKPIs();
});

/* ═══════════════════════════════════════════════════════════
   STANDINGS TABS
   ══════════════════════════════════════════════════════════ */
function switchStandTab(n){
  document.getElementById('standView1').style.display = n===1?'':'none';
  document.getElementById('standView2').style.display = n===2?'':'none';
  document.getElementById('standTab1').classList.toggle('active', n===1);
  document.getElementById('standTab2').classList.toggle('active', n===2);
  if(n===2) loadTournaments();
}


export {
  renderFees, renderTreasKPIs, renderExpenses,
  loadNotifications, loadNotificationsAdmin, updateBell,
  checkTreasAuth, setTreasAuth, hideTreasLock,
  preloadMonthlyCuotas, switchStandTab
};
