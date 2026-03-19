'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════════ */
const EVENT_TYPES = { TRAIN: 'Entrenamiento', MATCH: 'Partido', EVENT: 'Evento' };
const TEAMS = { GM: 'Golden Moms', DR: 'Dreams', PW: 'Power' };
const ALL_TEAMS = [TEAMS.GM, TEAMS.DR, TEAMS.PW];

function teamBadgeClass(team){
  if(team === TEAMS.DR) return 'ev-team-dr';
  if(team === TEAMS.PW) return 'ev-team-pw';
  return 'ev-team-gm';
}

/* Cache de jugadoras para convocatoria */
let allPlayers = [];

/* ═══════════════════════════════════════════════════════════
   SUPABASE
   ══════════════════════════════════════════════════════════ */
const SUPA_CONFIG = {
  url: "https://xglojvvbgaivwbpdxvne.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbG9qdnZiZ2FpdndicGR4dm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjEzMjQsImV4cCI6MjA3MDY5NzMyNH0.vQOBuvphgm0iue-lybJoBVhyai7RtRp8Tfn-hGIKKgw"
};
let supa = null;
let IS_CONNECTED = false;
let IS_CONNECTING = false;
let supaInitPromise = null;

async function initSupabase(timeoutMs = 8000){
  if(supaInitPromise) return supaInitPromise;
  IS_CONNECTING = true;
  updateConnStatus();
  supaInitPromise = (async () => {
    try{
      if(typeof createClient === 'function'){
        supa = createClient(SUPA_CONFIG.url, SUPA_CONFIG.key);
      } else if(window.supabase?.createClient){
        supa = window.supabase.createClient(SUPA_CONFIG.url, SUPA_CONFIG.key);
      } else {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js';
          s.async = true;
          let done = false;
          const to = setTimeout(() => { if(!done){ done=true; reject(new Error('timeout')); }}, timeoutMs);
          s.onload  = () => { if(done) return; done=true; clearTimeout(to); resolve(); };
          s.onerror = () => { if(done) return; done=true; clearTimeout(to); reject(new Error('load error')); };
          document.head.appendChild(s);
        });
        if(typeof createClient === 'function') supa = createClient(SUPA_CONFIG.url, SUPA_CONFIG.key);
        else if(window.supabase?.createClient) supa = window.supabase.createClient(SUPA_CONFIG.url, SUPA_CONFIG.key);
      }
      const test = await supa.from('events').select('id').limit(1);
      IS_CONNECTED = !test?.error;
      if(test?.error) console.warn('Supabase test error:', test.error);
    } catch(err){
      console.error('initSupabase:', err);
      supa = null;
      IS_CONNECTED = false;
    } finally {
      IS_CONNECTING = false;
      updateConnStatus();
      supaInitPromise = null;
    }
    return IS_CONNECTED;
  })();
  return supaInitPromise;
}

