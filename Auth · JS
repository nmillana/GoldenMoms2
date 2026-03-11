/* ═══════════════════════════════════════════════════════
   auth.js — Autenticación por jugadora (Supabase Auth + hash fallback)
   ═══════════════════════════════════════════════════════ */
'use strict';
import { supa, IS_CONNECTED, currentUser, setCurrentUser, loginFoundUser, setLoginFoundUser } from './state.js';
import { showToast, showError } from './helpers.js';
import { showView } from './router.js';
import { renderPlayerDash, updateUserUI } from './dashboard.js';
import { loadNotifications } from './fees.js';
import { addAdminControls } from './router.js';

/* ═══════════════════════════════════════════════════════════
   AUTH — Login por jugadora
   ══════════════════════════════════════════════════════════ */
const AUTH_KEY = 'gm_player_session';
let currentUser = null; // { player_id, username, role, apodo, nombre, numero_camiseta }

// ── SHA-256 hash ──────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── Session persistence ───────────────────────────────────
function loadSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if(raw) currentUser = JSON.parse(raw);
  } catch(e) { currentUser = null; }
}
function saveSession(user) {
  currentUser = user;
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch(e) {}
}
function clearSession() {
  currentUser = null;
  try { sessionStorage.removeItem(AUTH_KEY); } catch(e) {}
}

// ── Login flow ────────────────────────────────────────────
let loginFoundUser = null; // player_user row found in step 1

async function initAuth() {
  loadSession();
  if(currentUser) {
    hideLoginScreen();
    updateUserUI();
    return;
  }
  showLoginScreen();
}

function showLoginScreen() {
  const el = document.getElementById('loginScreen');
  if(el) el.style.display = 'flex';
}
function hideLoginScreen() {
  const el = document.getElementById('loginScreen');
  if(el) el.style.display = 'none';
}

// Step 1: check username
document.getElementById('loginNextBtn')?.addEventListener('click', loginStep1);
document.getElementById('loginUser')?.addEventListener('keydown', e => { if(e.key==='Enter') loginStep1(); });

async function loginStep1() {
  const username = (document.getElementById('loginUser')?.value||'').trim().toLowerCase();
  const err1 = document.getElementById('loginErr1');
  if(!username) { err1.textContent='Ingresá tu usuario'; return; }
  if(!supa || !IS_CONNECTED) { err1.textContent='Sin conexión. Esperá un momento…'; return; }
  err1.textContent = '';
  document.getElementById('loginNextBtn').textContent = 'Buscando…';
  try {
    const { data, error } = await supa.from('player_users')
      .select('*, players(id,apodo,nombre,numero_camiseta,foto,rol,email)')
      .eq('username', username)
      .eq('active', true)
      .maybeSingle();
    document.getElementById('loginNextBtn').textContent = 'Continuar →';
    if(error || !data) { err1.textContent='Usuario no encontrado'; return; }
    loginFoundUser = data;
    // Show step 2
    document.getElementById('loginStep1').style.display = 'none';
    const step2 = document.getElementById('loginStep2');
    step2.style.display = '';
    const pl = data.players;
    const name = pl?.apodo || pl?.nombre || username;
    document.getElementById('loginAvatar').textContent = name[0].toUpperCase();
    document.getElementById('loginPlayerName').textContent = name;
    document.getElementById('loginPlayerRole').textContent = data.role === 'admin' ? '⭐ Administradora' : '⚽ Jugadora';
    if(pl?.foto) {
      const av = document.getElementById('loginAvatar');
      av.style.backgroundImage='url('+pl.foto+')'; av.style.backgroundSize='cover'; av.textContent='';
    }
    setTimeout(() => document.getElementById('loginPwd')?.focus(), 100);
  } catch(err) {
    document.getElementById('loginNextBtn').textContent = 'Continuar →';
    err1.textContent = 'Error al buscar usuario';
    console.warn(err);
  }
}

// Step 2: verify password
document.getElementById('loginSubmitBtn')?.addEventListener('click', loginStep2);
document.getElementById('loginPwd')?.addEventListener('keydown', e => { if(e.key==='Enter') loginStep2(); });
document.getElementById('loginBackBtn')?.addEventListener('click', () => {
  document.getElementById('loginStep2').style.display='none';
  document.getElementById('loginStep1').style.display='';
  document.getElementById('loginPwd').value='';
  document.getElementById('loginErr2').textContent='';
  loginFoundUser = null;
});

