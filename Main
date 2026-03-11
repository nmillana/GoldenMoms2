/* ═══════════════════════════════════════════════════════
   main.js — Punto de entrada de la aplicación
   Importa todos los módulos y lanza DOMContentLoaded
   ═══════════════════════════════════════════════════════ */
'use strict';

import { initSupabase, updateConnStatus } from './supabase.js';
import { showView, addAdminControls } from './router.js';
import { renderDash, renderPlayerDash, updateUserUI } from './dashboard.js';
import { renderMonth, openAttModal } from './events.js';
import { renderRoster, currentRosterFilter } from './roster.js';
import { renderMatches } from './dashboard.js';
import { renderStats } from './stats.js';
import { renderBoard } from './board.js';
import { renderFees, renderTreasKPIs, renderExpenses, checkTreasAuth, hideTreasLock, preloadMonthlyCuotas, loadNotifications } from './fees.js';
import { initAuth } from './auth.js';
import { supa, IS_CONNECTED, currentUser } from './state.js';
import { showToast } from './helpers.js';

/* ═══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  document.querySelectorAll('.nav .tab').forEach(btn => {
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav .tab').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');
      const view=btn.dataset.view;
      try{ localStorage.setItem('gm_view',view); } catch(e){}
      showView(view);
    });
  });

  // Check for deep link: ?att=EVENT_ID → open attendance modal directly
  const urlParams = new URLSearchParams(window.location.search);
  const attParam  = urlParams.get('att');

  if(attParam && supa && IS_CONNECTED) {
    // Navigate to events view first
    document.querySelectorAll('.nav .tab').forEach(b=>b.classList.remove('active'));
    const evTab = document.querySelector('.nav .tab[data-view="events"]');
    if(evTab) evTab.classList.add('active');
    showView('events');
    closeModal(); closePlayerModal();

    // Fetch the event and open attendance modal
    try {
      const { data: ev, error } = await supa.from('events').select('*').eq('id', attParam).maybeSingle();
      if(ev && !error) {
        // Small delay to let the calendar render first
        setTimeout(() => openAttModal(ev), 350);
      } else {
        showToast('⚠️ No se encontró el evento');
        const persisted=(()=>{ try{ return localStorage.getItem('gm_view'); } catch(e){ return null; } })();
        showView(persisted||'dash');
      }
    } catch(err) {
      console.warn('Deep link error:', err);
    }
    // Clean URL without reloading
    history.replaceState({}, '', window.location.pathname);
  } else {
    const persisted=(()=>{ try{ return localStorage.getItem('gm_view'); } catch(e){ return null; } })();
    const initialView=persisted||'dash';
    document.querySelectorAll('.nav .tab').forEach(b=>b.classList.remove('active'));
    const toActivate=document.querySelector(`.nav .tab[data-view="${initialView}"]`);
    if(toActivate) toActivate.classList.add('active');
    await initAuth();
    if(currentUser) {
      updateUserUI();
      addAdminControls();
      showView('dash');
      renderPlayerDash();
    }
    closeModal();
    closePlayerModal();
  }
});