async function ensureSupabaseReady(timeoutMs = 8000){
  if(supa && IS_CONNECTED) return true;
  const deadline = Date.now() + timeoutMs;
  while(Date.now() < deadline){
    if(supa && IS_CONNECTED) return true;
    if(!supaInitPromise) initSupabase(timeoutMs).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  if(supa && IS_CONNECTED) return true;
  if(!supaInitPromise){
    try { await initSupabase(timeoutMs); } catch(err) {}
  }
  return !!(supa && IS_CONNECTED);
}

function updateConnStatus(){
  const el = document.getElementById('connStatus');
  if(!el) return;
  if(IS_CONNECTING){
    el.textContent = '? Conectando...';
    el.className = 'connecting';
    return;
  }
  if(IS_CONNECTED){
    el.textContent = '? Conectado';
    el.className = 'online';
  } else {
    el.textContent = '? Sin conexi?n';
    el.className = 'offline';
  }
}

function escapeHTML(str){
  if(str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function pad(n){ return n.toString().padStart(2,'0'); }

// Para fechas CON hora (events.datetime → timestamp with time zone)
// new Date(iso) es correcto porque viene con offset explícito.
function safeDate(iso){
  if(!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Para fechas SIN hora (fecha_nacimiento, proximo_cumple → tipo `date` en PG).
// "2025-03-14" → new Date("2025-03-14") = UTC midnight → en Chile aparece como 13 mar.
// Parseamos manualmente para quedarnos en hora local.
function safeDateOnly(str){
  if(!str) return null;
  // Si tiene hora (timestamp), usar safeDate normal
  if(str.includes('T') || str.includes(' ')) return safeDate(str);
  const [y, m, d] = str.split('-').map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m - 1, d); // constructor local, sin UTC
}

function localInputToISOWithOffset(inp){
  if(!inp) return null;
  const [d, t] = inp.split('T');
  const offMin = -new Date().getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  return `${d}T${t}:00${sign}${pad(Math.floor(abs/60))}:${pad(abs%60)}`;
}
function isoToLocalInput(iso){
  if(!iso) return '';
  const d = safeDate(iso);
  if(!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localDateYMD(d){
  const D = new Date(d);
  return `${D.getFullYear()}-${pad(D.getMonth()+1)}-${pad(D.getDate())}`;
}

let pendingAttendanceLinkId = null;
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getDialogElement(backdrop){
  return backdrop?.querySelector('[role="dialog"]') || backdrop?.querySelector('.modal, .modal-wide') || backdrop;
}
function getFocusableElements(container){
  return [...(container?.querySelectorAll(FOCUSABLE_SELECTOR) || [])].filter(el => {
    if(!(el instanceof HTMLElement)) return false;
    if(el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    return el.offsetParent !== null || el === document.activeElement;
  });
}
function openDialog(backdrop, focusTarget){
  if(!backdrop) return;
  const dialog = getDialogElement(backdrop);
  if(dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
  backdrop.__lastFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  backdrop.style.display = 'flex';
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const target = focusTarget || getFocusableElements(dialog)[0] || dialog;
  requestAnimationFrame(() => {
    if(target && typeof target.focus === 'function') target.focus();
  });
}
function closeDialog(backdrop){
  if(!backdrop) return;
  backdrop.style.display = 'none';
  backdrop.setAttribute('aria-hidden', 'true');
  if(!document.querySelector('.modal-bg[aria-hidden="false"]')) document.body.classList.remove('modal-open');
  const lastFocus = backdrop.__lastFocusEl;
  backdrop.__lastFocusEl = null;
  if(lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') lastFocus.focus();
}
function trapDialogFocus(backdrop, event){
  const dialog = getDialogElement(backdrop);
  const focusable = getFocusableElements(dialog);
  if(!focusable.length){
    event.preventDefault();
    if(dialog && typeof dialog.focus === 'function') dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if(event.shiftKey && document.activeElement === first){
    event.preventDefault();
    last.focus();
    return;
  }
  if(!event.shiftKey && document.activeElement === last){
    event.preventDefault();
    first.focus();
  }
}
function setBellExpanded(isOpen){
  document.getElementById('bellBtn')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
function activateNavTab(view){
  document.querySelectorAll('.nav .tab').forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  const mobileNav = document.getElementById('mobileNavSelect');
  if(mobileNav && mobileNav.value !== view) mobileNav.value = view;
}
function syncTabPanels(view){
  document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
    const isActive = panel.id === 'v-' + view;
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}
async function ensureXlsxLib(){
  if(window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar XLSX'));
    document.head.appendChild(script);
  });
  if(!window.XLSX) throw new Error('No se pudo cargar el exportador Excel');
  return window.XLSX;
}
async function openAttendanceFromLink(eventId){
  if(!eventId || !currentUser || !supa || !IS_CONNECTED) return false;
  activateNavTab('events');
  showView('events');
  closeModal();
  closePlayerModal();
  closeNotifDropdown();
  try {
    const { data: ev, error } = await supa.from('events').select('*').eq('id', eventId).maybeSingle();
    if(error || !ev){
      showToast('No se encontro el evento');
      return false;
    }
    setTimeout(() => openAttModal(ev), 250);
    return true;
  } catch(err) {
    console.warn('Attendance deep link error:', err);
    showToast('No se pudo abrir la asistencia');
    return false;
  }
}

document.addEventListener('keydown', event => {
  const openBackdrop = document.querySelector('.modal-bg[aria-hidden="false"]');
  if(!openBackdrop) return;
  if(event.key === 'Escape'){
    const closeHandlers = {
      modalBg: closeModal,
      playerModalBg: closePlayerModal,
      attModalBg: closeAttModal,
      resultModalBg: closeResultModal,
      annModalBg: closeAnnModal,
      feeModalBg: closeFeeModal,
      treasEventModalBg: closeTreasEventModal,
      expenseModalBg: closeExpenseModal
    };
    const closeHandler = closeHandlers[openBackdrop.id];
    if(typeof closeHandler === 'function'){
      event.preventDefault();
      closeHandler();
    }
    return;
  }
  if(event.key === 'Tab') trapDialogFocus(openBackdrop, event);
});

/* ═══════════════════════════════════════════════════════════
   MODAL EVENTOS
   ══════════════════════════════════════════════════════════ */
const modalBg    = document.getElementById('modalBg');
const f_title    = document.getElementById('f_title');
const f_type     = document.getElementById('f_type');
const f_dt       = document.getElementById('f_dt');
const f_team     = document.getElementById('f_team');
const f_opponent = document.getElementById('f_opponent');
const f_uniform  = document.getElementById('f_uniform');
const f_location = document.getElementById('f_location');
const btnDelete  = document.getElementById('btnDelete');
const btnCancel  = document.getElementById('btnCancel');
const btnSave    = document.getElementById('btnSave');

let editingEventId = null;
let selectedPlayerIds = new Set();

async function loadConvocatoria(team){
  const grid  = document.getElementById('convGrid');
  const title = document.getElementById('convTitle');
  grid.innerHTML = '';
  const loading = document.createElement('span');
  loading.style.cssText = 'color:var(--muted);font-size:12px';
  loading.textContent = 'Cargando…';
  grid.appendChild(loading);
  if(!supa || !IS_CONNECTED){ loading.textContent = 'Sin conexión'; return; }
  try{
    // Always reload to ensure 'equipos' field is present (other loads may omit it)
    const { data:convData, error:convErr } = await supa.from('players')
      .select('id, apodo, nombre, numero_camiseta, equipos, estado')
      .eq('estado','activo')
      .order('apodo', { ascending: true });
    if(convErr) throw convErr;
    const convPlayers = convData || [];
    // Also update global cache if needed
    if(!allPlayers.length) allPlayers = convPlayers;
    // Only show active players (not reposo) in convocatoria
    const activeConv = convPlayers.filter(p => !p.estado || p.estado === 'activo');
    // All teams are real — no team should mean "all". Filter by actual equipos field.
    const filtered = activeConv.filter(p => {
      const eq = p.equipos;
      if(!eq || (Array.isArray(eq) && !eq.length)) return team === TEAMS.GM;
      if(Array.isArray(eq)) return eq.includes(team);
      if(typeof eq === 'string'){
        try{ return JSON.parse(eq).includes(team); } catch(e){ return eq.includes(team); }
      }
      return false;
    });
    title.textContent = `👥 Convocatoria — ${team} (${filtered.length})`;
    grid.innerHTML = '';
    if(!filtered.length){
      const msg = document.createElement('span'); msg.style.cssText='color:var(--muted);font-size:12px';
      msg.textContent = `No hay jugadoras en ${team}`; grid.appendChild(msg); return;
    }
    for(const p of filtered){
      const btn = document.createElement('button'); btn.type='button';
      btn.className = 'conv-player' + (selectedPlayerIds.has(p.id) ? ' selected' : '');
      btn.dataset.id = p.id;
      if(p.numero_camiseta != null){
        const num = document.createElement('span'); num.className='conv-num'; num.textContent='#'+p.numero_camiseta; btn.appendChild(num);
      }
      const name = document.createElement('span'); name.textContent = p.apodo || p.nombre || '—'; btn.appendChild(name);
      btn.addEventListener('click', () => {
        if(selectedPlayerIds.has(p.id)){ selectedPlayerIds.delete(p.id); btn.classList.remove('selected'); }
        else { selectedPlayerIds.add(p.id); btn.classList.add('selected'); }
      });
      grid.appendChild(btn);
    }
  } catch(err){ console.error('loadConvocatoria', err); grid.innerHTML='<span style="color:var(--danger);font-size:12px">Error cargando jugadoras</span>'; }
}

async function loadAttendanceForEvent(eventId){
  selectedPlayerIds = new Set();
  if(!supa || !IS_CONNECTED || !eventId) return;
  try{
    const { data } = await supa.from('attendance').select('player_id, status').eq('event_id', eventId);
    for(const row of (data||[])){
      if(row.status === 'Asiste') selectedPlayerIds.add(row.player_id);
      // Also load existing statuses into attStatuses so Duda shows correctly
      if(row.status) attStatuses[row.player_id] = row.status;
    }
  } catch(err){ console.warn('loadAttendanceForEvent', err); }
}

async function saveAttendance(eventId){
  if(!supa || !IS_CONNECTED || !eventId) return;
  try{
    // Get the event's team so we can load the right players
    const { data: evData } = await supa.from('events').select('team,type').eq('id', eventId).maybeSingle();
    const evTeam = evData?.team || TEAMS.GM;

    // Determine which players to mark: selectedPlayerIds if any, else ALL active players of that team
    let targetIds = [...selectedPlayerIds];
    if(!targetIds.length){
      const { data: teamPlayers } = await supa.from('players')
        .select('id,equipos').eq('estado','activo');
      const allActive = (teamPlayers||[]).filter(p=>{
        const eq = p.equipos;
        if(!eq || (Array.isArray(eq) && !eq.length)) return evTeam === TEAMS.GM;
        if(Array.isArray(eq)) return eq.includes(evTeam);
        try{ return JSON.parse(eq||'[]').includes(evTeam); }catch(e){ return false; }
      });
      targetIds = allActive.map(p=>p.id);
    }

    if(!targetIds.length) return;

    // Fetch current statuses to not overwrite confirmed ones
    const { data: existing } = await supa.from('attendance').select('player_id,status').eq('event_id', eventId);
    const confirmedSet = new Set((existing||[]).filter(r=>r.status==='Asiste'||r.status==='No asiste').map(r=>r.player_id));
    const upserts = targetIds
      .filter(pid => !confirmedSet.has(pid))
      .map(pid => ({ event_id: eventId, player_id: pid, status: 'Duda', updated_at: new Date().toISOString() }));
    if(upserts.length) await supa.from('attendance').upsert(upserts, { onConflict: 'event_id,player_id' });
  } catch(err){ console.warn('saveAttendance', err); }
}

function openModal(opts = {}){
  document.getElementById('modalTitle').textContent = opts.existing ? 'Editar evento' : 'Nuevo evento';
  editingEventId = null; selectedPlayerIds = new Set();
  if(opts.existing){
    const e = opts.existing;
    editingEventId   = e.id;
    f_title.value    = e.title    || '';
    f_type.value     = e.type     || EVENT_TYPES.TRAIN;
    f_dt.value       = isoToLocalInput(e.datetime);
    f_team.value     = e.team     || TEAMS.GM;
    f_opponent.value = e.opponent || '';
    f_uniform.value  = e.uniform  || '';
    f_location.value = e.location || '';
    btnDelete.style.display = '';
    loadAttendanceForEvent(e.id).then(() => loadConvocatoria(f_team.value));
  } else {
    f_title.value=''; f_type.value=EVENT_TYPES.TRAIN;
    const base = opts.date ? new Date(opts.date) : new Date();
    base.setHours(19,30,0,0);
    f_dt.value       = isoToLocalInput(base.toISOString());
    f_team.value     = opts.team || TEAMS.GM;
    f_opponent.value=''; f_uniform.value=''; f_location.value='';
    btnDelete.style.display = 'none';
    loadConvocatoria(f_team.value);
  }
  openDialog(modalBg, f_title);
}
function closeModal(){ closeDialog(modalBg); editingEventId=null; }

f_team.addEventListener('change', () => { selectedPlayerIds=new Set(); loadConvocatoria(f_team.value); });
modalBg.addEventListener('click', e => { if(e.target===modalBg) closeModal(); });
btnCancel.addEventListener('click', closeModal);

btnDelete.addEventListener('click', async () => {
  if(!editingEventId) return;
  if(!confirm('¿Eliminar este evento? También se eliminará su asistencia.')) return;
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  try{
    await supa.from('attendance').delete().eq('event_id', editingEventId);
    const { error, count } = await supa.from('events').delete({ count:'exact' }).eq('id', editingEventId);
    if(error) throw error;
    if(count===0) console.warn('delete: ninguna fila eliminada');
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  closeModal(); renderMonth(); renderDash();
});

btnSave.addEventListener('click', async () => {
  const title=f_title.value.trim(), type=f_type.value, team=f_team.value;
  const opponent=f_opponent.value.trim(), uniform=f_uniform.value, location=f_location.value.trim();
  if(!title||!f_dt.value){ alert('Completa título y fecha/hora'); return; }
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const datetime=localInputToISOWithOffset(f_dt.value);
  const payload={ title, type, team, opponent, uniform, location, datetime };
  try{
    let savedId=editingEventId;
    if(editingEventId){
      const { error, count } = await supa.from('events').update(payload,{count:'exact'}).eq('id',editingEventId);
      if(error) throw error;
      if(count===0) console.warn('update: ninguna fila actualizada');
    } else {
      const { data, error } = await supa.from('events').insert([payload]).select('id');
      if(error) throw error;
      savedId = data?.[0]?.id;
    }
    // Always create pending attendance for all convoked players
    if(savedId) await saveAttendance(savedId);
  } catch(err){ alert('Error: '+(err.message||err)); console.error(err); return; }
  closeModal(); renderMonth(); renderDash();
});

/* ═══════════════════════════════════════════════════════════
   MODAL JUGADORA
   ══════════════════════════════════════════════════════════ */
const playerModalBg  = document.getElementById('playerModalBg');
const p_apodo        = document.getElementById('p_apodo');
const p_nombre       = document.getElementById('p_nombre');
const p_numero       = document.getElementById('p_numero');
const p_fecha_nac    = document.getElementById('p_fecha_nac');
const p_rol          = document.getElementById('p_rol');
const p_estado       = document.getElementById('p_estado');
const p_celular      = document.getElementById('p_celular');
const p_email        = document.getElementById('p_email');
const p_tel_emerg    = document.getElementById('p_tel_emerg');
const p_rut          = document.getElementById('p_rut');
const p_img_preview  = document.getElementById('p_img_preview');
const p_eq_gm        = document.getElementById('p_eq_gm');
const p_eq_dr        = document.getElementById('p_eq_dr');
const p_eq_pw        = document.getElementById('p_eq_pw');

let editingPlayerId = null;
const PHOTO_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect fill='%231a3a5c' width='72' height='72' rx='36'/><text x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-size='26' fill='%23a8e63d'>👤</text></svg>";

function openPlayerModal(player){
  editingPlayerId = player?.id ?? null;
  const isNew = !editingPlayerId;
  document.getElementById('playerModalTitle').textContent = isNew ? 'Nueva jugadora' : (player.apodo||player.nombre||'Jugadora');
  document.getElementById('btnDeletePlayer').style.display = isNew ? 'none' : '';
  p_apodo.value     = player?.apodo     || '';
  p_nombre.value    = player?.nombre    || '';
  p_numero.value    = player?.numero_camiseta != null ? player.numero_camiseta : '';
  p_fecha_nac.value = player?.fecha_nacimiento ? player.fecha_nacimiento.slice(0,10) : '';
  p_rol.value       = player?.rol       || 'jugadora';
  p_estado.value    = player?.estado    || '';
  p_celular.value   = player?.celular   || '';
  p_email.value     = player?.email     || '';
  p_tel_emerg.value = player?.telefono_emergencia || '';
  p_rut.value       = player?.rut       || '';

  const equipos = Array.isArray(player?.equipos) ? player.equipos : [];
  p_eq_gm.checked = equipos.includes(TEAMS.GM);
  p_eq_dr.checked = equipos.includes(TEAMS.DR);
  p_eq_pw.checked = equipos.includes(TEAMS.PW);
  p_img_preview.src = player?.foto || PHOTO_PLACEHOLDER;
  p_img_preview.alt = escapeHTML(player?.apodo||player?.nombre||'Jugadora');
  openDialog(playerModalBg, p_nombre);
}
function closePlayerModal(){ closeDialog(playerModalBg); editingPlayerId=null; }

playerModalBg.addEventListener('click', e => { if(e.target===playerModalBg) closePlayerModal(); });
document.getElementById('btnCancelPlayer').addEventListener('click', closePlayerModal);

document.getElementById('btnDeletePlayer').addEventListener('click', async () => {
  if(!editingPlayerId) return;
  const name = p_apodo.value||p_nombre.value||'esta jugadora';
  if(!confirm(`¿Eliminar a ${name}? No se puede deshacer.`)) return;
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  try{
    const { error, count } = await supa.from('players').delete({count:'exact'}).eq('id',editingPlayerId);
    if(error) throw error;
    if(count===0) console.warn('delete player: ninguna fila');
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  allPlayers=[]; cachedBirthdays=[];
  closePlayerModal(); renderRoster(); renderKPIs();
});

document.getElementById('btnSavePlayer').addEventListener('click', async () => {
  const nombre = p_nombre.value.trim();
  if(!nombre){ alert('El nombre es obligatorio.'); return; }
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const numero = p_numero.value !== '' ? parseInt(p_numero.value) : null;
  const equipos = [];
  if(p_eq_gm.checked) equipos.push(TEAMS.GM);
  if(p_eq_dr.checked) equipos.push(TEAMS.DR);
  if(p_eq_pw.checked) equipos.push(TEAMS.PW);
  if(!equipos.length) equipos.push(TEAMS.GM);
  const payload = {
    nombre, apodo: p_apodo.value.trim()||null,
    numero_camiseta: isNaN(numero)?null:numero,
    fecha_nacimiento: p_fecha_nac.value||null,
    rol: p_rol.value||'jugadora',
    estado: p_estado.value||null,
    equipos,
    celular: p_celular.value.trim()||null,
    email: p_email.value.trim()||null,
    telefono_emergencia: p_tel_emerg.value.trim()||null,
    rut: p_rut.value.trim()||null,
  };
  try{
    if(editingPlayerId){
      const { error, count } = await supa.from('players').update(payload,{count:'exact'}).eq('id',editingPlayerId);
      if(error) throw error;
      if(count===0) console.warn('update player: ninguna fila');
    } else {
      const { error } = await supa.from('players').insert([payload]);
      if(error) throw error;
    }
  } catch(err){ alert('Error: '+(err.message||err)); console.error(err); return; }
  allPlayers=[]; cachedBirthdays=[];
  closePlayerModal(); renderRoster(); renderKPIs();
});

/* ═══════════════════════════════════════════════════════════
   CALENDARIO
   ══════════════════════════════════════════════════════════ */
let monthCursor  = new Date();
let cachedEvents   = [];
let cachedBirthdays = []; // [{id, apodo, nombre, mmdd}]
let activeTeams    = new Set(ALL_TEAMS);

const monthTitleEl = document.getElementById('monthTitle');
const monthGrid    = document.getElementById('monthGrid');
const monthList    = document.getElementById('monthList');

function getMonthRange(d){
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last  = new Date(d.getFullYear(), d.getMonth()+1, 0);
  let start = new Date(first); start.setDate(start.getDate()-((start.getDay()+6)%7));
  let end   = new Date(last);  end.setDate(end.getDate()+(6-(end.getDay()+6)%7));
  return { start, end };
}
function getDaysInRange(start, end){
  const days=[]; let d=new Date(start);
  while(d<=end){ days.push(new Date(d)); d.setDate(d.getDate()+1); }
  return days;
}
function makeWeekSep(){ const s=document.createElement('div'); s.className='week-sep'; return s; }

async function fetchEventsRange(start, end){
  if(!supa||!IS_CONNECTED) return [];
  try{
    const { data, error } = await supa.from('events').select('*')
      .gte('datetime',start.toISOString()).lte('datetime',end.toISOString())
      .order('datetime',{ascending:true});
    if(error){ console.error(error); return []; }
    return data||[];
  } catch(err){ console.error(err); return []; }
}

function renderMonthTitle(){
  const m = monthCursor.toLocaleString('es-CL',{month:'long',year:'numeric'});
  monthTitleEl.textContent = m.charAt(0).toUpperCase()+m.slice(1);
}

async function fetchBirthdays(){
  if(cachedBirthdays.length) return; // already loaded
  if(!supa||!IS_CONNECTED) return;
  try{
    const {data} = await supa.from('players')
      .select('id,apodo,nombre,fecha_nacimiento')
      .not('fecha_nacimiento','is',null);
    cachedBirthdays = (data||[]).map(p => {
      const d = safeDateOnly(p.fecha_nacimiento);
      if(!d) return null;
      // Store as MM-DD for year-independent matching
      const mmdd = pad(d.getMonth()+1) + '-' + pad(d.getDate());
      return { id:p.id, apodo:p.apodo, nombre:p.nombre, mmdd, fullDate:d };
    }).filter(Boolean);
  } catch(e){ console.warn('fetchBirthdays', e); }
}

function birthdaysOnDay(day){
  const mmdd = pad(day.getMonth()+1) + '-' + pad(day.getDate());
  return cachedBirthdays.filter(b => b.mmdd === mmdd);
}

function makeBirthChip(players){
  const chip = document.createElement('div'); chip.className='ev-birth';
  chip.innerHTML = '<span class="ev-birth-dot">🎂</span>';
  const names = players.map(p=>p.apodo||p.nombre).join(', ');
  const nm = document.createElement('span'); nm.textContent = names; chip.appendChild(nm);
  return chip;
}

async function renderMonth(){
  renderMonthTitle();
  const { start, end } = getMonthRange(monthCursor);
  cachedEvents = await fetchEventsRange(start, end);
  await fetchBirthdays();
  const visible = cachedEvents.filter(e => activeTeams.has(e.team||TEAMS.GM));
  const isMobile = window.matchMedia('(max-width:500px)').matches;
  monthGrid.style.display = isMobile ? 'none' : '';
  monthList.style.display = isMobile ? 'flex' : 'none';
  if(isMobile) drawMonthList(start, end, visible);
  else         drawMonthGrid(start, end, visible);
}

function makeEventChip(e){
  const ev = document.createElement('div');
  ev.className = 'ev '+(e.type===EVENT_TYPES.TRAIN?'ev-train':e.type===EVENT_TYPES.EVENT?'ev-event':'ev-match');
  const badge = document.createElement('div');
  badge.className = 'ev-team-badge '+teamBadgeClass(e.team||TEAMS.GM);
  badge.textContent = e.team||TEAMS.GM; ev.appendChild(badge);
  const tDiv = document.createElement('div'); tDiv.style.fontWeight='700'; tDiv.textContent = e.title||'—'; ev.appendChild(tDiv);
  const d = safeDate(e.datetime);
  if(d){
    const time = document.createElement('div'); time.className='ev-time';
    time.textContent = d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); ev.appendChild(time);
  }
  // Attendance button for training events
  if(e.type === EVENT_TYPES.TRAIN || e.type === EVENT_TYPES.EVENT){
    const attBtn = document.createElement('div');
    attBtn.className='ev-result-btn'; attBtn.textContent='✅ Lista';
    attBtn.addEventListener('click', ev2=>{ ev2.stopPropagation(); openAttModal(e); });
    ev.appendChild(attBtn);
  }
  // Result button for match events
  if(e.type === EVENT_TYPES.MATCH){
    const resBtn = document.createElement('div');
    resBtn.className='ev-result-btn'; resBtn.textContent='⚽ Resultado';
    resBtn.addEventListener('click', ev2=>{ ev2.stopPropagation(); openResultModal(e); });
    ev.appendChild(resBtn);
  }
  ev.addEventListener('click', () => openModal({ existing: e }));
  return ev;
}

function drawMonthGrid(start, end, visible){
  monthGrid.innerHTML='';
  const todayYMD = localDateYMD(new Date());
  for(const day of getDaysInRange(start, end)){
    const ymd = localDateYMD(day);
    const cell = document.createElement('div'); cell.className='day';
    if(ymd===todayYMD){ cell.classList.add('today'); cell.setAttribute('aria-current','date'); }
    const head = document.createElement('div'); head.className='day-head';
    const numBox = document.createElement('div'); numBox.className='day-num-box';
    const wkEl = document.createElement('div'); wkEl.className='day-wk-grid';
    wkEl.textContent = day.toLocaleDateString('es-CL',{weekday:'short'}).replace(/\./g,'');
    const nEl = document.createElement('div'); nEl.className='day-n'; nEl.textContent=pad(day.getDate());
    numBox.appendChild(wkEl); numBox.appendChild(nEl); head.appendChild(numBox);
    const plus = document.createElement('button'); plus.className='day-add';
    plus.textContent='+'; plus.title='Nuevo evento';
    plus.addEventListener('click', ()=>openModal({date:day}));
    cell.appendChild(head); cell.appendChild(plus);
    for(const e of visible.filter(e=>localDateYMD(safeDate(e.datetime)||new Date(0))===ymd))
      cell.appendChild(makeEventChip(e));
    const bdays = birthdaysOnDay(day);
    if(bdays.length) cell.appendChild(makeBirthChip(bdays));
    monthGrid.appendChild(cell);
    if(day.getDay()===0) monthGrid.appendChild(makeWeekSep());
  }
}

function drawMonthList(start, end, visible){
  monthList.innerHTML='';
  const todayYMD = localDateYMD(new Date());
  for(const day of getDaysInRange(start, end)){
    const ymd = localDateYMD(day);
    const evs = visible.filter(e=>localDateYMD(safeDate(e.datetime)||new Date(0))===ymd);
    const row = document.createElement('div'); row.className='day';
    if(ymd===todayYMD){ row.classList.add('today'); row.setAttribute('aria-current','date'); }
    const dateBox = document.createElement('div'); dateBox.className='day-date';
    const wkEl=document.createElement('div'); wkEl.className='day-wk'; wkEl.textContent=day.toLocaleDateString('es-CL',{weekday:'short'}).replace(/\./g,'');
    const numEl=document.createElement('div'); numEl.className='day-num'; numEl.textContent=pad(day.getDate());
    dateBox.appendChild(wkEl); dateBox.appendChild(numEl);
    const col=document.createElement('div'); col.style.flex='1';
    if(evs.length) for(const e of evs) col.appendChild(makeEventChip(e));
    else { const em=document.createElement('div'); em.style.cssText='color:var(--muted);font-size:12px;padding:8px 0'; em.textContent='Sin eventos'; col.appendChild(em); }
    const bdays2 = birthdaysOnDay(day);
    if(bdays2.length) col.appendChild(makeBirthChip(bdays2));
    const plus=document.createElement('button'); plus.className='day-add'; plus.style.opacity='1';
    plus.textContent='+'; plus.title='Nuevo evento';
    plus.addEventListener('click',()=>openModal({date:day}));
    row.appendChild(dateBox); row.appendChild(col); row.appendChild(plus);
    monthList.appendChild(row);
    if(day.getDay()===0) monthList.appendChild(makeWeekSep());
  }
}

document.getElementById('btnPrevMonth').addEventListener('click', ()=>{ monthCursor.setMonth(monthCursor.getMonth()-1); renderMonth(); });
document.getElementById('btnNextMonth').addEventListener('click', ()=>{ monthCursor.setMonth(monthCursor.getMonth()+1); renderMonth(); });
document.getElementById('btnToday').addEventListener('click',    ()=>{ monthCursor=new Date(); renderMonth(); });
document.getElementById('btnNewEventTop').addEventListener('click', ()=>openModal({}));

document.querySelectorAll('#teamFilters .team-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const team = btn.dataset.team;
    if(activeTeams.has(team)){
      if(activeTeams.size===1) return;
      activeTeams.delete(team); btn.classList.add('inactive');
    } else { activeTeams.add(team); btn.classList.remove('inactive'); }
    const note = document.getElementById('calNote');
    if(note) note.innerHTML='Mostrando: <strong>'+[...activeTeams].join(', ')+'</strong>';
    const visible = cachedEvents.filter(e=>activeTeams.has(e.team||TEAMS.GM));
    const { start, end } = getMonthRange(monthCursor);
    const isMobile = window.matchMedia('(max-width:500px)').matches;
    if(isMobile) drawMonthList(start, end, visible);
    else         drawMonthGrid(start, end, visible);
  });
});

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════ */
async function renderKPIs(){
  try{
    if(supa&&IS_CONNECTED){
      const { count } = await supa.from('players').select('*',{count:'exact',head:true});
      animateNumber('kRoster', count??0);
    }
  } catch(err){ console.warn('kRoster', err); }

  try{
    if(supa&&IS_CONNECTED){
      const { data: ms } = await supa.from('matches').select('id,goals_for,goals_against,team,opponent,date').order('date',{ascending:false});
      const matches = ms||[];
      animateNumber('kGames', matches.length);
      let w=0,d=0,l=0;
      for(const m of matches){
        const gf=m.goals_for??0, ga=m.goals_against??0;
        if(gf>ga)w++; else if(gf===ga)d++; else l++;
      }
      document.getElementById('kRecord').textContent = matches.length ? `${w}G · ${d}E · ${l}P` : '';
      if(matches.length){
        const last=matches[0];
        const gf=last.goals_for??'?', ga=last.goals_against??'?';
        const kl=document.getElementById('kLastMatch');
        kl.textContent=`${gf} – ${ga}`;
        kl.style.color = gf>ga?'#a8e63d':gf<ga?'#f87171':'rgba(255,255,255,0.7)';
        document.getElementById('kLastMatchMeta').textContent = last.opponent?`vs ${last.opponent}`:'';
      }
    }
  } catch(err){ console.warn('kGames', err); }
}

function animateNumber(id, target){
  const el = document.getElementById(id);
  if(!el) return;
  let start=0; const dur=600; const t0=performance.now();
  const step = now => {
    const p = Math.min((now-t0)/dur, 1);
    el.textContent = Math.round(start + (target-start)*p);
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function renderWeekEvents(){
  const now=new Date();
  const todayStart=new Date(now); todayStart.setHours(0,0,0,0);
  const next14=new Date(todayStart); next14.setDate(next14.getDate()+14); next14.setHours(23,59,59,999);
  const todayYMD=localDateYMD(now);
  let evs=[];
  if(supa&&IS_CONNECTED){
    const { data } = await supa.from('events').select('*')
      .gte('datetime',todayStart.toISOString()).lte('datetime',next14.toISOString())
      .order('datetime',{ascending:true});
    evs=data||[];
  }
  // Hoy
  const todayEl=document.getElementById('todayEvents'); todayEl.innerHTML='';
  const todayEvs=evs.filter(e=>localDateYMD(safeDate(e.datetime)||new Date(0))===todayYMD);
  if(todayEvs.length){
    for(const e of todayEvs){
      const item=document.createElement('div'); item.className='event-item';
      const dot=document.createElement('div'); dot.className='event-dot'+(e.type===EVENT_TYPES.MATCH?' match':''); item.appendChild(dot);
      const info=document.createElement('div');
      const nm=document.createElement('div'); nm.className='event-name'; nm.textContent=e.title||'—'; info.appendChild(nm);
      const d=safeDate(e.datetime);
      const meta=document.createElement('div'); meta.className='event-meta';
      meta.textContent=(d?d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'—')+' · '+(e.team||'');
      info.appendChild(meta); item.appendChild(info); todayEl.appendChild(item);
    }
  } else {
    todayEl.innerHTML='<div class="empty-state"><span class="empty-state-icon">📅</span>Sin eventos hoy</div>';
  }
  // Semana
  const wEl=document.getElementById('weekEvents'); wEl.innerHTML='';
  if(evs.length){
    for(const e of evs){
      const item=document.createElement('div'); item.className='event-item';
      const dot=document.createElement('div'); dot.className='event-dot'+(e.type===EVENT_TYPES.MATCH?' match':''); item.appendChild(dot);
      const info=document.createElement('div');
      const nm=document.createElement('div'); nm.className='event-name'; nm.textContent=e.title||'—'; info.appendChild(nm);
      const d=safeDate(e.datetime);
      const meta=document.createElement('div'); meta.className='event-meta';
      meta.textContent=(d?d.toLocaleString('es-CL',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—')+' · '+(e.team||'');
      info.appendChild(meta); item.appendChild(info); wEl.appendChild(item);
    }
  } else {
    wEl.innerHTML='<div class="empty-state"><span class="empty-state-icon">📆</span>Sin eventos esta semana</div>';
  }
}

async function renderBirthdays(){
  const upB=document.getElementById('upBirth');
  const birthTodayEl=document.getElementById('birthToday');
  const todayYMD=localDateYMD(new Date());
  upB.innerHTML=''; birthTodayEl.innerHTML='';
  if(!supa||!IS_CONNECTED){ upB.innerHTML='<div class="empty-state">Sin conexión</div>'; return; }
  try{
    // Try view first; fallback to players table if view doesn't exist
    let vw = null;
    const { data:vwData, error:vwErr } = await supa.from('vw_upcoming_birthdays').select('*').order('proximo_cumple',{ascending:true}).limit(10);
    if(!vwErr){ vw = vwData; }
    else {
      // Fallback: compute from players.fecha_nacimiento
      const { data:pl } = await supa.from('players').select('id,apodo,nombre,fecha_nacimiento').eq('estado','activo').not('fecha_nacimiento','is',null);
      const today = new Date(); const todayMD = (today.getMonth()+1)*100+today.getDate();
      vw = (pl||[]).map(p=>{
        const bd = new Date(p.fecha_nacimiento+'T00:00:00');
        const bMD = (bd.getMonth()+1)*100+bd.getDate();
        const daysAhead = bMD >= todayMD ? Math.round((bMD-todayMD)) : 365 - Math.round((todayMD-bMD));
        const nextBday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if(nextBday < today) nextBday.setFullYear(today.getFullYear()+1);
        return { ...p, proximo_cumple: nextBday.toISOString().split('T')[0], edad: today.getFullYear()-bd.getFullYear()-(bMD>todayMD?1:0), days_ahead: daysAhead };
      }).sort((a,b)=>a.days_ahead-b.days_ahead).slice(0,10);
    }
    const seen=new Set(); const uniq=[];
    for(const p of (vw||[])){ if(!seen.has(p.id)&&uniq.length<5){ seen.add(p.id); uniq.push(p); } }
    if(uniq.length){
      for(const p of uniq){
        const bd=safeDateOnly(p.proximo_cumple); if(!bd) continue;
        const item=document.createElement('div'); item.className='birth-item';
        const av=document.createElement('div'); av.className='birth-avatar';
        av.textContent=(p.apodo||p.nombre||'?')[0].toUpperCase(); item.appendChild(av);
        const info=document.createElement('div');
        const nm=document.createElement('div'); nm.className='birth-name'; nm.textContent=p.apodo||p.nombre||'—'; info.appendChild(nm);
        const dt=document.createElement('div'); dt.className='birth-date';
        dt.textContent=bd.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}); info.appendChild(dt);
        item.appendChild(info);
        const isToday=localDateYMD(bd)===todayYMD;
        if(isToday){ const b=document.createElement('div'); b.className='birth-today-badge'; b.textContent='¡Hoy! 🎂'; item.appendChild(b); }
        upB.appendChild(item);
      }
      const todayList=uniq.filter(p=>p.proximo_cumple&&localDateYMD(safeDateOnly(p.proximo_cumple)||new Date(0))===todayYMD);
      if(todayList.length){
        birthTodayEl.innerHTML='';
        for(const p of todayList){
          const item=document.createElement('div'); item.className='birth-item';
          const av=document.createElement('div'); av.className='birth-avatar'; av.style.background='var(--lime)'; av.style.color='var(--navy)';
          av.textContent=(p.apodo||p.nombre||'?')[0].toUpperCase(); item.appendChild(av);
          const info=document.createElement('div');
          const nm=document.createElement('div'); nm.className='birth-name'; nm.textContent=p.apodo||p.nombre||'—'; info.appendChild(nm);
          if(p.edad){ const ag=document.createElement('div'); ag.className='birth-date'; ag.textContent=`${p.edad} años 🎉`; info.appendChild(ag); }
          item.appendChild(info); birthTodayEl.appendChild(item);
        }
      } else { birthTodayEl.innerHTML='<div class="empty-state"><span class="empty-state-icon">🎂</span>Hoy no hay cumpleaños</div>'; }
    } else {
      upB.innerHTML='<div class="empty-state"><span class="empty-state-icon">🎉</span>Sin datos</div>';
      birthTodayEl.innerHTML='<div class="empty-state"><span class="empty-state-icon">🎂</span>Sin cumpleaños hoy</div>';
    }
  } catch(err){ console.warn('renderBirthdays', err); upB.innerHTML='<div class="empty-state">Error</div>'; }
}

async function renderRoster(filterTeam='all'){
  const rosterGrid=document.getElementById('rosterGrid');
  rosterGrid.innerHTML='<div class="empty-state"><span class="empty-state-icon" style="animation:spin 1s linear infinite;display:inline-block">⚽</span>Cargando plantel…</div>';
  if(!supa||!IS_CONNECTED){ rosterGrid.innerHTML='<div style="color:var(--muted);padding:20px">Sin conexión</div>'; return; }
  try{
    const { data:players, error } = await supa.from('players').select('*').order('apodo',{ascending:true});
    if(error) throw error;
    let filtered=players||[];
    if(filterTeam!=='all') filtered=filtered.filter(p=>Array.isArray(p.equipos)&&p.equipos.includes(filterTeam));
    if(!filtered.length){ rosterGrid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">👥</span>No hay jugadoras</div>'; return; }
    for(const p of filtered){
      const c=document.createElement('div'); c.className='player-card';
      c.addEventListener('click',()=>openPlayerModal(p));
      if(p.foto){
        const img=document.createElement('img'); img.className='player-photo';
        img.src=p.foto; img.alt=escapeHTML(p.apodo||p.nombre||''); c.appendChild(img);
      } else {
        const ph=document.createElement('div'); ph.className='jersey-placeholder';
        ph.textContent=p.numero_camiseta!=null?String(p.numero_camiseta):'⚽'; c.appendChild(ph);
      }
      const ap=document.createElement('div'); ap.className='player-apodo'; ap.textContent=p.apodo||'Sin apodo'; c.appendChild(ap);
      if(p.nombre){ const nm=document.createElement('div'); nm.className='player-nombre'; nm.textContent=p.nombre; c.appendChild(nm); }
      const equipos=Array.isArray(p.equipos)?p.equipos:[];
      if(equipos.length){
        const badges=document.createElement('div'); badges.className='equipo-badges';
        for(const eq of equipos){
          const b=document.createElement('span'); b.className='equipo-badge '+teamBadgeClass(eq);
          b.textContent=eq===TEAMS.GM?'💚 GM':eq===TEAMS.DR?'💜 DR':'🧡 PW'; badges.appendChild(b);
        }
        c.appendChild(badges);
      }
      rosterGrid.appendChild(c);
    }
  } catch(err){ console.warn('renderRoster', err); rosterGrid.innerHTML='<div style="color:var(--muted)">Error</div>'; }
}

async function renderDash(){
  await Promise.all([renderKPIs(), renderWeekEvents(), renderBirthdays()]);
}

/* ═══════════════════════════════════════════════════════════
   PARTIDOS
   ══════════════════════════════════════════════════════════ */
async function renderMatches(){
  const container=document.getElementById('matchesList');
  container.innerHTML='<div class="empty-state"><span class="empty-state-icon" style="animation:spin 1s linear infinite;display:inline-block">⚽</span>Cargando partidos…</div>';
  if(!supa||!IS_CONNECTED){ container.innerHTML='<div class="empty-state"><span class="empty-state-icon">⚽</span>Sin conexión</div>'; return; }
  try{
    const { data:matches, error } = await supa
      .from('matches').select('*, events(title, datetime, location, team, opponent)').order('date',{ascending:false});
    if(error) throw error;
    if(!matches?.length){ container.innerHTML='<div class="empty-state"><span class="empty-state-icon">⚽</span>No hay partidos registrados</div>'; return; }
    for(const m of matches){
      const ev=m.events;
      const gf=m.goals_for??null, ga=m.goals_against??null;
      const hasScore=gf!==null&&ga!==null;
      const resultKey=!hasScore?'':'draw'+(gf>ga?'win':gf<ga?'loss':'draw').replace('drawwin','win').replace('drawloss','loss');
      const rc=hasScore?(gf>ga?'win':gf<ga?'loss':'draw'):'';
      const date=safeDate(ev?.datetime) || safeDateOnly(m.date);
      const title=ev?.title||m.opponent||'Partido';
      const team=ev?.team||m.team||TEAMS.GM;
      const opp=ev?.opponent||m.opponent||'';
      const loc=ev?.location||'';
      const card=document.createElement('div'); card.className='match-card'+(rc?' '+rc:'');
      // Left
      const left=document.createElement('div');
      const titleEl=document.createElement('div'); titleEl.className='match-title';
      const badge=document.createElement('span'); badge.className='ev-team-badge '+teamBadgeClass(team); badge.textContent=team; titleEl.appendChild(badge);
      const tname=document.createElement('span'); tname.textContent=title; titleEl.appendChild(tname);
      const meta=document.createElement('div'); meta.className='match-meta';
      const parts=[];
      if(date) parts.push(date.toLocaleDateString('es-CL',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}));
      if(opp&&!title.includes(opp)) parts.push('vs '+opp);
      if(loc) parts.push(loc);
      meta.textContent=parts.join(' · ');
      left.appendChild(titleEl); left.appendChild(meta);
      if(Array.isArray(m.scorers)&&m.scorers.length){
        const sc=document.createElement('div'); sc.className='match-scorers';
        sc.textContent='⚽ '+m.scorers.join(', '); left.appendChild(sc);
      }
      if(m.observation||m.notes){
        const obs=document.createElement('div'); obs.className='match-obs';
        obs.textContent=m.observation||m.notes; left.appendChild(obs);
      }
      // Right
      const right=document.createElement('div');
      if(hasScore){
        const score=document.createElement('div'); score.className='score-badge'+(rc?' '+rc:'');
        const gfEl=document.createElement('span'); gfEl.textContent=String(gf);
        const sep=document.createElement('span'); sep.className='score-sep'; sep.textContent=' – ';
        const gaEl=document.createElement('span'); gaEl.textContent=String(ga);
        score.appendChild(gfEl); score.appendChild(sep); score.appendChild(gaEl); right.appendChild(score);
      } else {
        const p=document.createElement('div'); p.className='score-no'; p.textContent='Sin resultado'; right.appendChild(p);
      }
      card.appendChild(left); card.appendChild(right);
      container.appendChild(card);
    }
  } catch(err){ console.error('renderMatches', err); container.innerHTML='<div class="empty-state">Error cargando partidos</div>'; }
}

/* ═══════════════════════════════════════════════════════════
   FILTRO PLANTEL
   ══════════════════════════════════════════════════════════ */
let currentRosterFilter='all';
document.querySelectorAll('#rosterTeamFilters .team-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#rosterTeamFilters .team-chip').forEach(b=>{ b.style.opacity=''; b.style.fontWeight=''; });
    btn.style.fontWeight='900';
    currentRosterFilter=btn.dataset.team;
    renderRoster(currentRosterFilter);
  });
});
document.getElementById('btnNewPlayer').addEventListener('click', ()=>openPlayerModal({}));

/* ═══════════════════════════════════════════════════════════
   ROUTING
   ══════════════════════════════════════════════════════════ */
function showView(v){
  activateNavTab(v);
  for(const id of ['dash','events','roster','matches','stats','board','fees']){
    const el=document.getElementById('v-'+id);
    if(el){ el.style.display='none'; el.classList.remove('view-enter'); }
  }
  syncTabPanels(v);
  const target=document.getElementById('v-'+v);
  if(target){ target.style.display='block'; requestAnimationFrame(()=>target.classList.add('view-enter')); }
  if(v !== 'fees') hideTreasLock();
  if(v==='dash')    { renderDash(); loadNotifications(); if(currentUser) renderPlayerDash(); }
  if(v==='events')  renderMonth();
  if(v==='matches') renderMatches();
  if(v==='roster')  renderRoster(currentRosterFilter);
  if(v==='stats')   renderStats();
  if(v==='board')   renderBoard();
  if(v==='fees'){
    if(checkTreasAuth()){
      hideTreasLock();
      renderFees();
      renderTreasKPIs();
      renderExpenses();
    } else {
      showTreasLock();
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const loginLogoImg = document.getElementById('loginLogoImg');
  if(loginLogoImg){
    loginLogoImg.addEventListener('error', () => { loginLogoImg.hidden = true; });
  }
  document.getElementById('userPill')?.addEventListener('click', showLogoutMenu);
  document.getElementById('treasUserInput')?.addEventListener('keydown', e => {
    if(e.key === 'Enter'){
      e.preventDefault();
      document.getElementById('treasPwdInput')?.focus();
    }
  });
  document.querySelectorAll('[data-stand-tab]').forEach(btn => {
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
    btn.addEventListener('click', () => switchStandTab(Number(btn.dataset.standTab)));
  });

  await initSupabase();

  document.getElementById('mobileNavSelect')?.addEventListener('change', e => {
    const view = e.target.value;
    try{ localStorage.setItem('gm_view', view); } catch(e){}
    showView(view);
  });

  const navTabs = [...document.querySelectorAll('.nav .tab')];
  navTabs.forEach((btn, index) => {
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
    btn.setAttribute('tabindex', btn.classList.contains('active') ? '0' : '-1');
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      try{ localStorage.setItem('gm_view', view); } catch(e){}
      showView(view);
    });
    btn.addEventListener('keydown', e => {
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      if(e.key === 'Home'){ navTabs[0]?.focus(); return; }
      if(e.key === 'End'){ navTabs[navTabs.length - 1]?.focus(); return; }
      const nextIndex = e.key === 'ArrowRight'
        ? (index + 1) % navTabs.length
        : (index - 1 + navTabs.length) % navTabs.length;
      navTabs[nextIndex]?.focus();
    });
  });

  const persisted = (() => { try{ return localStorage.getItem('gm_view'); } catch(e){ return null; } })();
  pendingAttendanceLinkId = new URLSearchParams(window.location.search).get('att');
  if(pendingAttendanceLinkId){
    history.replaceState({}, '', window.location.pathname);
  }

  await initAuth();
  closeModal();
  closePlayerModal();
  closeAttModal();
  closeResultModal();
  closeAnnModal();
  closeFeeModal();
  closeTreasEventModal();
  closeExpenseModal();

  if(currentUser) {
    updateUserUI();
    addAdminControls();
    if(pendingAttendanceLinkId){
      const eventId = pendingAttendanceLinkId;
      pendingAttendanceLinkId = null;
      await openAttendanceFromLink(eventId);
    } else {
      showView('dash');
      renderPlayerDash();
    }
    return;
  }

  const initialView = persisted || 'dash';
  activateNavTab(initialView);
  syncTabPanels(initialView);
});

/* ═══════════════════════════════════════════════════════════
   ASISTENCIA RÁPIDA
   ══════════════════════════════════════════════════════════ */
let attEventId = null;
let attStatuses = {}; // player_id → 'Asiste'|'No asiste'|'Duda'
let attFilteredPlayers = []; // jugadoras del equipo del evento actual

function openAttModal(event) {
  attEventId = event.id;
  attStatuses = {};
  attFilteredPlayers = [];
  selectedPlayerIds = new Set();
  attWaMsg = '';
  const sb=document.getElementById('btnShareAtt'); if(sb) sb.style.display='none';
  const gb=document.getElementById('btnSaveAtt'); if(gb){ gb.disabled=false; gb.textContent='💾 Guardar'; gb.classList.remove('p'); }

  document.getElementById('attModalTitle').textContent = event.title || 'Pase de lista';
  const d = safeDate(event.datetime);
  document.getElementById('attEventMeta').textContent =
    (d ? d.toLocaleString('es-CL',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '') +
    (event.team ? ' · ' + event.team : '');

  openDialog(attModalBg, document.getElementById('btnSaveAtt'));
  loadAttendanceForEvent(event.id).then(() => {
    // attStatuses already loaded from DB in loadAttendanceForEvent
    // Only fill missing ones from selectedPlayerIds
    for(const pid of selectedPlayerIds){
      if(!attStatuses[pid]) attStatuses[pid] = 'Asiste';
    }
    renderAttList(event.team || TEAMS.GM);
  });
}

async function renderAttList(team) {
  const list = document.getElementById('attList');
  list.innerHTML = '';
  if(!allPlayers.length) {
    const { data } = await supa.from('players')
      .select('id,apodo,nombre,numero_camiseta,equipos').order('apodo',{ascending:true});
    allPlayers = data || [];
  }
  const filtered = team === TEAMS.GM ? allPlayers
    : allPlayers.filter(p => Array.isArray(p.equipos) && p.equipos.includes(team));
  attFilteredPlayers = filtered; // save for WA message

  // Split into groups: confirmed, absent, pending (no answer)
  const yes    = filtered.filter(p => attStatuses[p.id] === 'Asiste');
  const no     = filtered.filter(p => attStatuses[p.id] === 'No asiste');
  const duda   = filtered.filter(p => attStatuses[p.id] === 'Duda');
  const pending= filtered.filter(p => !attStatuses[p.id]);

  function makePlayerRow(p) {
    const status = attStatuses[p.id] || null;
    const row = document.createElement('div');
    row.className = 'att-row' +
      (status==='Asiste'?' att-yes' : status==='No asiste'?' att-no' :
       status==='Duda'?' att-maybe' : ' att-pending');
    row.dataset.pid = p.id;

    const av = document.createElement('div'); av.className='att-avatar';
    av.textContent = (p.apodo||p.nombre||'?')[0].toUpperCase();
    const nm = document.createElement('div'); nm.className='att-name';
    nm.textContent = p.apodo || p.nombre || '—';
    const num = document.createElement('div'); num.className='att-num';
    if(p.numero_camiseta) num.textContent = '#'+p.numero_camiseta;

    const taps = document.createElement('div'); taps.className='att-tap-group';
    [['✅','Asiste','act-yes'],['❌','No asiste','act-no'],['🤔','Duda','act-duda']].forEach(([emoji,val,cls])=>{
      const b = document.createElement('button');
      b.className = 'att-tap' + (status===val?' '+cls:'');
      b.textContent = emoji; b.title = val;
      b.addEventListener('click', e=>{
        e.stopPropagation();
        attStatuses[p.id] = attStatuses[p.id]===val ? null : val;
        renderAttList(team); updateAttCounter();
      });
      taps.appendChild(b);
    });

    row.appendChild(av); row.appendChild(nm); row.appendChild(num); row.appendChild(taps);
    return row;
  }

  function addSection(label, players) {
    if(!players.length) return;
    const sep = document.createElement('div');
    sep.className = 'att-section-label';
    sep.textContent = label + ' (' + players.length + ')';
    list.appendChild(sep);
    players.forEach(p => list.appendChild(makePlayerRow(p)));
  }

  addSection('✅ Asisten', yes);
  addSection('🤔 Duda', duda);
  addSection('❌ No asisten', no);
  addSection('⏳ Sin respuesta', pending);

  updateAttCounter();
}

function updateAttCounter(){
  const vals = Object.values(attStatuses);
  const yes  = vals.filter(v=>v==='Asiste').length;
  const no   = vals.filter(v=>v==='No asiste').length;
  const duda = vals.filter(v=>v==='Duda').length;
  const total= allPlayers.length;
  const pend = total - yes - no - duda;
  let txt = `✅ ${yes}  ❌ ${no}`;
  if(duda) txt += `  🤔 ${duda}`;
  if(pend > 0) txt += `  ⏳ ${pend}`;
  document.getElementById('attCounter').textContent = txt;
}

const attModalBg = document.getElementById('attModalBg');
function closeAttModal(){
  closeDialog(attModalBg);
  const sb=document.getElementById('btnShareAtt'); if(sb) sb.style.display='none';
  const gb=document.getElementById('btnSaveAtt'); if(gb){ gb.disabled=false; gb.textContent='?? Guardar'; gb.classList.remove('p'); }
}
document.getElementById('btnCloseAtt').addEventListener('click', closeAttModal);
attModalBg.addEventListener('click', e=>{ if(e.target===attModalBg) closeAttModal(); });

// Stores the last built WA message for the share button
let attWaMsg = '';

document.getElementById('btnSaveAtt').addEventListener('click', async ()=>{
  if(!supa||!IS_CONNECTED||!attEventId){ alert('Sin conexión.'); return; }
  if(!allPlayers.length){ alert('No hay jugadoras cargadas.'); return; }
  const btn = document.getElementById('btnSaveAtt');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    // Only save players the user explicitly marked — don't overwrite others' responses
    const upserts = allPlayers
      .filter(p => attStatuses[p.id])  // skip players with no status (null/undefined)
      .map(p=>({
        event_id: attEventId,
        player_id: p.id,
        status: attStatuses[p.id],
        updated_at: new Date().toISOString()
      }));
    if(upserts.length){
      const {error} = await supa.from('attendance').upsert(upserts, {onConflict:'event_id,player_id'});
      if(error) throw error;
    }

    // Build WA message
    const eventTitle = document.getElementById('attModalTitle').textContent;
    const players = attFilteredPlayers.length ? attFilteredPlayers : allPlayers;
    const yes    = players.filter(p=>attStatuses[p.id]==='Asiste').map(p=>p.apodo||p.nombre);
    const no     = players.filter(p=>attStatuses[p.id]==='No asiste').map(p=>p.apodo||p.nombre);
    const duda   = players.filter(p=>attStatuses[p.id]==='Duda').map(p=>p.apodo||p.nombre);
    const pending= players.filter(p=>!attStatuses[p.id]).map(p=>p.apodo||p.nombre);
    const appUrl = 'https://nmillana.github.io/GoldenMoms2/?att=' + attEventId;
    attWaMsg = '📋 *Asistencia — ' + eventTitle + '*\n';
    if(yes.length)     attWaMsg += '\n✅ Asisten (' + yes.length + '): ' + yes.join(', ');
    if(duda.length)    attWaMsg += '\n🤔 Duda (' + duda.length + '): ' + duda.join(', ');
    if(no.length)      attWaMsg += '\n❌ No asisten (' + no.length + '): ' + no.join(', ');
    if(pending.length) attWaMsg += '\n⏳ Sin responder (' + pending.length + '): ' + pending.join(', ');
    attWaMsg += '\n\n👉 Confirma tu asistencia en la app: ' + appUrl;

    btn.textContent = '✅ Guardado';
    btn.classList.add('p');

    const shareBtn = document.getElementById('btnShareAtt');
    shareBtn.innerHTML = WA_ICON + ' Compartir';
    shareBtn.style.display = '';
    shareBtn.href = '#';
    shareBtn.onclick = (e) => {
      e.preventDefault();
      navigator.share({ text: attWaMsg })
        .then(() => { closeAttModal(); })
        .catch(() => {});
    };

    showToast('✅ Asistencia guardada');
  } catch(err){
    btn.disabled = false; btn.textContent = '💾 Guardar';
    alert('Error guardando asistencia: '+(err.message||err));
  }
});

/* ═══════════════════════════════════════════════════════════
   RESULTADO PARTIDO
   ══════════════════════════════════════════════════════════ */
let resSelectedScorers = new Set();

function openResultModal(event) {
  resSelectedScorers = new Set();
  document.getElementById('resultModalTitle').textContent = 'Resultado — ' + (event.title||'Partido');
  document.getElementById('res_event_id').value = event.id;
  document.getElementById('res_opp_label').textContent = event.opponent || 'Rival';
  document.getElementById('res_gf').value = '';
  document.getElementById('res_ga').value = '';
  document.getElementById('res_obs').value = '';

  // Load existing match if any
  if(supa&&IS_CONNECTED){
    supa.from('matches').select('*').eq('event_id', event.id).maybeSingle().then(({data:m})=>{
      if(m){
        document.getElementById('res_gf').value = m.goals_for ?? '';
        document.getElementById('res_ga').value = m.goals_against ?? '';
        document.getElementById('res_obs').value = m.observation || m.notes || '';
        resSelectedScorers = new Set(m.scorer_ids||[]);
      }
      renderScorerGrid(event.team || TEAMS.GM);
    });
  } else { renderScorerGrid(event.team || TEAMS.GM); }

  openDialog(resultModalBg, document.getElementById('res_gf'));
}

async function renderScorerGrid(team) {
  const grid = document.getElementById('res_scorers_grid');
  grid.innerHTML='';
  if(!allPlayers.length && supa && IS_CONNECTED){
    const {data} = await supa.from('players').select('id,apodo,nombre,numero_camiseta,equipos').order('apodo',{ascending:true});
    allPlayers = data||[];
  }
  const filtered = team===TEAMS.GM ? allPlayers
    : allPlayers.filter(p=>Array.isArray(p.equipos)&&p.equipos.includes(team));
  for(const p of filtered){
    const btn = document.createElement('button'); btn.type='button';
    btn.className = 'conv-player'+(resSelectedScorers.has(p.id)?' selected':'');
    btn.dataset.id=p.id;
    if(p.numero_camiseta){ const s=document.createElement('span');s.className='conv-num';s.textContent='#'+p.numero_camiseta;btn.appendChild(s); }
    const nm=document.createElement('span');nm.textContent=p.apodo||p.nombre||'—';btn.appendChild(nm);
    btn.addEventListener('click',()=>{
      resSelectedScorers.has(p.id)?resSelectedScorers.delete(p.id):resSelectedScorers.add(p.id);
      btn.classList.toggle('selected');
    });
    grid.appendChild(btn);
  }
}

const resultModalBg = document.getElementById('resultModalBg');
function closeResultModal(){
  closeDialog(resultModalBg);
}
document.getElementById('btnCloseResult').addEventListener('click', closeResultModal);
resultModalBg.addEventListener('click', e=>{ if(e.target===resultModalBg) closeResultModal(); });

document.getElementById('btnSaveResult').addEventListener('click', async ()=>{
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const event_id = document.getElementById('res_event_id').value;
  const gf = parseInt(document.getElementById('res_gf').value);
  const ga = parseInt(document.getElementById('res_ga').value);
  if(isNaN(gf)||isNaN(ga)){ alert('Ingresá el marcador.'); return; }

  const scorerIds = [...resSelectedScorers];
  // Get scorer names for the scorers array
  const scorerNames = allPlayers.filter(p=>scorerIds.includes(p.id)).map(p=>p.apodo||p.nombre);

  const observation = document.getElementById('res_obs').value.trim()||null;
  const payload = {
    event_id, goals_for:gf, goals_against:ga,
    goal_difference: gf-ga,
    scorer_ids: scorerIds,
    scorers: scorerNames,
    observation
  };
  try{
    // Check if match exists for this event
    const {data:existing} = await supa.from('matches').select('id').eq('event_id',event_id).maybeSingle();
    if(existing){
      const {error} = await supa.from('matches').update(payload).eq('id',existing.id);
      if(error) throw error;
    } else {
      // Also grab event data for the match record
      const {data:ev} = await supa.from('events').select('team,opponent,datetime').eq('id',event_id).maybeSingle();
      const {error} = await supa.from('matches').insert([{
        ...payload,
        team: ev?.team||TEAMS.GM,
        opponent: ev?.opponent||null,
        date: ev?.datetime ? ev.datetime.slice(0,10) : null
      }]);
      if(error) throw error;
    }
    closeResultModal();
    if(document.querySelector('.nav .tab.active')?.dataset.view==='matches') renderMatches();
    renderKPIs();
  } catch(err){ alert('Error: '+(err.message||err)); console.error(err); }
});

/* ═══════════════════════════════════════════════════════════
   ESTADÍSTICAS INDIVIDUALES
   ══════════════════════════════════════════════════════════ */
async function renderStats() {
  const filterTeam = document.getElementById('stats_team_filter').value;
  const tbody = document.getElementById('standingsBody');
  const kpisEl = document.getElementById('standingsKpis');
  const scorersEl = document.getElementById('topScorers');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted)">⏳ Cargando…</td></tr>';
  if(!supa||!IS_CONNECTED){ tbody.innerHTML='<tr><td colspan="11" class="empty-state">Sin conexión</td></tr>'; return; }
  try{
    // Load matches with result
    let matchQ = supa.from('matches').select('*').order('date',{ascending:false});
    if(filterTeam!=='all') matchQ = matchQ.eq('team', filterTeam);
    const {data:matches} = await matchQ;

    // Load goals / scorers
    const {data:allGoals} = await supa.from('goals').select('player_id,match_id');
    const {data:players} = await supa.from('players').select('id,apodo,nombre,equipos').order('apodo',{ascending:true});
    const playerMap = Object.fromEntries((players||[]).map(p=>[p.id,p]));

    // Group matches by team (rival name acts as "opponent team")
    // Build per-team row: our teams vs rivals
    const teams = filterTeam==='all' ? ['Golden Moms','Dreams','Power'] : [filterTeam];
    const rows = [];

    for(const team of teams){
      const tm = (matches||[]).filter(m=>m.team===team && m.goals_for!=null && m.goals_against!=null);
      if(!tm.length) continue;
      let pj=0,g=0,e=0,p=0,gf=0,gc=0;
      const form = [];
      for(const m of tm){
        pj++; gf+=m.goals_for; gc+=m.goals_against;
        if(m.goals_for>m.goals_against){ g++; form.push('W'); }
        else if(m.goals_for===m.goals_against){ e++; form.push('D'); }
        else { p++; form.push('L'); }
      }
      const pts=g*3+e;
      const dif=gf-gc;
      rows.push({team,pj,g,e,p,gf,gc,dif,pts,form:form.slice(0,5)});
    }

    // Sort by pts desc, dif desc, gf desc
    rows.sort((a,b)=>b.pts-a.pts||b.dif-a.dif||b.gf-a.gf);

    // Team colors
    const teamColor = {'Golden Moms':'#22c55e','Dreams':'#a855f7','Power':'#f97316'};

    tbody.innerHTML='';
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--muted-2)">Sin partidos registrados con resultado</td></tr>';
    }
    rows.forEach((r,i)=>{
      const tr=document.createElement('tr');
      if(i===0) tr.className='top-1';
      else if(i<3) tr.className='top-3';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1;
      const diffHtml = r.dif>0?'<span class="st-diff-pos">+'+r.dif+'</span>':r.dif<0?'<span class="st-diff-neg">'+r.dif+'</span>':'0';
      const formHtml = r.form.map(f=>f==='W'?'<div class="st-form-w">G</div>':f==='D'?'<div class="st-form-d">E</div>':'<div class="st-form-l">P</div>').join('');
      tr.innerHTML = '<td>'+medal+'</td>'+
        '<td><span class="st-team-badge" style="background:'+( teamColor[r.team]||'#999')+'"></span><span class="st-team-name">'+r.team+'</span></td>'+
        '<td>'+r.pj+'</td><td>'+r.g+'</td><td>'+r.e+'</td><td>'+r.p+'</td>'+
        '<td>'+r.gf+'</td><td>'+r.gc+'</td><td>'+diffHtml+'</td>'+
        '<td><span class="st-pts">'+r.pts+'</span></td>'+
        '<td><div class="st-form">'+formHtml+'</div></td>';
      tbody.appendChild(tr);
    });

    // Season KPIs
    if(kpisEl){
      const allM = (matches||[]).filter(m=>m.goals_for!=null);
      const totPJ=allM.length, totG=allM.filter(m=>m.goals_for>m.goals_against).length;
      const totGF=allM.reduce((s,m)=>s+m.goals_for,0), totGC=allM.reduce((s,m)=>s+m.goals_against,0);
      kpisEl.innerHTML=[
        {label:'Partidos',val:totPJ,icon:'📅'},
        {label:'Victorias',val:totG,icon:'🏆'},
        {label:'Goles a favor',val:totGF,icon:'⚽'},
        {label:'Goles en contra',val:totGC,icon:'🥅'},
      ].map(k=>'<div class="kpi-card" style="padding:12px 8px;text-align:center"><div style="font-size:18px">'+k.icon+'</div><div class="kpi-value" style="font-size:24px;margin:2px 0">'+k.val+'</div><div class="kpi-label">'+k.label+'</div></div>').join('');
    }

    // Top scorers
    if(scorersEl){
      const goalsByPlayer={};
      for(const g of (allGoals||[])){ goalsByPlayer[g.player_id]=(goalsByPlayer[g.player_id]||0)+1; }
      for(const m of (matches||[])){
        for(const id of (m.scorer_ids||[])){ goalsByPlayer[id]=(goalsByPlayer[id]||0)+1; }
      }
      const scorerRows=Object.entries(goalsByPlayer).map(([id,g])=>({p:playerMap[id],g})).filter(r=>r.p).sort((a,b)=>b.g-a.g).slice(0,10);
      scorersEl.innerHTML='';
      if(!scorerRows.length){ scorersEl.innerHTML='<div class="empty-state" style="padding:12px;font-size:13px">Sin goles registrados</div>'; }
      scorerRows.forEach((r,i)=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-sm);font-size:13px';
        row.innerHTML='<span style="width:20px;text-align:center;font-weight:800;color:var(--muted)">'+(i+1)+'</span>'+
          '<div class="stats-avatar" style="width:32px;height:32px;font-size:12px">'+( r.p.apodo||r.p.nombre||'?')[0].toUpperCase()+'</div>'+
          '<span style="flex:1;font-weight:700">'+(r.p.apodo||r.p.nombre||'—')+'</span>'+
          '<span style="font-weight:800;font-size:15px;color:var(--lime)">'+r.g+' ⚽</span>';
        scorersEl.appendChild(row);
      });
    }
  } catch(err){ console.error('renderStats',err); tbody.innerHTML='<tr><td colspan="11" class="empty-state">Error cargando datos</td></tr>'; }
}
document.getElementById('stats_team_filter').addEventListener('change', renderStats);