async function loginStep2() {
  const pwd = document.getElementById('loginPwd')?.value||'';
  const err2 = document.getElementById('loginErr2');
  if(!pwd) { err2.textContent='Ingresá tu contraseña'; return; }
  err2.textContent='';
  document.getElementById('loginSubmitBtn').textContent='Verificando…';
  try {
    const pl = loginFoundUser.players;
    const email = pl?.email || loginFoundUser.email || '';

    // ── Opción A: Supabase Auth (si la jugadora tiene email registrado) ──
    if(email && supa.auth) {
      const { data: authData, error: authError } = await supa.auth.signInWithPassword({
        email,
        password: pwd,
      });
      if(authError) {
        // If Supabase Auth fails, fall through to hash verification
        // (for users not yet migrated to Supabase Auth)
        const hash = await sha256(pwd);
        if(hash !== loginFoundUser.pwd_hash) {
          err2.textContent = 'Contraseña incorrecta';
          document.getElementById('loginSubmitBtn').textContent = '🔓 Entrar';
          document.getElementById('loginPwd').value = '';
          return;
        }
      }
    } else {
      // ── Opción B: Hash local (fallback para usuarios sin email) ──
      const hash = await sha256(pwd);
      if(hash !== loginFoundUser.pwd_hash) {
        err2.textContent = 'Contraseña incorrecta';
        document.getElementById('loginSubmitBtn').textContent = '🔓 Entrar';
        document.getElementById('loginPwd').value = '';
        return;
      }
    }

    // ── Login exitoso ──
    const user = {
      player_id: pl.id,
      username: loginFoundUser.username,
      role: loginFoundUser.role,
      apodo: pl.apodo||'',
      nombre: pl.nombre||'',
      numero_camiseta: pl.numero_camiseta,
      foto: pl.foto||''
    };
    saveSession(user);
    hideLoginScreen();
    updateUserUI();
    showView('dash');
    renderPlayerDash();
  } catch(err) {
    err2.textContent = 'Error de conexión, intentá de nuevo';
    document.getElementById('loginSubmitBtn').textContent = '🔓 Entrar';
    console.warn(err);
  }
}

// ── Update UI after login ─────────────────────────────────
function updateUserUI() {
  if(!currentUser) return;
  const pill = document.getElementById('userPill');
  const pillAv = document.getElementById('userPillAv');
  const pillName = document.getElementById('userPillName');
  if(pill) pill.style.display = 'flex';
  const name = currentUser.apodo || currentUser.nombre || currentUser.username;
  if(pillAv) pillAv.textContent = name[0].toUpperCase();
  if(pillName) pillName.textContent = name;

  // Hide admin-only nav items for regular players
  const isAdmin = currentUser.role === 'admin';
  const feesTab = document.querySelector('.nav .tab[data-view="fees"]');
  if(feesTab) feesTab.style.display = isAdmin ? '' : 'none';
  const mSel = document.getElementById('mobileNavSelect');
  if(mSel){
    // Remove fees option if not admin (mobile dropdown)
    const feeOpt = mSel.querySelector('option[value="fees"]');
    if(feeOpt) feeOpt.style.display = isAdmin ? '' : 'none';
    // Set current view in dropdown
    mSel.value = 'dash';
  }
}

// ── Logout ────────────────────────────────────────────────
function showLogoutMenu() {
  if(!currentUser) return;
  const name = currentUser.apodo || currentUser.nombre || currentUser.username;
  if(confirm('¿Cerrar sesión de ' + name + '?')) {
    clearSession();
    // Reset UI
    const pill = document.getElementById('userPill');
    if(pill) pill.style.display = 'none';
    document.getElementById('loginUser').value='';
    document.getElementById('loginPwd').value='';
    document.getElementById('loginStep1').style.display='';
    document.getElementById('loginStep2').style.display='none';
    document.getElementById('playerDashCard').style.display='none';
    showLoginScreen();
    loginFoundUser = null;
  }
}