/* ═══════════════════════════════════════════════════════════
   TABLÓN DE ANUNCIOS
   ══════════════════════════════════════════════════════════ */
const annModalBg = document.getElementById('annModalBg');
let editingAnnId = null;

function openAnnModal(ann=null){
  editingAnnId = ann?.id||null;
  document.getElementById('annModalTitle').textContent = ann ? 'Editar anuncio' : 'Nuevo anuncio';
  document.getElementById('ann_id').value = ann?.id||'';
  document.getElementById('ann_title').value = ann?.title||'';
  document.getElementById('ann_body').value = ann?.body||'';
  document.getElementById('ann_team').value = ann?.team||'Golden Moms';
  document.getElementById('ann_pinned').checked = ann?.pinned||false;
  document.getElementById('btnDeleteAnn').style.display = ann ? '' : 'none';
  openDialog(annModalBg, document.getElementById('ann_title'));
}
function closeAnnModal(){ closeDialog(annModalBg); editingAnnId=null; }

document.getElementById('btnNewAnn').addEventListener('click',()=>openAnnModal());
document.getElementById('btnCloseAnn').addEventListener('click',closeAnnModal);
annModalBg.addEventListener('click',e=>{if(e.target===annModalBg)closeAnnModal();});

document.getElementById('btnDeleteAnn').addEventListener('click', async ()=>{
  if(!editingAnnId||!supa||!IS_CONNECTED) return;
  if(!confirm('¿Eliminar este anuncio?')) return;
  try{
    const {error}=await supa.from('announcements').delete().eq('id',editingAnnId);
    if(error) throw error;
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  closeAnnModal(); renderBoard();
});

document.getElementById('btnSaveAnn').addEventListener('click', async ()=>{
  const title=document.getElementById('ann_title').value.trim();
  if(!title){ alert('El título es obligatorio.'); return; }
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const payload={
    title,
    body: document.getElementById('ann_body').value.trim()||null,
    team: document.getElementById('ann_team').value,
    pinned: document.getElementById('ann_pinned').checked,
  };
  try{
    if(editingAnnId){
      const {error}=await supa.from('announcements').update(payload).eq('id',editingAnnId);
      if(error) throw error;
    } else {
      const {error}=await supa.from('announcements').insert([payload]);
      if(error) throw error;
    }
  } catch(err){ alert('Error: '+(err.message||err)); return; }
  closeAnnModal(); renderBoard();
});

async function renderBoard(){
  const list=document.getElementById('boardList');
  list.innerHTML='';
  if(!supa||!IS_CONNECTED){ list.innerHTML='<div class="empty-state">Sin conexión</div>'; return; }
  try{
    const {data,error}=await supa.from('announcements').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false});
    if(error) throw error;
    if(!data?.length){ list.innerHTML='<div class="empty-state"><span class="empty-state-icon">📢</span>Sin anuncios. ¡Publica el primero!</div>'; return; }
    for(const ann of data){
      const card=document.createElement('div');card.className='ann-card'+(ann.pinned?' pinned':'');
      if(ann.pinned){
        const pin=document.createElement('div');pin.className='ann-pin-badge';pin.textContent='📌 Destacado';card.appendChild(pin);
      }
      const title=document.createElement('div');title.className='ann-title';title.textContent=ann.title;card.appendChild(title);
      if(ann.body){const body=document.createElement('div');body.className='ann-body';body.textContent=ann.body;card.appendChild(body);}
      const meta=document.createElement('div');meta.className='ann-meta';
      const d=safeDate(ann.created_at);
      const teamBadge=document.createElement('span');
      teamBadge.className='ev-team-badge '+teamBadgeClass(ann.team==='Todos'?TEAMS.GM:ann.team);
      teamBadge.textContent=ann.team;
      meta.appendChild(teamBadge);
      if(d){ const dt=document.createElement('span');dt.textContent=d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'});meta.appendChild(dt); }
      const editBtn=document.createElement('button');editBtn.className='ann-edit-btn';editBtn.textContent='✏️ Editar';
      editBtn.addEventListener('click',()=>openAnnModal(ann));meta.appendChild(editBtn);
      // WhatsApp share
      const waText = '📢 *' + ann.title + '*' + (ann.body ? '\n\n' + ann.body : '') + '\n\n_Golden Moms_';
      const waBtn = document.createElement('button');
      waBtn.className='btn-wa';
      waBtn.innerHTML = WA_ICON + ' Compartir al grupo';
      waBtn.addEventListener('click', () => waGroupSend(waText));
      meta.appendChild(waBtn);
      card.appendChild(meta);
      list.appendChild(card);
    }
  } catch(err){ console.error('renderBoard',err); list.innerHTML='<div class="empty-state">Error cargando anuncios</div>'; }
}

/* ═══════════════════════════════════════════════════════════
   CUOTAS
   ══════════════════════════════════════════════════════════ */
const feeModalBg=document.getElementById('feeModalBg');
let editingFeeId=null;
let feePaymentsState={}; // player_id → boolean

async function openFeeModal(fee=null){
  editingFeeId=fee?.id||null;
  feePaymentsState={};
  feeExcludedPlayers=new Set();
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
  openDialog(feeModalBg, document.getElementById('fee_title'));

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

// Track which players are excluded from this fee
let feeExcludedPlayers = new Set();

function renderFeePaymentsGrid(players){
  const pgrid=document.getElementById('fee_payments_grid');
  pgrid.innerHTML='';
  for(const p of players){
    if(feeExcludedPlayers.has(p.id)) continue; // skip excluded
    const paid=feePaymentsState[p.id]||false;
    const row=document.createElement('div');row.className='fee-player-row';
    row.dataset.pid=p.id;
    const av=document.createElement('div');av.className='att-avatar';av.style.width='28px';av.style.height='28px';av.style.fontSize='11px';
    av.textContent=(p.apodo||p.nombre||'?')[0].toUpperCase();
    const nm=document.createElement('div');nm.className='fee-player-name';nm.style.flex='1';nm.textContent=p.apodo||p.nombre||'—';
    const toggle=document.createElement('button');toggle.type='button';
    toggle.className='fee-toggle '+(paid?'paid':'unpaid');
    toggle.textContent=paid?'✅ Pagó':'❌ Debe';
    toggle.dataset.pid=p.id;
    toggle.addEventListener('click',()=>{
      feePaymentsState[p.id]=!feePaymentsState[p.id];
      toggle.className='fee-toggle '+(feePaymentsState[p.id]?'paid':'unpaid');
      toggle.textContent=feePaymentsState[p.id]?'✅ Pagó':'❌ Debe';
    });
    // Remove player button
    const removeBtn=document.createElement('button');removeBtn.type='button';
    removeBtn.style.cssText='background:none;border:none;color:var(--muted-2);font-size:15px;cursor:pointer;padding:2px 4px;margin-left:4px;line-height:1;border-radius:4px';
    removeBtn.title='Quitar de esta cuota';
    removeBtn.textContent='✕';
    removeBtn.addEventListener('click',()=>{
      feeExcludedPlayers.add(p.id);
      delete feePaymentsState[p.id];
      row.remove();
    });
    row.appendChild(av);row.appendChild(nm);row.appendChild(toggle);row.appendChild(removeBtn);
    pgrid.appendChild(row);
  }
}

document.getElementById('fee_team').addEventListener('change', ()=>{
  if(!allPlayers.length) return;
  const t=document.getElementById('fee_team').value;
  const filtered=t==='Todos'?allPlayers:allPlayers.filter(p=>Array.isArray(p.equipos)&&p.equipos.includes(t));
  renderFeePaymentsGrid(filtered);
});

function closeFeeModal(){ closeDialog(feeModalBg); editingFeeId=null; feePaymentsState={}; }
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
      // Delete payments for excluded players
      if(feeExcludedPlayers.size > 0){
        await supa.from('fee_payments')
          .delete()
          .eq('fee_id', feeId)
          .in('player_id', [...feeExcludedPlayers]);
      }
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
   EXPORTAR PLANTEL A EXCEL
   ══════════════════════════════════════════════════════════ */
const XLSX_TEMPLATE_B64 = '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';

async function exportRosterExcel() {
  if(!supa||!IS_CONNECTED){ alert('Sin conexión.'); return; }
  const btn = document.getElementById('btnExportRoster');
  const origText = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Generando…';
  try {
    const { data:players, error } = await supa.from('players')
      .select('apodo,nombre,numero_camiseta,fecha_nacimiento,rut,celular,email,estado,equipos,rol')
      .order('apodo', {ascending:true});
    if(error) throw error;

    const XLSX = await ensureXlsxLib();
    const wb = XLSX.read(XLSX_TEMPLATE_B64, {type:'base64'});
    const ws = wb.Sheets[wb.SheetNames[0]];

    const filterTeam = currentRosterFilter;
    let filtered = players || [];
    if(filterTeam !== 'all')
      filtered = filtered.filter(p => Array.isArray(p.equipos) && p.equipos.includes(filterTeam));

    filtered.forEach((p, i) => {
      const row = 5 + i;
      const estadoLabel = p.estado === 'activo' ? 'Activa' : p.estado === 'reposo' ? 'Reposo' : '';
      const birthStr = p.fecha_nacimiento ? p.fecha_nacimiento.slice(0,10) : '';
      ws['A'+row] = {v: i+1, t:'n'};
      ws['B'+row] = {v: p.apodo||'', t:'s'};
      ws['C'+row] = {v: p.nombre||'', t:'s'};
      ws['D'+row] = {v: p.numero_camiseta!=null ? p.numero_camiseta : '', t: p.numero_camiseta!=null?'n':'s'};
      ws['E'+row] = {v: birthStr, t:'s'};
      ws['F'+row] = {v: p.rut||'', t:'s'};
      ws['G'+row] = {v: p.celular||'', t:'s'};
      ws['H'+row] = {v: p.email||'', t:'s'};
      ws['I'+row] = {v: estadoLabel, t:'s'};
    });

    ws['!ref'] = 'A1:I' + Math.max(56, 5 + filtered.length);

    const teamLabel = filterTeam === 'all' ? 'Todos los equipos' : filterTeam;
    const dateStr = new Date().toLocaleDateString('es-CL', {day:'2-digit',month:'long',year:'numeric'});
    if(ws['A2']) { ws['A2'].v = teamLabel + ' · ' + filtered.length + ' jugadoras · ' + dateStr; ws['!merges'] && ws['!merges'].forEach(m => { if(m.s.r===1) m.e.c=8; }); }

    const safeTeam = filterTeam === 'all' ? 'Todos' : filterTeam.replace(/ /g,'_');
    const filename = 'Plantel_GoldenMoms_' + safeTeam + '_' + new Date().toISOString().slice(0,10) + '.xlsx';
    XLSX.writeFile(wb, filename);
    showToast('✅ Excel descargado — ' + filtered.length + ' jugadoras');
  } catch(err) {
    console.error('exportRosterExcel', err);
    alert('Error al exportar: ' + (err.message||err));
  } finally {
    btn.disabled = false; btn.textContent = origText;
  }
}

document.getElementById('btnExportRoster').addEventListener('click', exportRosterExcel);

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
  setBellExpanded(false);
}