// ── Player personal dashboard ─────────────────────────────
async function renderPlayerDash() {
  const card = document.getElementById('playerDashCard');
  const pdName = document.getElementById('pdName');
  const pdRole = document.getElementById('pdRole');
  const pdItems = document.getElementById('pdItems');
  if(!card || !currentUser) return;

  const name = currentUser.apodo || currentUser.nombre || 'Jugadora';
  if(pdName) pdName.textContent = 'Hola, ' + name + ' 👋';
  if(pdRole) pdRole.textContent = currentUser.role==='admin' ? '⭐ Administradora' : '⚽ Jugadora · #'+(currentUser.numero_camiseta||'—');
  card.style.display = '';
  if(pdItems) pdItems.innerHTML = '<div style="font-size:12px;opacity:.7">Cargando tus pendientes…</div>';

  if(!supa || !IS_CONNECTED || !currentUser.player_id) return;
  const items = [];
  const pid = currentUser.player_id;

  try {
    // 1. Asistencia pendiente (mis eventos con Duda)
    const now = new Date();
    const { data:attRows } = await supa.from('attendance')
      .select('event_id, status, events(id,title,datetime,type)')
      .eq('player_id', pid)
      .eq('status', 'Duda')
      .gte('events.datetime', now.toISOString());
    const pendingAtt = (attRows||[]).filter(a=>a.events);
    if(pendingAtt.length) {
      items.push({
        icon:'⏳', title: pendingAtt.length + ' evento'+(pendingAtt.length>1?'s':'')+' sin confirmar',
        sub: pendingAtt.map(a=>{
          const d=new Date(a.events.datetime);
          return a.events.title+' · '+d.toLocaleDateString('es-CL',{weekday:'short',day:'2-digit',month:'short'});
        }).slice(0,3).join(' | '),
        badge: pendingAtt.length,
        action: () => showView('events')
      });
    }

    // 2. Cuotas pendientes (fee_payments con paid=false)
    const { data:feeRows } = await supa.from('fee_payments')
      .select('paid, fees(title,amount,due_date)')
      .eq('player_id', pid)
      .eq('paid', false);
    const pendingFees = (feeRows||[]).filter(f=>f.fees);
    if(pendingFees.length) {
      const total = pendingFees.reduce((s,f)=>s+Number(f.fees?.amount||0),0);
      items.push({
        icon:'💰', title: pendingFees.length + ' cuota'+(pendingFees.length>1?'s':'')+' pendiente'+(pendingFees.length>1?'s':''),
        sub: pendingFees.map(f=>f.fees.title).slice(0,3).join(', ') + (total?'  ·  Total: $'+total.toLocaleString('es-CL'):''),
        badge: pendingFees.length,
        action: null
      });
    }

    // 3. Egresos pendientes (expense_payments con paid=false)
    const { data:expRows } = await supa.from('expense_payments')
      .select('amount, paid, expenses(title)')
      .eq('player_id', pid)
      .eq('paid', false);
    const pendingExp = (expRows||[]).filter(e=>e.expenses);
    if(pendingExp.length) {
      const totalExp = pendingExp.reduce((s,e)=>s+Number(e.amount||0),0);
      items.push({
        icon:'📤', title: pendingExp.length + ' cobro'+(pendingExp.length>1?'s':'')+' pendiente'+(pendingExp.length>1?'s':''),
        sub: pendingExp.map(e=>e.expenses.title+' $'+Number(e.amount||0).toLocaleString('es-CL')).slice(0,3).join(' | ') + '  ·  Total: $'+totalExp.toLocaleString('es-CL'),
        badge: pendingExp.length,
        action: null
      });
    }

    if(!items.length) {
      if(pdItems) pdItems.innerHTML = '<div style="font-size:13px;opacity:.85;text-align:center;padding:8px 0">✅ Todo al día — sin pendientes</div>';
      return;
    }
    if(pdItems) {
      pdItems.innerHTML='';
      items.forEach(item=>{
        const div = document.createElement('div');
        div.className = 'player-dash-item';
        div.innerHTML =
          '<span class="player-dash-item-icon">'+item.icon+'</span>'+
          '<div class="player-dash-item-text">'+
            '<div class="player-dash-item-title">'+item.title+'</div>'+
            '<div class="player-dash-item-sub">'+item.sub+'</div>'+
          '</div>'+
          '<span class="player-dash-item-badge">'+item.badge+'</span>';
        if(item.action) div.addEventListener('click', item.action);
        pdItems.appendChild(div);
      });
    }
  } catch(err) { console.warn('renderPlayerDash', err); }
}