// Bell toggle
document.getElementById('bellBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById('notifDropdown');
  if(!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  setBellExpanded(isOpen);
});
document.addEventListener('click', (e) => {
  if(!e.target.closest('#bellBtn') && !e.target.closest('#notifDropdown')){
    closeNotifDropdown();
  }
});


/* ═══════════════════════════════════════════════════════════
   PANEL TESORERA — clave + KPIs + eventos especiales
   ══════════════════════════════════════════════════════════ */
const TREAS_KEY        = 'gm_treas_auth';
const TREAS_SESSION_MS = 45 * 60 * 1000;
const MONTHLY_AMOUNT = 20000;
let treasUnlocked   = false;
let editingTreasEventId = null;

function loadTreasAuth(){
  treasUnlocked = false;
  if(currentUser?.role === 'admin'){
    treasUnlocked = true;
    return true;
  }
  try {
    const raw = sessionStorage.getItem(TREAS_KEY);
    if(!raw) return false;
    if(raw === '1'){
      treasUnlocked = true;
      return true;
    }
    const parsed = JSON.parse(raw);
    if(parsed?.role === 'admin' && parsed.expiresAt > Date.now()){
      treasUnlocked = true;
      return true;
    }
    sessionStorage.removeItem(TREAS_KEY);
  } catch(e){
    try { sessionStorage.removeItem(TREAS_KEY); } catch(inner) {}
  }
  return false;
}
function checkTreasAuth(){
  return loadTreasAuth();
}
function setTreasAuth(user){
  treasUnlocked = true;
  try {
    sessionStorage.setItem(TREAS_KEY, JSON.stringify({
      username: user?.username || '',
      role: 'admin',
      expiresAt: Date.now() + TREAS_SESSION_MS
    }));
  } catch(e){}
}
function clearTreasAuth(){
  treasUnlocked = false;
  try { sessionStorage.removeItem(TREAS_KEY); } catch(e){}
}
function resetTreasView(){
  document.getElementById('feesList').innerHTML = '';
  document.getElementById('expensesList').innerHTML = '';
  document.getElementById('kIncome').textContent = '$0';
  document.getElementById('kExpense').textContent = '$0';
  document.getElementById('kBalance').textContent = '$0';
}
function showTreasLock(){
  const lock = document.getElementById('treasLock');
  if(lock) lock.style.display = 'flex';
  resetTreasView();
  const err = document.getElementById('treasPwdErr');
  if(err) err.textContent = '';
  const userInput = document.getElementById('treasUserInput');
  const pwdInput = document.getElementById('treasPwdInput');
  if(userInput) userInput.value = '';
  if(pwdInput) pwdInput.value = '';
  requestAnimationFrame(() => userInput?.focus());
}
function hideTreasLock(){
  const lock = document.getElementById('treasLock');
  if(lock) lock.style.display = 'none';
}

document.getElementById('treasUnlockBtn')?.addEventListener('click', async () => {
  const userInput = document.getElementById('treasUserInput');
  const pwdInput = document.getElementById('treasPwdInput');
  const username = (userInput?.value || '').trim().toLowerCase();
  const password = pwdInput?.value || '';
  const err = document.getElementById('treasPwdErr');
  const btn = document.getElementById('treasUnlockBtn');

  if(!username || !password){
    if(err) err.textContent = 'Ingresa usuario y contrasena';
    return;
  }
  if(!supa || !IS_CONNECTED){
    if(err) err.textContent = 'Sin conexion. Intenta de nuevo en un momento';
    return;
  }

  if(btn){
    btn.disabled = true;
    btn.textContent = 'Verificando...';
  }
  if(err) err.textContent = '';

  try {
    const playerUser = await findPlayerUser(username);
    if(!playerUser){
      if(err) err.textContent = 'Usuario o contrasena incorrectos';
      return;
    }
    if(playerUser.role !== 'admin'){
      if(err) err.textContent = 'Esta cuenta no tiene acceso a Tesorera';
      return;
    }
    const ok = await verifyPlayerUserPassword(playerUser, password);
    if(!ok){
      if(err) err.textContent = 'Usuario o contrasena incorrectos';
      if(pwdInput) pwdInput.value = '';
      return;
    }

    const user = buildSessionUser(playerUser);
    setTreasAuth(user);
    saveSession(user);
    hideLoginScreen();
    updateUserUI();
    addAdminControls();
    hideTreasLock();
    renderFees();
    renderTreasKPIs();
    renderExpenses();
  } catch(e) {
    console.warn('Treasury auth error', e);
    if(err) err.textContent = 'No se pudo validar el acceso';
  } finally {
    if(btn){
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }
});
document.getElementById('treasPwdInput')?.addEventListener('keydown', e => {
  if(e.key === 'Enter'){
    e.preventDefault();
    document.getElementById('treasUnlockBtn')?.click();
  }
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
  openDialog(document.getElementById('treasEventModalBg'), document.getElementById('te_title'));
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
  closeDialog(document.getElementById('treasEventModalBg'));
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
  const isFirst = n===1;
  document.getElementById('standView1').style.display = isFirst?'':'none';
  document.getElementById('standView2').style.display = isFirst?'none':'';
  document.getElementById('standView1').hidden = !isFirst;
  document.getElementById('standView2').hidden = isFirst;
  document.getElementById('standTab1').classList.toggle('active', isFirst);
  document.getElementById('standTab2').classList.toggle('active', !isFirst);
  document.getElementById('standTab1').setAttribute('aria-selected', isFirst ? 'true' : 'false');
  document.getElementById('standTab2').setAttribute('aria-selected', isFirst ? 'false' : 'true');
  document.getElementById('standTab1').setAttribute('tabindex', isFirst ? '0' : '-1');
  document.getElementById('standTab2').setAttribute('tabindex', isFirst ? '-1' : '0');
  if(!isFirst) loadTournaments();
}

/* ═══════════════════════════════════════════════════════════
   TOURNAMENTS — Football standings table with groups support
   ══════════════════════════════════════════════════════════ */
let currentTournamentId = null;
let tournamentTeamsCache = [];
let currentGroup = 'all'; // 'all' or 'A','B','C',...
let tournamentFinished = false; // true when tournament is marked as finished

async function loadTournaments(){
  if(!supa||!IS_CONNECTED) return;
  const sel = document.getElementById('tournamentSelect');
  const {data} = await supa.from('tournaments').select('*').order('created_at',{ascending:false});
  sel.innerHTML = '<option value="">— Seleccionar torneo —</option>';
  (data||[]).forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name; sel.appendChild(o); });
  if(currentTournamentId){ sel.value=currentTournamentId; renderTournamentStandings(currentTournamentId); }
}

document.getElementById('tournamentSelect')?.addEventListener('change', e=>{
  currentTournamentId = e.target.value||null;
  const empty = document.getElementById('tournamentEmpty');
  const wrap  = document.getElementById('tournamentStandingsWrap');
  const hdr   = document.getElementById('tournamentHeader');
  if(currentTournamentId){ renderTournamentStandings(currentTournamentId); }
  else {
    if(wrap) wrap.style.display='none';
    if(hdr)  hdr.style.display='none';
    if(empty) empty.style.display='';
  }
});

document.getElementById('btnNewTournament')?.addEventListener('click', async ()=>{
  const name = prompt('Nombre del torneo:');
  if(!name?.trim()) return;
  const {data,error} = await supa.from('tournaments').insert([{name:name.trim()}]).select('id');
  if(error){ alert('Error: '+error.message); return; }
  currentTournamentId = data?.[0]?.id;
  await loadTournaments();
  showToast('✅ Torneo creado');
});

document.getElementById('btnFinishTournament')?.addEventListener('click', async ()=>{
  if(!currentTournamentId) return;
  const newFinished = !tournamentFinished;
  const msg = newFinished ? '¿Marcar este torneo como finalizado? Se mostrarán las medallas 🥇🥈🥉' : '¿Reabrir el torneo?';
  if(!confirm(msg)) return;
  await supa.from('tournaments').update({finished: newFinished}).eq('id', currentTournamentId);
  renderTournamentStandings(currentTournamentId);
  showToast(newFinished ? '🏆 Torneo finalizado' : '🔓 Torneo reabierto');
});

document.getElementById('btnDeleteTournament')?.addEventListener('click', async ()=>{
  if(!currentTournamentId||!confirm('¿Eliminar este torneo y todos sus datos?')) return;
  await supa.from('tournament_results').delete().eq('tournament_id',currentTournamentId);
  await supa.from('tournament_teams').delete().eq('tournament_id',currentTournamentId);
  await supa.from('tournaments').delete().eq('id',currentTournamentId);
  currentTournamentId=null; tournamentTeamsCache=[];
  loadTournaments();
  document.getElementById('tournamentStandingsWrap').style.display='none';
  document.getElementById('tournamentHeader').style.display='none';
  document.getElementById('tournamentEmpty').style.display='';
  showToast('Torneo eliminado');
});

document.getElementById('btnManageTournamentTeams')?.addEventListener('click', ()=>{
  if(!currentTournamentId) return;
  openAddTeamModal();
});

function openAddTeamModal(existing=null){
  document.getElementById('addTeamModal')?.remove();
  // Get existing groups for suggestions
  const existingGroups = [...new Set(tournamentTeamsCache.map(t=>t.grupo||'A'))].sort();
  const groupOpts = existingGroups.length
    ? existingGroups.map(g=>`<option value="${g}">${g}</option>`).join('')
    : '<option value="A">A</option>';
  const allGroupOpts = 'ABCDEFGH'.split('').map(g=>`<option value="${g}">${g}</option>`).join('');

  const modal = document.createElement('div');
  modal.id='addTeamModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:700;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML=
    '<div style="background:var(--surface);border-radius:var(--r-lg);padding:24px;width:100%;max-width:360px;box-shadow:var(--sh-3)">'+
    '<div style="font-family:var(--font-head);font-weight:800;font-size:16px;margin-bottom:16px;color:var(--ink)">'+(existing?'✏️ Editar equipo':'👥 Agregar equipo')+'</div>'+
    '<label style="font-size:11px;font-weight:700;color:var(--muted-2);text-transform:uppercase;display:block;margin-bottom:4px">Nombre del equipo</label>'+
    '<input id="addTeamName" class="input" style="width:100%;margin-bottom:12px;box-sizing:border-box" placeholder="Ej: Real Madrid" value="'+(existing?.name||'')+'"/>'+
    '<label style="font-size:11px;font-weight:700;color:var(--muted-2);text-transform:uppercase;display:block;margin-bottom:4px">Grupo / Fase</label>'+
    '<div style="display:flex;gap:8px;margin-bottom:16px">'+
      '<select id="addTeamGroup" class="input" style="flex:1">'+allGroupOpts+'</select>'+
      '<input id="addTeamGroupCustom" class="input" style="width:80px" placeholder="Otro" title="O escribí un nombre de fase: Semifinal, etc."/>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:16px">💡 Usá A, B, C para grupos de fase regular. Podés escribir "Semifinal" o "Final" para fases eliminatorias.</div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end">'+
      (existing?'<button id="atDeleteBtn" class="btn danger">🗑 Eliminar</button>':'')+
      '<button id="atCancelBtn" class="btn">Cancelar</button>'+
      '<button id="atSaveBtn" class="btn p">💾 Guardar</button>'+
    '</div></div>';
  document.body.appendChild(modal);

  // Set current group
  const grpSel = document.getElementById('addTeamGroup');
  if(existing?.grupo) grpSel.value = existing.grupo;

  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.getElementById('atCancelBtn').onclick = ()=> modal.remove();

  document.getElementById('atDeleteBtn')?.addEventListener('click', async ()=>{
    if(!existing||!confirm('¿Eliminar '+existing.name+' del torneo?')) return;
    await supa.from('tournament_results').delete().or('home_team_id.eq.'+existing.id+',away_team_id.eq.'+existing.id);
    await supa.from('tournament_teams').delete().eq('id',existing.id);
    modal.remove();
    renderTournamentStandings(currentTournamentId);
    showToast('Equipo eliminado');
  });

  document.getElementById('atSaveBtn').addEventListener('click', async ()=>{
    const name = document.getElementById('addTeamName').value.trim();
    const customGrp = document.getElementById('addTeamGroupCustom').value.trim();
    const grupo = customGrp || document.getElementById('addTeamGroup').value || 'A';
    if(!name){ showToast('⚠️ Ingresá el nombre del equipo'); return; }
    if(existing){
      const {error} = await supa.from('tournament_teams').update({name,grupo}).eq('id',existing.id);
      if(error){ showError('Error al actualizar: '+error.message); return; }
      showToast('✅ Equipo actualizado');
    } else {
      const {error} = await supa.from('tournament_teams').insert([{tournament_id:currentTournamentId,name,grupo}]);
      if(error){ showError('Error al agregar: '+error.message); return; }
      showToast('✅ Equipo agregado al grupo '+grupo);
    }
    modal.remove();
    renderTournamentStandings(currentTournamentId);
  });
}

document.getElementById('btnAddMatchToTournament')?.addEventListener('click', async ()=>{
  if(!currentTournamentId) return;
  if(!tournamentTeamsCache.length){ alert('Primero agregá equipos al torneo'); return; }
  showMatchResultModal();
});

/* ── Inline match result modal ─────────────────────── */
function showMatchResultModal(existing=null){
  // Remove old if exists
  document.getElementById('matchResultModal')?.remove();

  const teams = tournamentTeamsCache;
  const allGroups = [...new Set(teams.map(t=>t.grupo||'A'))].sort();
  const multiGrp = allGroups.length > 1;

  // Build group filter selector if multi-group
  const groupFilterHtml = multiGrp
    ? '<div style="margin-bottom:12px">'+
        '<label style="font-size:11px;font-weight:700;color:var(--muted-2);text-transform:uppercase;display:block;margin-bottom:4px">Filtrar por grupo</label>'+
        '<select id="mrGroupFilter" class="input" style="width:100%">'+
          '<option value="all">Todos los grupos</option>'+
          allGroups.map(g=>'<option value="'+g+'">Grupo '+g+'</option>').join('')+
        '</select>'+
      '</div>'
    : '';

  function getFilteredOpts(filterGrp){
    const filtered = filterGrp==='all' ? teams : teams.filter(t=>(t.grupo||'A')===filterGrp);
    return filtered.map(t=>{
      const label = multiGrp ? escapeHTML(t.name)+' ('+( t.grupo||'A')+')' : escapeHTML(t.name);
      return '<option value="'+t.id+'">'+label+'</option>';
    }).join('');
  }
  const opts = getFilteredOpts('all');

  const modal = document.createElement('div');
  modal.id='matchResultModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML=
    '<div style="background:var(--surface);border-radius:var(--r-lg);padding:24px;width:100%;max-width:380px;box-shadow:var(--sh-3)">'+
    '<div style="font-family:var(--font-head);font-weight:800;font-size:16px;margin-bottom:16px;color:var(--ink)">⚽ '+(existing?'Editar resultado':'Cargar resultado')+'</div>'+
    groupFilterHtml+
    '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:16px">'+
      '<div>'+
        '<label style="font-size:11px;font-weight:700;color:var(--muted-2);text-transform:uppercase;display:block;margin-bottom:4px">Local</label>'+
        '<select id="mrHome" class="input" style="width:100%">'+opts+'</select>'+
      '</div>'+
      '<div style="text-align:center">'+
        '<div style="display:flex;gap:6px;align-items:center;margin-top:18px">'+
          '<input id="mrHomeGoals" type="number" min="0" class="input" style="width:50px;text-align:center;font-size:20px;font-weight:800;padding:8px 4px" value="'+(existing?existing.home_goals:0)+'"/>'+
          '<span style="font-weight:800;color:var(--muted)">-</span>'+
          '<input id="mrAwayGoals" type="number" min="0" class="input" style="width:50px;text-align:center;font-size:20px;font-weight:800;padding:8px 4px" value="'+(existing?existing.away_goals:0)+'"/>'+
        '</div>'+
      '</div>'+
      '<div>'+
        '<label style="font-size:11px;font-weight:700;color:var(--muted-2);text-transform:uppercase;display:block;margin-bottom:4px">Visitante</label>'+
        '<select id="mrAway" class="input" style="width:100%">'+opts+'</select>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end">'+
      (existing?'<button id="mrDeleteBtn" class="btn danger">🗑 Eliminar</button>':'')+
      '<button id="mrCancelBtn" class="btn">Cancelar</button>'+
      '<button id="mrSaveBtn" class="btn p">💾 Guardar</button>'+
    '</div></div>';

  document.body.appendChild(modal);

  if(existing){
    document.getElementById('mrHome').value = existing.home_team_id;
    document.getElementById('mrAway').value = existing.away_team_id;
  }

  document.getElementById('mrCancelBtn').onclick = ()=> modal.remove();
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

  // Group filter change → update team dropdowns
  document.getElementById('mrGroupFilter')?.addEventListener('change', e=>{
    const newOpts = getFilteredOpts(e.target.value);
    document.getElementById('mrHome').innerHTML = newOpts;
    document.getElementById('mrAway').innerHTML = newOpts;
  });

  document.getElementById('mrDeleteBtn')?.addEventListener('click', async ()=>{
    if(!existing||!confirm('¿Eliminar este resultado?')) return;
    await supa.from('tournament_results').delete().eq('id',existing.id);
    modal.remove();
    renderTournamentStandings(currentTournamentId);
    showToast('Resultado eliminado');
  });

  document.getElementById('mrSaveBtn').addEventListener('click', async ()=>{
    const homeId = document.getElementById('mrHome').value;
    const awayId = document.getElementById('mrAway').value;
    const hg = parseInt(document.getElementById('mrHomeGoals').value);
    const ag = parseInt(document.getElementById('mrAwayGoals').value);
    if(homeId===awayId){ alert('El local y visitante no pueden ser el mismo equipo'); return; }
    if(isNaN(hg)||isNaN(ag)||hg<0||ag<0){ alert('Ingresá goles válidos'); return; }
    const payload={tournament_id:currentTournamentId,home_team_id:homeId,away_team_id:awayId,home_goals:hg,away_goals:ag};
    if(existing){
      await supa.from('tournament_results').update(payload).eq('id',existing.id);
    } else {
      await supa.from('tournament_results').insert([payload]);
    }
    modal.remove();
    renderTournamentStandings(currentTournamentId);
    showToast('✅ Resultado guardado');
  });
}