// ── Filter notifications for current player ───────────────
// Override loadNotifications to filter by player when logged in as jugadora
async function loadNotifications() {
  if(!currentUser || currentUser.role === 'admin') {
    await loadNotificationsAdmin();
    return;
  }
  // Jugadora: show only HER pending attendance
  if(!supa || !IS_CONNECTED) return;
  try {
    const now = new Date();
    const future = new Date(now); future.setDate(future.getDate()+14);
    const { data:attRows } = await supa.from('attendance')
      .select('event_id, status, events(id,title,datetime,team,type)')
      .eq('player_id', currentUser.player_id)
      .eq('status','Duda')
      .gte('events.datetime', now.toISOString())
      .lte('events.datetime', future.toISOString());
    const pending = (attRows||[]).filter(a=>a.events).map(a=>{
      const ev=a.events;
      const d=new Date(ev.datetime);
      return {
        id:ev.id, title:ev.title,
        dateStr:d.toLocaleDateString('es-CL',{weekday:'short',day:'2-digit',month:'short'}),
        timeStr:d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}),
        team:ev.team, type:ev.type, event:ev,
        pendingCount:1, total:1
      };
    });
    updateBell(pending);
  } catch(err){ console.warn('loadNotifications player', err); }
}

// ── Admin panel: manage player_users ─────────────────────
async function openUserManagement() {
  if(!currentUser || currentUser.role !== 'admin') return;
  // Load all players without accounts and show management UI
  const { data:players } = await supa.from('players').select('id,apodo,nombre,numero_camiseta,estado').eq('estado','activo').order('apodo');
  const { data:users } = await supa.from('player_users').select('*');
  const userMap = Object.fromEntries((users||[]).map(u=>[u.player_id,u]));

  const existing = document.getElementById('userMgmtModal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id='userMgmtModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:800;display:flex;align-items:center;justify-content:center;padding:16px';

  const rows = (players||[]).map(p=>{
    const u = userMap[p.id];
    const name = p.apodo||p.nombre||'?';
    return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">'+
      '<span style="font-weight:600">'+name+(p.numero_camiseta?' #'+p.numero_camiseta:'')+'</span>'+
      (u ? '<span style="color:var(--win);font-size:11px">✅ @'+u.username+'</span>' : '<span style="color:var(--muted-2);font-size:11px">Sin cuenta</span>')+
      '<button class="btn" style="font-size:11px;padding:4px 8px" onclick="createOrEditUser(\''+p.id+'\',\''+name.replace(/'/g,'')+'\')">'+(u?'✏️ Editar':'＋ Crear')+'</button>'+
    '</div>';
  }).join('');

  modal.innerHTML =
    '<div style="background:var(--surface);border-radius:var(--r-lg);padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:var(--sh-3)">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'+
      '<div style="font-family:var(--font-head);font-weight:800;font-size:17px">👤 Gestión de usuarios</div>'+
      '<button class="btn" onclick="document.getElementById(\'userMgmtModal\').remove()">✕</button>'+
    '</div>'+
    '<div>'+rows+'</div>'+
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
}

async function createOrEditUser(playerId, playerName) {
  const { data:existing } = await supa.from('player_users').select('*').eq('player_id',playerId).maybeSingle();
  const username = prompt('Usuario para '+playerName+':', existing?.username || '');
  if(!username) return;
  const pwd = prompt('Contraseña (dejar vacío para no cambiar):', '');
  const role = confirm('¿Es administradora?\n(OK = Admin, Cancelar = Jugadora)') ? 'admin' : 'jugadora';
  const upsertData = { player_id:playerId, username:username.toLowerCase().trim(), role, active:true };
  if(pwd?.trim()) {
    upsertData.pwd_hash = await sha256(pwd.trim());
  } else if(!existing) {
    // New user needs password
    showToast('⚠️ Debes ingresar una contraseña'); return;
    return;
  }
  if(existing) {
    await supa.from('player_users').update(upsertData).eq('id',existing.id);
  } else {
    await supa.from('player_users').insert([upsertData]);
  }
  showToast('✅ Usuario guardado');
  openUserManagement();
}

// Hook into admin topbar: add users button after login
function addAdminControls() {
  if(!currentUser || currentUser.role !== 'admin') return;
  // Add "Usuarios" button to topbar
  const existing = document.getElementById('adminUsersBtn');
  if(existing) return;
  const btn = document.createElement('button');
  btn.id='adminUsersBtn'; btn.className='btn'; btn.textContent='👤 Usuarios';
  btn.style.cssText='font-size:11px;padding:4px 10px';
  btn.addEventListener('click', openUserManagement);
  const pill = document.getElementById('userPill');
  if(pill) pill.parentNode.insertBefore(btn, pill);
}

export { initAuth, updateUserUI, renderPlayerDash, addAdminControls, showLogoutMenu, sha256 };