function buildStandingsTable(teams, results){
  // Returns a styled <div> with the standings table for a given set of teams+results
  const rows={};
  teams.forEach(t=>{ rows[t.id]={id:t.id,name:t.name,grupo:t.grupo||'A',pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}; });
  for(const r of results){
    const h=rows[r.home_team_id]; const a=rows[r.away_team_id];
    if(!h||!a) continue;
    h.pj++;a.pj++;h.gf+=r.home_goals;h.gc+=r.away_goals;a.gf+=r.away_goals;a.gc+=r.home_goals;
    if(r.home_goals>r.away_goals){h.g++;h.pts+=3;a.p++;}
    else if(r.home_goals===r.away_goals){h.e++;h.pts++;a.e++;a.pts++;}
    else{a.g++;a.pts+=3;h.p++;}
  }
  const sorted=Object.values(rows).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf);

  const wrap = document.createElement('div');
  wrap.style.cssText='overflow-x:auto;border-radius:10px;border:1px solid var(--line-2);box-shadow:var(--sh-1);-webkit-overflow-scrolling:touch';
  const table = document.createElement('table');
  table.style.cssText='width:100%;border-collapse:collapse;font-size:13px;min-width:360px';
  table.innerHTML=
    '<thead><tr style="background:#2d6a4f;color:#fff">'+
      '<th style="padding:9px 6px;font-size:11px;text-align:center;width:28px">#</th>'+
      '<th style="padding:9px 10px;font-size:11px;text-align:left">EQUIPO</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center" title="Partidos Jugados">PJ</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center" title="Ganados">PG</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center" title="Empatados">PE</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center" title="Perdidos">PP</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center">GF</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center">GC</th>'+
      '<th style="padding:9px 5px;font-size:11px;text-align:center">DG</th>'+
      '<th style="padding:9px 8px;font-size:11px;text-align:center;background:#1a3a2a">Pts</th>'+
    '</tr></thead>';
  const tbody = document.createElement('tbody');

  if(!sorted.length){
    tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted-2)">Sin equipos — agregá con 👥</td></tr>';
  } else {
    sorted.forEach((r,i)=>{
      const tr=document.createElement('tr');
      const dif=r.gf-r.gc;
      tr.style.background=i===0?'#f0fdf4':i%2===0?'#fafafa':'#fff';
      const medal=tournamentFinished?(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)):(i+1);
      const difStr=dif>0?'+'+dif:String(dif);
      const difColor=dif>0?'#16a34a':dif<0?'#ef4444':'var(--ink)';
      tr.innerHTML=
        '<td style="text-align:center;padding:9px 5px;font-weight:800;font-size:12px;color:var(--muted)">'+medal+'</td>'+
        '<td style="padding:9px 10px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:underline dotted" title="Editar equipo" data-team-id="'+r.id+'">'+escapeHTML(r.name)+'</td>'+
        '<td style="text-align:center;padding:9px 5px;color:var(--muted)">'+r.pj+'</td>'+
        '<td style="text-align:center;padding:9px 5px;color:#16a34a;font-weight:700">'+r.g+'</td>'+
        '<td style="text-align:center;padding:9px 5px;color:#f59e0b;font-weight:700">'+r.e+'</td>'+
        '<td style="text-align:center;padding:9px 5px;color:#ef4444;font-weight:700">'+r.p+'</td>'+
        '<td style="text-align:center;padding:9px 5px">'+r.gf+'</td>'+
        '<td style="text-align:center;padding:9px 5px">'+r.gc+'</td>'+
        '<td style="text-align:center;padding:9px 5px;font-weight:700;color:'+difColor+'">'+difStr+'</td>'+
        '<td style="text-align:center;padding:9px 8px;font-weight:900;font-size:15px;background:#f0fdf4;color:#166534">'+r.pts+'</td>';
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  // Click on team name to edit
  wrap.querySelectorAll('[data-team-id]').forEach(td=>{
    td.addEventListener('click',()=>{
      const team = tournamentTeamsCache.find(t=>t.id===td.dataset.teamId);
      if(team) openAddTeamModal(team);
    });
  });
  return wrap;
}

async function renderTournamentStandings(tid){
  const container = document.getElementById('tournamentGroupsContainer');
  const groupTabsBar = document.getElementById('groupTabsBar');
  if(!container) return;
  document.getElementById('tournamentStandingsWrap').style.display='';
  document.getElementById('tournamentHeader').style.display='';
  document.getElementById('tournamentEmpty').style.display='none';
  container.innerHTML='<div style="padding:16px;color:var(--muted);text-align:center">Cargando…</div>';

  const {data:tournament} = await supa.from('tournaments').select('*').eq('id',tid).maybeSingle();
  const {data:teams} = await supa.from('tournament_teams').select('*').eq('tournament_id',tid).order('name');
  const {data:results} = await supa.from('tournament_results').select('*').eq('tournament_id',tid);

  tournamentTeamsCache = teams||[];

  // Update header & finished state
  tournamentFinished = tournament?.finished || false;
  if(tournament){
    const hn = document.getElementById('tournamentHeaderName');
    const hs = document.getElementById('tournamentHeaderStats');
    if(hn) hn.textContent = tournament.name;
    if(hs) hs.textContent = (teams?.length||0)+' equipos · '+(results?.length||0)+' partidos'+(tournamentFinished?' · 🏆 Finalizado':'');
    // Update finish button
    const finBtn = document.getElementById('btnFinishTournament');
    if(finBtn){
      finBtn.textContent = tournamentFinished ? '🔓 Reabrir torneo' : '🏆 Finalizar torneo';
      finBtn.style.background = tournamentFinished ? 'rgba(255,255,255,.1)' : 'rgba(255,215,0,.25)';
    }
  }

  // ── Detect groups ──────────────────────────────────────
  const allGroups = [...new Set((teams||[]).map(t=>t.grupo||'A'))].sort();
  const multiGroup = allGroups.length > 1;

  // Build group filter tabs
  if(groupTabsBar){
    if(multiGroup){
      groupTabsBar.style.display='flex';
      groupTabsBar.innerHTML='';
      ['all',...allGroups].forEach(g=>{
        const btn = document.createElement('button');
        btn.className = 'tab' + (currentGroup===g?' active':'');
        btn.textContent = g==='all' ? '📊 Todos' : 'Grupo '+g;
        btn.style.cssText='font-size:12px;padding:5px 12px';
        btn.addEventListener('click',()=>{
          currentGroup=g;
          renderGroupStandings(teams||[], results||[], allGroups, multiGroup);
          groupTabsBar.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
        });
        groupTabsBar.appendChild(btn);
      });
    } else {
      groupTabsBar.style.display='none';
      currentGroup='all';
    }
  }

  renderGroupStandings(teams||[], results||[], allGroups, multiGroup);

  // ── Results list ────────────────────────────────────────
  const matchList = document.getElementById('tournamentMatchList');
  if(matchList){
    const teamMap = Object.fromEntries((teams||[]).map(t=>[t.id,t.name]));
    matchList.innerHTML='';
    if(!(results?.length)){
      matchList.innerHTML='<div style="font-size:12px;color:var(--muted-2);padding:8px 0">Sin resultados cargados</div>';
    } else {
      [...(results||[])].reverse().forEach(r=>{
        const homeGoals=r.home_goals; const awayGoals=r.away_goals;
        const winner = homeGoals>awayGoals?'home':homeGoals<awayGoals?'away':'draw';
        const ht = teamMap[r.home_team_id]||'?';
        const at = teamMap[r.away_team_id]||'?';
        const row=document.createElement('div');
        row.style.cssText='display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;padding:8px 10px;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;font-size:12px;cursor:pointer';
        row.innerHTML=
          '<span style="font-weight:'+(winner==='home'?'800':'500')+';color:'+(winner==='home'?'var(--ink)':'var(--muted)')+'">'+escapeHTML(ht)+'</span>'+
          '<span style="font-family:var(--font-head);font-weight:900;font-size:14px;text-align:center;letter-spacing:2px;color:var(--ink)">'+homeGoals+' - '+awayGoals+'</span>'+
          '<span style="font-weight:'+(winner==='away'?'800':'500')+';color:'+(winner==='away'?'var(--ink)':'var(--muted)')+';text-align:right">'+escapeHTML(at)+'</span>';
        row.title='Editar resultado';
        row.addEventListener('click',()=>showMatchResultModal({...r}));
        matchList.appendChild(row);
      });
    }
  }
}

function renderGroupStandings(teams, results, allGroups, multiGroup){
  const container = document.getElementById('tournamentGroupsContainer');
  if(!container) return;
  container.innerHTML='';

  const groupsToShow = currentGroup==='all' ? allGroups : [currentGroup];

  groupsToShow.forEach(grupo=>{
    const groupTeams = teams.filter(t=>(t.grupo||'A')===grupo);
    // Filter results: only matches between teams in this group
    const groupTeamIds = new Set(groupTeams.map(t=>t.id));
    const groupResults = results.filter(r=>groupTeamIds.has(r.home_team_id)&&groupTeamIds.has(r.away_team_id));

    const section = document.createElement('div');
    section.style.cssText='margin-bottom:18px';

    if(multiGroup){
      const title = document.createElement('div');
      title.style.cssText='font-family:var(--font-head);font-weight:800;font-size:14px;color:#fff;background:linear-gradient(90deg,#2d6a4f,#1a3a2a);padding:8px 14px;border-radius:8px 8px 0 0;margin-bottom:0';
      title.textContent='Grupo '+grupo;
      section.appendChild(title);
    }

    section.appendChild(buildStandingsTable(groupTeams, groupResults));
    container.appendChild(section);
  });

  if(!container.children.length){
    container.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted-2)">Sin equipos en este grupo</div>';
  }
}

/* ═══════════════════════════════════════════════════════════
   EXPENSES
   ══════════════════════════════════════════════════════════ */
let editingExpenseId = null;

async function renderExpenses(){
  const list=document.getElementById('expensesList');
  if(!list||!supa||!IS_CONNECTED) return;
  list.innerHTML='';
  const {data:expenses}=await supa.from('expenses').select('*').order('created_at',{ascending:false});
  if(!expenses?.length){ list.innerHTML='<div class="empty-state"><span class="empty-state-icon">📤</span>Sin egresos registrados</div>'; return; }
  for(const exp of expenses){
    const {data:pays}=await supa.from('expense_payments').select('*,players(apodo,nombre,celular)').eq('expense_id',exp.id);
    const paidAmt=(pays||[]).filter(p=>p.paid).reduce((s,p)=>s+Number(p.amount||0),0);
    const totalAmt=Number(exp.total_amount)||0;
    const paidCount=(pays||[]).filter(p=>p.paid).length;
    const totalPayers=(pays||[]).length;
    const pct=totalPayers>0?Math.round(paidCount/totalPayers*100):0;

    const card=document.createElement('div'); card.className='fee-card';

    // ── Header (clickable to expand/collapse) ─────────
    const header=document.createElement('div'); header.className='fee-header'; header.style.cursor='pointer';
    const left=document.createElement('div'); left.style.flex='1';
    const titleEl=document.createElement('div'); titleEl.className='fee-title'; titleEl.textContent=exp.title||'';
    const meta=document.createElement('div'); meta.className='fee-meta';
    const metaParts=[];
    if(exp.date) metaParts.push(exp.date);
    if(exp.team) metaParts.push(exp.team);
    if(exp.notes) metaParts.push(exp.notes);
    meta.textContent=metaParts.join(' · ');
    const sumLine=document.createElement('div'); sumLine.className='fee-meta exp-sum-line'; sumLine.style.marginTop='2px';
    sumLine.innerHTML='<span style="color:#16a34a;font-weight:700">$'+paidAmt.toLocaleString('es-CL')+' cobrado</span> / <span style="color:var(--muted)">$'+totalAmt.toLocaleString('es-CL')+' total</span>';
    left.appendChild(titleEl); left.appendChild(meta); left.appendChild(sumLine);

    const right=document.createElement('div'); right.style.cssText='display:flex;align-items:center;gap:10px;flex-shrink:0';
    if(totalPayers>0){
      const prog=document.createElement('div'); prog.className='fee-progress-wrap';
      prog.innerHTML='<div class="fee-progress-bg"><div class="fee-progress-fill" style="width:'+pct+'%"></div></div><div class="fee-pct">'+paidCount+'/'+totalPayers+'</div>';
      right.appendChild(prog);
    }
    const editBtn=document.createElement('button'); editBtn.className='fee-edit-btn'; editBtn.textContent='✏️ Editar';
    editBtn.addEventListener('click',e=>{ e.stopPropagation(); openExpenseModal(exp.id); });
    right.appendChild(editBtn);
    header.appendChild(left); header.appendChild(right);

    // ── Collapsible body ────────────────────────────────
    const body=document.createElement('div'); body.className='fee-body fee-collapsed';

    if(pays?.length){
      for(const pay of pays){
        const pl=pay.players;
        const pname=(pl?.apodo||pl?.nombre||'?');
        const row=document.createElement('div'); row.className='fee-player-row';
        const nm=document.createElement('span'); nm.className='fee-player-name'; nm.textContent=pname;
        const amt=document.createElement('span'); amt.style.cssText='font-size:12px;color:var(--muted);margin-right:6px;flex-shrink:0';
        amt.textContent='$'+Number(pay.amount||0).toLocaleString('es-CL');
        const toggle=document.createElement('span'); toggle.className='fee-toggle '+(pay.paid?'paid':'unpaid');
        toggle.textContent=pay.paid?'✅ Cobrado':'❌ Pendiente'; toggle.style.cursor='pointer';
        const waBtn=document.createElement('a'); waBtn.className='btn-wa'; waBtn.style.fontSize='11px';
        waBtn.textContent='📲 Recordar'; waBtn.href='#'; waBtn.style.display=pay.paid?'none':'';
        waBtn.addEventListener('click',async e=>{ e.preventDefault();
          const msg='Hola '+pname+' 👋 Recordamos pago pendiente *'+escapeHTML(exp.title)+'* por $'+Number(pay.amount||0).toLocaleString('es-CL')+' 💚 Golden Moms';
          if(navigator.share) navigator.share({text:msg}).catch(()=>{});
          else navigator.clipboard?.writeText(msg).then(()=>showToast('Copiado'));
        });
        toggle.addEventListener('click',async()=>{
          const np=!pay.paid;
          await supa.from('expense_payments').update({paid:np,paid_at:np?new Date().toISOString():null}).eq('id',pay.id);
          pay.paid=np;
          toggle.className='fee-toggle '+(np?'paid':'unpaid');
          toggle.textContent=np?'✅ Cobrado':'❌ Pendiente';
          waBtn.style.display=np?'none':'';
          const newPaid=(pays||[]).filter(p=>p.paid).reduce((s,p)=>s+Number(p.amount||0),0);
          sumLine.innerHTML='<span style="color:#16a34a;font-weight:700">$'+newPaid.toLocaleString('es-CL')+' cobrado</span> / <span style="color:var(--muted)">$'+totalAmt.toLocaleString('es-CL')+' total</span>';
          renderTreasKPIs();
        });
        row.appendChild(nm); row.appendChild(amt); row.appendChild(toggle); row.appendChild(waBtn);
        body.appendChild(row);
      }
      // Group reminder
      const unpaidPays=(pays||[]).filter(p=>!p.paid);
      if(unpaidPays.length){
        const grpRow=document.createElement('div'); grpRow.style.cssText='padding:6px 0 2px;border-top:1px solid var(--line);margin-top:4px';
        const grpBtn=document.createElement('button'); grpBtn.className='btn'; grpBtn.style.cssText='width:100%;font-size:12px;padding:6px 10px';
        grpBtn.textContent='📢 Recordatorio grupal ('+unpaidPays.length+' pendientes)';
        grpBtn.addEventListener('click',async()=>{
          const {data:pl2}=await supa.from('players').select('id,apodo,nombre').in('id',unpaidPays.map(p=>p.player_id));
          const names=(pl2||[]).map(p=>p.apodo||p.nombre||'').filter(Boolean);
          const msg='💸 *Recordatorio — '+exp.title+'*\n\nFaltan por pagar:\n'+names.map(n=>'• '+n).join('\n')+'\n\n$'+totalAmt.toLocaleString('es-CL')+' total\n\n💚 Golden Moms';
          if(navigator.share) navigator.share({text:msg}).catch(()=>{});
          else navigator.clipboard?.writeText(msg).then(()=>showToast('📋 Mensaje copiado'));
        });
        grpRow.appendChild(grpBtn); body.appendChild(grpRow);
      }
    } else {
      body.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Sin jugadoras asignadas — editá para dividir</div>';
    }

    header.addEventListener('click',()=>{ body.classList.toggle('fee-collapsed'); });
    card.appendChild(header); card.appendChild(body);
    list.appendChild(card);
  }
}
// Expense modal
async function openExpenseModal(expId=null){
  editingExpenseId=expId;
  document.getElementById('expenseModalTitle').textContent=expId?'Editar egreso':'Nuevo egreso';
  document.getElementById('btnDeleteExpense').style.display=expId?'':'none';
  document.getElementById('exp_title').value='';
  document.getElementById('exp_total').value='';
  document.getElementById('exp_date').value='';
  document.getElementById('exp_notes').value='';
  document.getElementById('exp_split_chk').checked=false;
  document.getElementById('exp_split_section').style.display='none';
  document.getElementById('exp_players_grid').innerHTML='';
  if(expId){
    const {data:exp}=await supa.from('expenses').select('*').eq('id',expId).maybeSingle();
    if(exp){
      document.getElementById('exp_title').value=exp.title||'';
      document.getElementById('exp_total').value=exp.total_amount||'';
      document.getElementById('exp_date').value=exp.date||'';
      document.getElementById('exp_notes').value=exp.notes||'';
      document.getElementById('exp_team').value=exp.team||'Golden Moms';
    }
    const {data:pays}=await supa.from('expense_payments').select('*,players(id,apodo,nombre)').eq('expense_id',expId);
    if(pays?.length){
      document.getElementById('exp_split_chk').checked=true;
      document.getElementById('exp_split_section').style.display='';
      const grid=document.getElementById('exp_players_grid');
      pays.forEach(p=>{
        const row=document.createElement('div'); row.className='treas-player-row';
        const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=true; chk.dataset.pid=p.player_id;
        const nm=document.createElement('span'); nm.className='treas-player-name'; nm.textContent=p.players?.apodo||p.players?.nombre||'?';
        const amtIn=document.createElement('input'); amtIn.type='number'; amtIn.className='treas-amount-input'; amtIn.dataset.pid=p.player_id; amtIn.value=p.amount||0;
        row.appendChild(chk); row.appendChild(nm); row.appendChild(amtIn); grid.appendChild(row);
      });
    }
  }
  openDialog(document.getElementById('expenseModalBg'), document.getElementById('exp_title'));
}

document.getElementById('exp_split_chk')?.addEventListener('change', async e=>{
  document.getElementById('exp_split_section').style.display=e.target.checked?'':'none';
  if(!e.target.checked) return;
  // Load active players
  const {data:players}=await supa.from('players').select('id,apodo,nombre,equipos,estado').eq('estado','activo').order('apodo',{ascending:true});
  const team=document.getElementById('exp_team').value;
  const filtered=team==='Todos'?players:(players||[]).filter(p=>team==='Golden Moms'||( Array.isArray(p.equipos)&&p.equipos.includes(team)));
  const total=Number(document.getElementById('exp_total').value)||0;
  const share=filtered.length?Math.round(total/filtered.length):0;
  const grid=document.getElementById('exp_players_grid'); grid.innerHTML='';
  (filtered||[]).forEach(p=>{
    const row=document.createElement('div'); row.className='treas-player-row';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=true; chk.dataset.pid=p.id;
    const nm=document.createElement('span'); nm.className='treas-player-name'; nm.textContent=p.apodo||p.nombre||'—';
    const amtIn=document.createElement('input'); amtIn.type='number'; amtIn.className='treas-amount-input'; amtIn.dataset.pid=p.id; amtIn.value=share;
    // When unchecking, recalculate
    chk.addEventListener('change',()=>{
      const checked=[...grid.querySelectorAll('input[type=checkbox]:checked')];
      const tot=Number(document.getElementById('exp_total').value)||0;
      const sh=checked.length?Math.round(tot/checked.length):0;
      grid.querySelectorAll('.treas-amount-input').forEach(inp=>{ if(grid.querySelector('input[data-pid="'+inp.dataset.pid+'"]:checked')) inp.value=sh; });
    });
    row.appendChild(chk); row.appendChild(nm); row.appendChild(amtIn); grid.appendChild(row);
  });
});

document.getElementById('exp_total')?.addEventListener('input',()=>{
  const tot=Number(document.getElementById('exp_total').value)||0;
  const checked=[...document.querySelectorAll('#exp_players_grid input[type=checkbox]:checked')];
  if(!checked.length) return;
  const sh=Math.round(tot/checked.length);
  checked.forEach(chk=>{ const inp=document.querySelector('.treas-amount-input[data-pid="'+chk.dataset.pid+'"]'); if(inp) inp.value=sh; });
});

function closeExpenseModal(){
  closeDialog(document.getElementById('expenseModalBg'));
  editingExpenseId=null;
}
document.getElementById('btnCancelExpense')?.addEventListener('click', closeExpenseModal);
document.getElementById('expenseModalBg')?.addEventListener('click',e=>{ if(e.target===document.getElementById('expenseModalBg')) closeExpenseModal(); });

document.getElementById('btnSaveExpense')?.addEventListener('click', async()=>{
  const title=document.getElementById('exp_title').value.trim();
  const total=Number(document.getElementById('exp_total').value)||0;
  if(!title||!total){ alert('Falta descripción o monto'); return; }
  const payload={title,total_amount:total,date:document.getElementById('exp_date').value||null,team:document.getElementById('exp_team').value,notes:document.getElementById('exp_notes').value.trim()||null};
  try{
    let eid=editingExpenseId;
    if(eid){ await supa.from('expenses').update(payload).eq('id',eid); }
    else { const {data}=await supa.from('expenses').insert([payload]).select('id'); eid=data?.[0]?.id; }
    // Save player splits
    if(document.getElementById('exp_split_chk').checked && eid){
      const checks=[...document.querySelectorAll('#exp_players_grid input[type=checkbox]:checked')];
      const upserts=checks.map(chk=>({ expense_id:eid, player_id:chk.dataset.pid, amount:Number(document.querySelector('.treas-amount-input[data-pid="'+chk.dataset.pid+'"]')?.value)||0, paid:false }));
      if(upserts.length) await supa.from('expense_payments').upsert(upserts,{onConflict:'expense_id,player_id'});
    }
    closeExpenseModal();
    renderExpenses(); renderTreasKPIs(); showToast('✅ Egreso guardado');
  } catch(e){ alert('Error: '+(e.message||e)); }
});

document.getElementById('btnDeleteExpense')?.addEventListener('click',async()=>{
  if(!editingExpenseId||!confirm('¿Eliminar este egreso?')) return;
  await supa.from('expense_payments').delete().eq('expense_id',editingExpenseId);
  await supa.from('expenses').delete().eq('id',editingExpenseId);
  closeExpenseModal();
  renderExpenses(); renderTreasKPIs();
});

document.getElementById('btnNewExpense')?.addEventListener('click',()=>openExpenseModal());

// Update renderTreasKPIs to include expense data


// Init: check session auth when fees tab opens
// (handled in overridden showView above)


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
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function loadSession() {
  currentUser = null;
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed?.player_id && parsed?.username){
      currentUser = parsed;
      return;
    }
    if(parsed?.user && parsed.expiresAt > Date.now()){
      currentUser = parsed.user;
      return;
    }
    sessionStorage.removeItem(AUTH_KEY);
  } catch(e) {
    currentUser = null;
  }
}
function saveSession(user) {
  currentUser = user;
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({
      user,
      expiresAt: Date.now() + SESSION_TTL_MS
    }));
  } catch(e) {}
}
function clearSession() {
  currentUser = null;
  try { sessionStorage.removeItem(AUTH_KEY); } catch(e) {}
}
async function findPlayerUser(username) {
  if(!supa || !IS_CONNECTED) throw new Error('Sin conexion');
  const { data, error } = await supa.from('player_users')
    .select('*, players(id,apodo,nombre,numero_camiseta,foto,rol,email)')
    .eq('username', username)
    .eq('active', true)
    .maybeSingle();
  if(error) throw error;
  return data || null;
}
async function verifyPlayerUserPassword(playerUser, password) {
  const pl = playerUser?.players;
  const email = pl?.email || playerUser?.email || '';
  if(email && supa?.auth){
    const { error: authError } = await supa.auth.signInWithPassword({ email, password });
    if(!authError) return true;
  }
  const hash = await sha256(password);
  return hash === playerUser?.pwd_hash;
}
function buildSessionUser(playerUser) {
  const pl = playerUser?.players || {};
  return {
    player_id: pl.id,
    username: playerUser?.username,
    role: playerUser?.role || pl.role || 'jugadora',
    apodo: pl.apodo || '',
    nombre: pl.nombre || '',
    numero_camiseta: pl.numero_camiseta,
    foto: pl.foto || ''
  };
}

// ── Login flow ────────────────────────────────────────────
let loginFoundUser = null; // player_user row found in step 1
let registerablePlayers = [];

function setRegisterError(message=''){
  const err = document.getElementById('registerErr');
  if(err) err.textContent = message;
}
function resetRegisterForm(){
  document.getElementById('registerPlayer').value = '';
  document.getElementById('registerBirth').value = '';
  document.getElementById('registerUser').value = '';
  document.getElementById('registerPwd').value = '';
  document.getElementById('registerPwd2').value = '';
  document.getElementById('registerSubmitBtn').disabled = false;
  document.getElementById('registerSubmitBtn').textContent = 'Crear acceso';
  setRegisterError('');
}
function returnToLoginStep1(){
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginRegisterStep').style.display = 'none';
  document.getElementById('loginStep1').style.display = '';
  document.getElementById('loginPwd').value = '';
  document.getElementById('loginErr1').textContent = '';
  document.getElementById('loginErr2').textContent = '';
  document.getElementById('loginNextBtn').textContent = 'Continuar';
  loginFoundUser = null;
  resetRegisterForm();
  setTimeout(() => document.getElementById('loginUser')?.focus(), 50);
}
async function openRegisterStep(){
  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginRegisterStep').style.display = '';
  resetRegisterForm();
  const select = document.getElementById('registerPlayer');
  const submit = document.getElementById('registerSubmitBtn');
  if(select){
    select.innerHTML = '<option value="">Cargando jugadoras...</option>';
    select.disabled = true;
  }
  if(submit){
    submit.disabled = true;
    submit.textContent = 'Preparando...';
  }
  setRegisterError(IS_CONNECTING || !IS_CONNECTED ? 'Conectando con la app...' : '');
  await loadRegisterablePlayers();
  document.getElementById('registerPlayer')?.focus();
}
function getRegisterPlayerLabel(player){
  const base = player.apodo || player.nombre || 'Jugadora';
  const details = [];
  if(player.nombre && player.apodo && player.nombre !== player.apodo) details.push(player.nombre);
  if(player.numero_camiseta) details.push('#' + player.numero_camiseta);
  return details.length ? base + ' - ' + details.join(' ') : base;
}
function suggestUsername(player){
  const source = String(player.apodo || player.nombre || 'jugadora').toLowerCase();
  const base = source.replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'jugadora';
  return player.numero_camiseta ? (base + player.numero_camiseta).slice(0, 18) : base;
}
async function loadRegisterablePlayers(){
  const select = document.getElementById('registerPlayer');
  const submit = document.getElementById('registerSubmitBtn');
  if(!select || !submit) return;
  select.innerHTML = '<option value="">Cargando jugadoras...</option>';
  select.disabled = true;
  submit.disabled = true;
  setRegisterError('');
  if(!supa || !IS_CONNECTED){
    select.innerHTML = '<option value="">Conectando...</option>';
    setRegisterError('Conectando con la app...');
    const ready = await ensureSupabaseReady();
    if(!ready){
      select.innerHTML = '<option value="">Sin conexion</option>';
      setRegisterError('No se pudo conectar. Intenta de nuevo en unos segundos.');
      submit.textContent = 'Crear acceso';
      return;
    }
  }
  try {
    const { data:players, error:playersError } = await supa.from('players')
      .select('id,apodo,nombre,numero_camiseta,fecha_nacimiento,estado')
      .eq('estado','activo')
      .order('apodo', { ascending:true });
    if(playersError) throw playersError;
    const { data:users, error:usersError } = await supa.from('player_users').select('player_id');
    if(usersError) throw usersError;
    const takenPlayerIds = new Set((users || []).map(user => user.player_id));
    registerablePlayers = (players || []).filter(player => !takenPlayerIds.has(player.id));
    submit.textContent = 'Crear acceso';
    select.innerHTML = '<option value="">Selecciona tu nombre</option>';
    registerablePlayers.forEach(player => {
      const option = document.createElement('option');
      option.value = player.id;
      option.textContent = getRegisterPlayerLabel(player);
      select.appendChild(option);
    });
    const hasPlayers = registerablePlayers.length > 0;
    select.disabled = !hasPlayers;
    submit.disabled = !hasPlayers;
    if(!hasPlayers) setRegisterError('No hay jugadoras disponibles para auto-registro.');
  } catch(err) {
    console.warn('loadRegisterablePlayers', err);
    submit.textContent = 'Crear acceso';
    select.innerHTML = '<option value="">No se pudo cargar la lista</option>';
    setRegisterError('No se pudo cargar la lista de jugadoras.');
  }
}
async function completeLoginFromPlayerUser(playerUser){
  const user = buildSessionUser(playerUser);
  saveSession(user);
  if(user.role === 'admin') setTreasAuth(user);
  hideLoginScreen();
  updateUserUI();
  addAdminControls();
  let openedFromLink = false;
  if(pendingAttendanceLinkId) {
    const eventId = pendingAttendanceLinkId;
    pendingAttendanceLinkId = null;
    openedFromLink = await openAttendanceFromLink(eventId);
  }
  if(!openedFromLink) {
    showView('dash');
    renderPlayerDash();
  }
}
async function registerPlayerAccess(){
  const playerId = document.getElementById('registerPlayer').value;
  const birthDate = document.getElementById('registerBirth').value;
  const username = (document.getElementById('registerUser').value || '').trim().toLowerCase();
  const password = document.getElementById('registerPwd').value || '';
  const password2 = document.getElementById('registerPwd2').value || '';
  const submit = document.getElementById('registerSubmitBtn');
  const player = registerablePlayers.find(item => String(item.id) === String(playerId));

  if(!player){ setRegisterError('Selecciona tu jugadora.'); return; }
  if(!player.fecha_nacimiento){ setRegisterError('Tu ficha no tiene fecha de nacimiento. Pide ayuda a la capitana.'); return; }
  if(!birthDate){ setRegisterError('Ingresa tu fecha de nacimiento.'); return; }
  if((player.fecha_nacimiento || '').slice(0,10) !== birthDate){ setRegisterError('La fecha de nacimiento no coincide.'); return; }
  if(!/^[a-z0-9._-]{3,20}$/.test(username)){ setRegisterError('Usa un usuario de 3 a 20 caracteres: letras, numeros, punto, guion o guion bajo.'); return; }
  if(password.length < 6){ setRegisterError('La contrasena debe tener al menos 6 caracteres.'); return; }
  if(password !== password2){ setRegisterError('Las contrasenas no coinciden.'); return; }
  if(!supa || !IS_CONNECTED){
    setRegisterError('Conectando con la app...');
    const ready = await ensureSupabaseReady();
    if(!ready){
      setRegisterError('No se pudo conectar. Intenta de nuevo.');
      return;
    }
  }

  submit.disabled = true;
  submit.textContent = 'Creando acceso...';
  setRegisterError('');

  try {
    const { data:existingUser, error:existingUserError } = await supa.from('player_users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if(existingUserError) throw existingUserError;
    if(existingUser){
      setRegisterError('Ese usuario ya existe.');
      return;
    }

    const { data:existingPlayerUser, error:existingPlayerError } = await supa.from('player_users')
      .select('id')
      .eq('player_id', player.id)
      .maybeSingle();
    if(existingPlayerError) throw existingPlayerError;
    if(existingPlayerUser){
      await loadRegisterablePlayers();
      setRegisterError('Esta jugadora ya tiene cuenta.');
      return;
    }

    const { error:insertError } = await supa.from('player_users').insert([{
      player_id: player.id,
      username,
      role: 'jugadora',
      active: true,
      pwd_hash: await sha256(password)
    }]);
    if(insertError) throw insertError;

    const createdUser = await findPlayerUser(username);
    if(!createdUser){
      setRegisterError('La cuenta se creo, pero no se pudo iniciar sesion automaticamente.');
      returnToLoginStep1();
      document.getElementById('loginUser').value = username;
      showToast('Cuenta creada. Ingresa con tu nuevo usuario.');
      return;
    }

    showToast('Cuenta creada con exito.');
    await completeLoginFromPlayerUser(createdUser);
  } catch(err) {
    console.warn('registerPlayerAccess', err);
    setRegisterError('No se pudo crear la cuenta. Intenta de nuevo.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Crear acceso';
  }
}

document.getElementById('loginRegisterOpenBtn')?.addEventListener('click', openRegisterStep);
document.getElementById('registerBackBtn')?.addEventListener('click', returnToLoginStep1);
document.getElementById('loginBackBtn')?.addEventListener('click', returnToLoginStep1);
document.getElementById('registerSubmitBtn')?.addEventListener('click', registerPlayerAccess);
document.getElementById('registerPwd2')?.addEventListener('keydown', e => { if(e.key==='Enter') registerPlayerAccess(); });
document.getElementById('registerUser')?.addEventListener('keydown', e => { if(e.key==='Enter') registerPlayerAccess(); });
document.getElementById('registerPlayer')?.addEventListener('change', e => {
  const player = registerablePlayers.find(item => String(item.id) === String(e.target.value));
  const input = document.getElementById('registerUser');
  if(player && input && !input.value.trim()) input.value = suggestUsername(player);
});

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
  if(!username) { err1.textContent='Ingresa tu usuario'; return; }
  if(!supa || !IS_CONNECTED) {
    err1.textContent = 'Conectando con la app...';
    document.getElementById('loginNextBtn').textContent = 'Conectando...';
    const ready = await ensureSupabaseReady();
    if(!ready){
      document.getElementById('loginNextBtn').textContent = 'Continuar';
      err1.textContent = 'No se pudo conectar. Intenta de nuevo.';
      return;
    }
  }
  err1.textContent = '';
  document.getElementById('loginNextBtn').textContent = 'Buscando...';
  try {
    const data = await findPlayerUser(username);
    document.getElementById('loginNextBtn').textContent = 'Continuar';
    if(!data) { err1.textContent='Usuario no encontrado'; return; }
    loginFoundUser = data;
    document.getElementById('loginStep1').style.display = 'none';
    const step2 = document.getElementById('loginStep2');
    step2.style.display = '';
    const pl = data.players;
    const name = pl?.apodo || pl?.nombre || username;
    const avatar = document.getElementById('loginAvatar');
    avatar.style.backgroundImage = '';
    avatar.style.backgroundSize = '';
    avatar.textContent = name[0].toUpperCase();
    document.getElementById('loginPlayerName').textContent = name;
    document.getElementById('loginPlayerRole').textContent = data.role === 'admin' ? 'Administradora' : 'Jugadora';
    if(pl?.foto) {
      avatar.style.backgroundImage='url('+pl.foto+')';
      avatar.style.backgroundSize='cover';
      avatar.textContent='';
    }
    setTimeout(() => document.getElementById('loginPwd')?.focus(), 100);
  } catch(err) {
    document.getElementById('loginNextBtn').textContent = 'Continuar';
    err1.textContent = 'Error al buscar usuario';
    console.warn(err);
  }
}

// Step 2: verify password
document.getElementById('loginSubmitBtn')?.addEventListener('click', loginStep2);
document.getElementById('loginPwd')?.addEventListener('keydown', e => { if(e.key==='Enter') loginStep2(); });
async function loginStep2() {
  const pwd = document.getElementById('loginPwd')?.value||'';
  const err2 = document.getElementById('loginErr2');
  if(!pwd) { err2.textContent='Ingresa tu contrasena'; return; }
  if(!loginFoundUser) { err2.textContent='Primero selecciona tu usuario'; return; }
  err2.textContent='';
  document.getElementById('loginSubmitBtn').textContent='Verificando...';
  try {
    const ok = await verifyPlayerUserPassword(loginFoundUser, pwd);
    if(!ok) {
      err2.textContent = 'Contrasena incorrecta';
      document.getElementById('loginSubmitBtn').textContent = 'Entrar';
      document.getElementById('loginPwd').value = '';
      return;
    }

    await completeLoginFromPlayerUser(loginFoundUser);
  } catch(err) {
    err2.textContent = 'Error de conexion, intenta de nuevo';
    document.getElementById('loginSubmitBtn').textContent = 'Entrar';
    console.warn(err);
  }
}

function updateUserUI() {
  const pill = document.getElementById('userPill');
  const pillAv = document.getElementById('userPillAv');
  const pillName = document.getElementById('userPillName');
  if(!currentUser) {
    if(pill) pill.style.display = 'none';
    document.getElementById('playerDashCard').style.display='none';
    return;
  }
  if(pill) pill.style.display = 'flex';
  const name = currentUser.apodo || currentUser.nombre || currentUser.username;
  if(pillAv) pillAv.textContent = name[0].toUpperCase();
  if(pillName) pillName.textContent = name;
  const mSel = document.getElementById('mobileNavSelect');
  if(mSel) mSel.value = document.querySelector('.nav .tab.active')?.dataset.view || 'dash';
}

function showLogoutMenu() {
  if(!currentUser) return;
  const name = currentUser.apodo || currentUser.nombre || currentUser.username;
  if(confirm('Cerrar sesion de ' + name + '?')) {
    clearSession();
    clearTreasAuth();
    if(supa?.auth) supa.auth.signOut().catch(() => {});
    document.getElementById('loginUser').value='';
    document.getElementById('loginPwd').value='';
    updateUserUI();
    showView('dash');
    showLoginScreen();
    returnToLoginStep1();
  }
}

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
  if(!currentUser) {
    updateBell([]);
    return;
  }
  if(currentUser.role === 'admin') {
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
