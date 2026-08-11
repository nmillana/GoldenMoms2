/* Wonder Mom's Cup Clausura 2026
 * Modulo aditivo para GoldenMoms2. No modifica Tesoreria ni el registro historico
 * de partidos. Requiere la migracion tournament_schedule.
 */
(function () {
  'use strict';

  const TOURNAMENT_NAME = "Wonder Mom's Cup Clausura 2026";
  const VENUE = 'Zapping Sport Center - Club Palestino';
  const FINAL_DATE_LABEL = 'Definiciones por confirmar en SofaScore';
  const REGULAR_DATES = [
    '2026-08-27', '2026-09-03', '2026-09-10', '2026-09-24',
    '2026-10-01', '2026-10-08', '2026-10-15'
  ];
  const TEAM_SEED = {
    A: ['Golden Dream', 'The British Queens', 'Las Juanas', 'Pedro Pé', 'Osas de Ossó', 'Les Guerrieres', 'SNM Queens', 'Golden Power'],
    B: ['Panteras', 'Mamurris', 'Pumahuinas', 'Queenlastair', 'Team Dragón', 'New Reds', 'Ssoccer Moms', 'Mamajuana']
  };
  const OFFICIAL_FIXTURES = [
    { jornada: 1, date: '2026-08-27', time: '20:00', group: 'A', home: 'Golden Dream', away: 'The British Queens' },
    { jornada: 1, date: '2026-08-27', time: '20:00', group: 'A', home: 'Las Juanas', away: 'Pedro Pé' },
    { jornada: 1, date: '2026-08-27', time: '20:00', group: 'B', home: 'Panteras', away: 'Mamurris' },
    { jornada: 1, date: '2026-08-27', time: '20:00', group: 'B', home: 'Pumahuinas', away: 'Queenlastair' },
    { jornada: 1, date: '2026-08-27', time: '20:00', group: 'B', home: 'Team Dragón', away: 'New Reds' },
    { jornada: 1, date: '2026-08-27', time: '21:00', group: 'A', home: 'Osas de Ossó', away: 'Les Guerrieres' },
    { jornada: 1, date: '2026-08-27', time: '21:00', group: 'A', home: 'SNM Queens', away: 'Golden Power' },
    { jornada: 1, date: '2026-08-27', time: '21:00', group: 'B', home: 'Ssoccer Moms', away: 'Mamajuana' },
    { jornada: 2, date: '2026-09-03', time: '20:00', group: 'A', home: 'Las Juanas', away: 'Les Guerrieres' },
    { jornada: 2, date: '2026-09-03', time: '20:00', group: 'A', home: 'SNM Queens', away: 'Osas de Ossó' },
    { jornada: 2, date: '2026-09-03', time: '20:00', group: 'A', home: 'The British Queens', away: 'Golden Power' },
    { jornada: 2, date: '2026-09-03', time: '20:00', group: 'B', home: 'Pumahuinas', away: 'Ssoccer Moms' },
    { jornada: 2, date: '2026-09-03', time: '20:00', group: 'B', home: 'Team Dragón', away: 'Mamajuana' },
    { jornada: 2, date: '2026-09-03', time: '21:00', group: 'A', home: 'Golden Dream', away: 'Pedro Pé' },
    { jornada: 2, date: '2026-09-03', time: '21:00', group: 'B', home: 'Mamurris', away: 'Queenlastair' },
    { jornada: 2, date: '2026-09-03', time: '21:00', group: 'B', home: 'Panteras', away: 'New Reds' },
    { jornada: 3, date: '2026-09-10', time: '20:00', group: 'A', home: 'Golden Dream', away: 'Golden Power' },
    { jornada: 3, date: '2026-09-10', time: '20:00', group: 'A', home: 'Pedro Pé', away: 'Les Guerrieres' },
    { jornada: 3, date: '2026-09-10', time: '20:00', group: 'B', home: 'Mamurris', away: 'Ssoccer Moms' },
    { jornada: 3, date: '2026-09-10', time: '20:00', group: 'B', home: 'New Reds', away: 'Mamajuana' },
    { jornada: 3, date: '2026-09-10', time: '20:00', group: 'B', home: 'Panteras', away: 'Queenlastair' },
    { jornada: 3, date: '2026-09-10', time: '21:00', group: 'A', home: 'Las Juanas', away: 'SNM Queens' },
    { jornada: 3, date: '2026-09-10', time: '21:00', group: 'A', home: 'The British Queens', away: 'Osas de Ossó' },
    { jornada: 3, date: '2026-09-10', time: '21:00', group: 'B', home: 'Pumahuinas', away: 'Team Dragón' },
    { jornada: 4, date: '2026-09-24', time: '20:00', group: 'A', home: 'Golden Power', away: 'Osas de Ossó' },
    { jornada: 4, date: '2026-09-24', time: '20:00', group: 'A', home: 'Las Juanas', away: 'The British Queens' },
    { jornada: 4, date: '2026-09-24', time: '20:00', group: 'A', home: 'SNM Queens', away: 'Pedro Pé' },
    { jornada: 4, date: '2026-09-24', time: '20:00', group: 'B', home: 'Pumahuinas', away: 'New Reds' },
    { jornada: 4, date: '2026-09-24', time: '20:00', group: 'B', home: 'Team Dragón', away: 'Mamurris' },
    { jornada: 4, date: '2026-09-24', time: '21:00', group: 'A', home: 'Les Guerrieres', away: 'Golden Dream' },
    { jornada: 4, date: '2026-09-24', time: '21:00', group: 'B', home: 'Mamajuana', away: 'Panteras' },
    { jornada: 4, date: '2026-09-24', time: '21:00', group: 'B', home: 'Queenlastair', away: 'Ssoccer Moms' },
    { jornada: 5, date: '2026-10-01', time: '20:00', group: 'A', home: 'Les Guerrieres', away: 'SNM Queens' },
    { jornada: 5, date: '2026-10-01', time: '20:00', group: 'A', home: 'Osas de Ossó', away: 'Golden Dream' },
    { jornada: 5, date: '2026-10-01', time: '20:00', group: 'B', home: 'Mamajuana', away: 'Pumahuinas' },
    { jornada: 5, date: '2026-10-01', time: '20:00', group: 'B', home: 'Ssoccer Moms', away: 'Panteras' },
    { jornada: 5, date: '2026-10-01', time: '20:00', group: 'B', home: 'Team Dragón', away: 'Queenlastair' },
    { jornada: 5, date: '2026-10-01', time: '21:00', group: 'A', home: 'Las Juanas', away: 'Golden Power' },
    { jornada: 5, date: '2026-10-01', time: '21:00', group: 'A', home: 'The British Queens', away: 'Pedro Pé' },
    { jornada: 5, date: '2026-10-01', time: '21:00', group: 'B', home: 'New Reds', away: 'Mamurris' },
    { jornada: 6, date: '2026-10-08', time: '20:00', group: 'A', home: 'Golden Power', away: 'Pedro Pé' },
    { jornada: 6, date: '2026-10-08', time: '20:00', group: 'A', home: 'Les Guerrieres', away: 'The British Queens' },
    { jornada: 6, date: '2026-10-08', time: '20:00', group: 'A', home: 'Osas de Ossó', away: 'Las Juanas' },
    { jornada: 6, date: '2026-10-08', time: '20:00', group: 'B', home: 'Mamajuana', away: 'Mamurris' },
    { jornada: 6, date: '2026-10-08', time: '20:00', group: 'B', home: 'New Reds', away: 'Queenlastair' },
    { jornada: 6, date: '2026-10-08', time: '21:00', group: 'A', home: 'Golden Dream', away: 'SNM Queens' },
    { jornada: 6, date: '2026-10-08', time: '21:00', group: 'B', home: 'Panteras', away: 'Pumahuinas' },
    { jornada: 6, date: '2026-10-08', time: '21:00', group: 'B', home: 'Ssoccer Moms', away: 'Team Dragón' },
    { jornada: 7, date: '2026-10-15', time: '20:00', group: 'A', home: 'Golden Dream', away: 'Las Juanas' },
    { jornada: 7, date: '2026-10-15', time: '20:00', group: 'A', home: 'The British Queens', away: 'SNM Queens' },
    { jornada: 7, date: '2026-10-15', time: '20:00', group: 'B', home: 'Mamurris', away: 'Pumahuinas' },
    { jornada: 7, date: '2026-10-15', time: '20:00', group: 'B', home: 'New Reds', away: 'Ssoccer Moms' },
    { jornada: 7, date: '2026-10-15', time: '20:00', group: 'B', home: 'Panteras', away: 'Team Dragón' },
    { jornada: 7, date: '2026-10-15', time: '21:00', group: 'A', home: 'Golden Power', away: 'Les Guerrieres' },
    { jornada: 7, date: '2026-10-15', time: '21:00', group: 'A', home: 'Pedro Pé', away: 'Osas de Ossó' },
    { jornada: 7, date: '2026-10-15', time: '22:00', group: 'B', home: 'Queenlastair', away: 'Mamajuana' }
  ];
  const OWN_TEAMS = new Set(['Golden Dream', 'Golden Power']);
  const SEED_INDEX = Object.fromEntries(Object.entries(TEAM_SEED).flatMap(([group, names]) => names.map((name, index) => [name, group.charCodeAt(0) * 100 + index])));
  let db = null;
  let dbSessionToken = null;
  let selectedTournamentId = null;
  let teams = [];
  let fixtures = [];
  let currentFilter = 'all';
  let currentTeamFilter = 'all';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtTime(value) {
    if (!value) return '';
    return String(value).slice(0, 5);
  }
  function fmtDate(date, label, time) {
    const timeText = fmtTime(time);
    const base = label || (date
      ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(date + 'T12:00:00'))
      : 'Fecha por confirmar');
    return timeText ? `${base} ${timeText}` : base;
  }
  function teamName(id, fallback) {
    return teams.find(t => String(t.id) === String(id))?.name || fallback || 'Por definir';
  }
  function teamGroup(id) {
    return teams.find(t => String(t.id) === String(id))?.grupo || '';
  }
  function isCompleted(match) {
    return match.home_goals !== null && match.home_goals !== undefined && match.away_goals !== null && match.away_goals !== undefined;
  }
  function isOwnTeam(name) { return OWN_TEAMS.has(name); }
  function tournamentSessionToken() {
    try {
      const raw = sessionStorage.getItem('gm_treasury_rpc_session');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      const exp = Date.parse(parsed.expires_at || '') || Number(parsed.expiresAt || 0);
      if (!parsed.session_token || !exp || exp <= Date.now()) return '';
      return parsed.session_token;
    } catch (e) {
      return '';
    }
  }
  function canManageTournament() {
    return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'admin';
  }
  function requireTournamentManager() {
    if (!canManageTournament()) {
      notify('Solo administradora puede editar el torneo');
      return false;
    }
    if (!tournamentSessionToken()) {
      notify('Ingresa a Tesorera para autorizar cambios del torneo');
      return false;
    }
    return true;
  }
  function seedOrder(name) { return SEED_INDEX[name] ?? 9999; }
  function unresolvedTie(a, b, resultRows) {
    return a.pts === b.pts && a.dg === b.dg && a.gf === b.gf && headToHead(a.id, b.id, resultRows) === 0;
  }
  function sortStandings(rows, resultRows) {
    const copy = rows.slice();
    copy.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      const head = headToHead(a.id, b.id, resultRows);
      if (head !== 0) return head > 0 ? -1 : 1;
      return seedOrder(a.name) - seedOrder(b.name);
    });
    copy.forEach(row => {
      row.tiePending = copy.some(other => other.id !== row.id && unresolvedTie(row, other, resultRows));
    });
    return copy;
  }
  function headToHead(aId, bId, resultRows) {
    let score = 0;
    resultRows.filter(m => m.phase === 'regular' && isCompleted(m) &&
      ((String(m.home_team_id) === String(aId) && String(m.away_team_id) === String(bId)) ||
       (String(m.home_team_id) === String(bId) && String(m.away_team_id) === String(aId))))
      .forEach(m => {
        const aHome = String(m.home_team_id) === String(aId);
        const ag = aHome ? Number(m.home_goals) : Number(m.away_goals);
        const bg = aHome ? Number(m.away_goals) : Number(m.home_goals);
        if (ag > bg) score += 1;
        if (ag < bg) score -= 1;
      });
    return score;
  }
  function computeStandings(group, resultRows) {
    const groupTeams = teams.filter(t => (t.grupo || 'A') === group);
    const rows = groupTeams.map(t => ({ id: t.id, name: t.name, grupo: group, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, last: [] }));
    const byId = Object.fromEntries(rows.map(r => [String(r.id), r]));
    const orderedResults = resultRows
      .filter(m => m.phase === 'regular' && isCompleted(m))
      .sort((a, b) => (Number(a.jornada) || 0) - (Number(b.jornada) || 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    orderedResults.forEach(m => {
      const home = byId[String(m.home_team_id)];
      const away = byId[String(m.away_team_id)];
      if (!home || !away) return;
      const hg = Number(m.home_goals);
      const ag = Number(m.away_goals);
      home.pj += 1; away.pj += 1;
      home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
      if (hg > ag) { home.g += 1; away.p += 1; home.pts += 3; home.last.push('W'); away.last.push('L'); }
      else if (hg < ag) { away.g += 1; home.p += 1; away.pts += 3; home.last.push('L'); away.last.push('W'); }
      else { home.e += 1; away.e += 1; home.pts += 1; away.pts += 1; home.last.push('D'); away.last.push('D'); }
    });
    rows.forEach(r => { r.dg = r.gf - r.gc; r.last = r.last.slice(-5); });
    return sortStandings(rows, resultRows);
  }
  function winnerOf(match) {
    if (!isCompleted(match)) return null;
    if (Number(match.home_goals) > Number(match.away_goals)) return match.home_team_id;
    if (Number(match.away_goals) > Number(match.home_goals)) return match.away_team_id;
    if (match.winner_team_id) return match.winner_team_id;
    if (match.home_penalties != null && match.away_penalties != null && match.home_penalties !== match.away_penalties) {
      return Number(match.home_penalties) > Number(match.away_penalties) ? match.home_team_id : match.away_team_id;
    }
    return null;
  }
  function injectStyles() {
    if (document.getElementById('wmTournamentStyles')) return;
    const style = document.createElement('style');
    style.id = 'wmTournamentStyles';
    style.textContent = `
      #tournamentHeader,#groupTabsBar,#tournamentStandingsWrap{display:none!important}#wmTournamentPanel{margin-top:10px}.wm-card{background:var(--surface,#fff);border:1px solid var(--line-2,#e5e7eb);border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:var(--sh-1,0 2px 8px rgba(0,0,0,.06))}.wm-hero{background:linear-gradient(135deg,#32152f,#641c55 58%,#8c286d);color:#fff;border:0}.wm-kicker{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;opacity:.78;font-weight:800}.wm-title{font:800 20px var(--font-head,Arial);margin-top:3px}.wm-muted{font-size:12px;color:var(--muted,#6b7280)}.wm-hero .wm-muted{color:rgba(255,255,255,.78)}.wm-actions,.wm-filters{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:12px}.wm-btn{border:1px solid var(--line,#ddd);background:#fff;color:var(--ink,#111);border-radius:9px;padding:8px 10px;font:700 12px var(--font-head,Arial);cursor:pointer}.wm-btn.primary{background:#a8e63d;border-color:#a8e63d;color:#17321e}.wm-btn.dark{background:#261c27;border-color:#261c27;color:#fff}.wm-select{border:1px solid var(--line,#ddd);border-radius:9px;background:#fff;color:var(--ink,#111);padding:8px 10px;font-size:12px;min-width:135px}.wm-warning{background:#fff9e8;border:1px solid #f2d38b;color:#765600;border-radius:10px;padding:10px;font-size:11px;line-height:1.45;margin-bottom:12px}.wm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wm-section-title{font:800 14px var(--font-head,Arial);margin-bottom:9px;color:var(--ink,#111)}.wm-table-wrap{overflow-x:auto}.wm-table{width:100%;border-collapse:collapse;min-width:620px;font-size:11px}.wm-table th{background:#32152f;color:#fff;padding:8px 5px;text-align:center}.wm-table th:nth-child(2),.wm-table td:nth-child(2){text-align:left}.wm-table td{padding:8px 5px;border-bottom:1px solid var(--line-2,#eee);text-align:center}.wm-table tr.own{background:#f2fbdf}.wm-table tr:nth-child(even){background:#fafafa}.wm-table tr.own:nth-child(even){background:#f2fbdf}.wm-pos{font-weight:900;color:#6b7280}.wm-team{font-weight:800;white-space:nowrap}.wm-team small{font-weight:500;color:#8a8a8a}.wm-tie{display:block;margin-top:2px;color:#9a6a00;font-size:9px;font-weight:700}.wm-form{display:inline-flex;gap:2px;justify-content:center;min-width:56px}.wm-form span{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;border-radius:5px;font-size:9px;font-weight:900;color:#111;background:#d1d5db}.wm-form .w{background:#52d273}.wm-form .d{background:#c8d0da}.wm-form .l{background:#ff6b57}.wm-badge{display:inline-flex;font-size:9px;background:#dff5a6;color:#31590f;border-radius:10px;padding:2px 5px;margin-left:4px}.wm-match{display:grid;grid-template-columns:74px 1fr 72px;gap:6px;align-items:center;border:1px solid var(--line-2,#e8e8e8);border-radius:10px;padding:9px 8px;margin-bottom:6px;background:#fff;cursor:pointer}.wm-match:hover{border-color:#a8e63d}.wm-match.preview{cursor:default}.wm-match.preview:hover{border-color:var(--line-2,#e8e8e8)}.wm-match.own{border-left:4px solid #a8e63d}.wm-match-date{font-size:10px;color:#777;text-align:center}.wm-match-teams{font-size:12px;line-height:1.7}.wm-match-score{text-align:right;font:900 16px var(--font-head,Arial)}.wm-match-score.pending{font-size:11px;color:#999}.wm-phase{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#8c286d}.wm-cup{border-left:4px solid #e5b83b}.wm-cup.silver{border-left-color:#9aa5b1}.wm-empty{text-align:center;padding:18px;color:#888;font-size:12px}.wm-modal-bg{position:fixed;inset:0;background:rgba(18,10,20,.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:14px}.wm-modal{background:#fff;border-radius:14px;width:100%;max-width:390px;padding:18px;max-height:90vh;overflow:auto}.wm-form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wm-label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#777;margin:10px 0 4px}.wm-input{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:9px;font-size:14px}.wm-help{font-size:11px;color:#777;line-height:1.45;margin-top:8px}.wm-rules{border:1px solid var(--line-2,#e5e7eb);border-radius:10px;padding:10px;margin-top:10px;background:#fbfbfb;font-size:11px;color:var(--muted,#6b7280)}.wm-rules summary{font-weight:900;color:var(--ink,#111);cursor:pointer}@media(max-width:600px){.wm-grid{grid-template-columns:1fr}.wm-match{grid-template-columns:58px 1fr 58px}.wm-match-teams{font-size:11px}}
    `;
    document.head.appendChild(style);
  }
  function createPanel() {
    if (document.getElementById('wmTournamentPanel')) return document.getElementById('wmTournamentPanel');
    const host = document.getElementById('standView2');
    if (!host) return null;
    ['tournamentHeader','groupTabsBar','tournamentStandingsWrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const panel = document.createElement('div');
    panel.id = 'wmTournamentPanel';
    panel.innerHTML = `
      <div class="wm-card wm-hero">
        <div class="wm-kicker">Wonder Mom's Cup · Clausura 2026</div>
        <div class="wm-title">Golden Dream y Golden Power</div>
        <div id="wmSummary" class="wm-muted">Configura el torneo para iniciar el registro partido a partido.</div>
        <div class="wm-actions">
          <button class="wm-btn primary" id="wmSetup">Cargar fixture oficial</button>
          <button class="wm-btn" id="wmFinals">Actualizar copas</button>
          <button class="wm-btn" id="wmRefresh">Actualizar</button>
          <label class="wm-muted" style="display:flex;align-items:center;gap:5px">Fecha final <input id="wmFinalDate" class="wm-input" style="width:145px;padding:7px" type="date"></label>
        </div>
      </div>
      <div class="wm-warning"><strong>Importante:</strong> SofaScore confirma 7 jornadas de fase regular, con fecha, hora y cruces cargados en esta vista. La fecha de definiciones todavia no aparece en SofaScore; para cargar fixture o registrar resultados, primero autoriza tu sesion en Tesorera.</div>
      <div class="wm-card">
        <div class="wm-section-title">Clasificacion de fase regular</div>
        <div id="wmStandings" class="wm-grid"><div class="wm-empty">Todavia no hay datos cargados.</div></div>
        <details class="wm-rules"><summary>Reglas y leyenda</summary><div style="margin-top:8px;line-height:1.7">P: jugados - W: ganados - D: empatados - L: perdidos - DIFF: diferencia - GLS: goles a favor/en contra - PTS: puntos.</div><div style="line-height:1.7">Orden: puntos, diferencia de goles, goles a favor, resultado entre involucrados y sorteo. Si el sorteo aun no existe, la app marca <strong>Desempate pendiente</strong>.</div></details>
      </div>
      <div class="wm-card">
        <div class="wm-section-title">Registro de partidos</div>
        <div class="wm-filters">
          <select id="wmPhaseFilter" class="wm-select"><option value="all">Todas las fases</option><option value="regular">Fase regular</option><option value="final">Definiciones</option></select>
          <select id="wmTeamFilter" class="wm-select"><option value="all">Todos los equipos</option><option value="own">Golden Dream y Power</option></select>
          <select id="wmRoundFilter" class="wm-select"><option value="all">Todas las jornadas</option></select>
        </div>
        <div id="wmMatches" style="margin-top:12px"></div>
      </div>`;
    host.insertBefore(panel, host.firstChild);
    document.getElementById('wmSetup').addEventListener('click', setupTournament);
    document.getElementById('wmFinals').addEventListener('click', updateFinalFixtures);
    document.getElementById('wmRefresh').addEventListener('click', loadCurrent);
    ['wmPhaseFilter','wmTeamFilter','wmRoundFilter'].forEach(id => document.getElementById(id).addEventListener('change', () => { currentFilter = document.getElementById('wmPhaseFilter').value; currentTeamFilter = document.getElementById('wmTeamFilter').value; render(); }));
    return panel;
  }
  async function connect() {
    if (typeof ensureSupabaseReady === 'function') await ensureSupabaseReady(7000);
    const factory = (typeof window !== 'undefined' && window.supabase?.createClient)
      ? window.supabase.createClient
      : (typeof createClient === 'function' ? createClient : null);
    const token = tournamentSessionToken();
    if (db && dbSessionToken === (token || '')) return db;
    if (token && factory && typeof SUPA_CONFIG !== 'undefined') {
      db = factory(SUPA_CONFIG.url, SUPA_CONFIG.key, { global: { headers: { 'x-gm-treasury-session': token } } });
      dbSessionToken = token;
      return db;
    }
    if (typeof supa !== 'undefined' && supa) {
      db = supa;
      dbSessionToken = '';
      return db;
    }
    if (!factory || typeof SUPA_CONFIG === 'undefined') throw new Error('No se pudo cargar Supabase');
    db = factory(SUPA_CONFIG.url, SUPA_CONFIG.key);
    dbSessionToken = '';
    return db;
  }
  async function getOrCreateTournament() {
    const { data, error } = await db.from('tournaments').select('*').eq('name', TOURNAMENT_NAME).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const inserted = await db.from('tournaments').insert([{ name: TOURNAMENT_NAME, finished: false }]).select('*').single();
    if (inserted.error) throw inserted.error;
    return inserted.data;
  }
  async function ensureTeams(tournamentId) {
    const current = await db.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('name');
    if (current.error) throw current.error;
    const byName = Object.fromEntries((current.data || []).map(t => [t.name, t]));
    for (const group of ['A', 'B']) {
      for (const name of TEAM_SEED[group]) {
        if (!byName[name]) {
          const inserted = await db.from('tournament_teams').insert([{ tournament_id: tournamentId, name, grupo: group }]).select('*').single();
          if (inserted.error) throw inserted.error;
          byName[name] = inserted.data;
        } else if ((byName[name].grupo || group) !== group) {
          await db.from('tournament_teams').update({ grupo: group }).eq('id', byName[name].id);
          byName[name].grupo = group;
        }
      }
    }
    return Object.values(byName);
  }
  function officialFixtureRows(tournamentId, allTeams) {
    const byName = Object.fromEntries((allTeams || []).map(team => [team.name, team]));
    return OFFICIAL_FIXTURES.map(item => {
      const home = byName[item.home];
      const away = byName[item.away];
      if (!home || !away) throw new Error('Falta equipo para fixture oficial: ' + item.home + ' vs ' + item.away);
      return {
        tournament_id: tournamentId,
        jornada: item.jornada,
        phase: 'regular',
        competition: 'Fase regular Grupo ' + item.group,
        scheduled_date: item.date,
        scheduled_time: item.time,
        date_label: fmtDate(item.date),
        home_team_id: home.id,
        away_team_id: away.id,
        home_team_label: item.home,
        away_team_label: item.away,
        status: 'programado',
        venue: VENUE,
        notes: 'Fixture oficial SofaScore. Fecha de definiciones aun no publicada.'
      };
    });
  }
  function officialPreviewRows() {
    return OFFICIAL_FIXTURES.map((item, index) => ({
      id: 'official-preview-' + index,
      jornada: item.jornada,
      phase: 'regular',
      competition: 'Fase regular Grupo ' + item.group,
      scheduled_date: item.date,
      scheduled_time: item.time,
      date_label: fmtDate(item.date),
      home_team_label: item.home,
      away_team_label: item.away,
      status: 'programado',
      venue: VENUE,
      preview: true
    }));
  }
  async function ensureRegularFixtures(tournamentId, allTeams) {
    const existing = await db.from('tournament_schedule').select('*').eq('tournament_id', tournamentId).eq('phase', 'regular').order('jornada');
    if (existing.error) throw existing.error;
    if (existing.data?.length) return existing.data;
    const rows = officialFixtureRows(tournamentId, allTeams);
    const inserted = await db.from('tournament_schedule').insert(rows).select('*');
    if (inserted.error) throw inserted.error;
    return inserted.data || [];
  }
  async function setupTournament() {
    if (!requireTournamentManager()) return;
    try {
      await connect();
      const tournament = await getOrCreateTournament();
      selectedTournamentId = tournament.id;
      teams = await ensureTeams(tournament.id);
      fixtures = await ensureRegularFixtures(tournament.id, teams);
      await refreshSelect(tournament.id);
      await updateFinalFixtures(false);
      await loadCurrent();
      notify('Fixture oficial cargado: 16 equipos y 56 partidos');
    } catch (error) {
      console.error(error);
      alert('No se pudo cargar el torneo. Revisa primero la migracion tournament_schedule en Supabase.\n\n' + (error.message || error));
    }
  }
  async function refreshSelect(id) {
    const select = document.getElementById('tournamentSelect');
    if (!select) return;
    const data = await db.from('tournaments').select('id,name').order('created_at', { ascending: false });
    if (data.error) return;
    select.innerHTML = '<option value="">Seleccionar torneo</option>' + (data.data || []).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    select.value = id || selectedTournamentId || '';
  }
  async function loadCurrent() {
    try {
      await connect();
      selectedTournamentId = selectedTournamentId || document.getElementById('tournamentSelect')?.value;
      if (!selectedTournamentId) {
        const found = await db.from('tournaments').select('id').eq('name', TOURNAMENT_NAME).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (found.error) throw found.error;
        selectedTournamentId = found.data?.id || null;
      }
      await refreshSelect(selectedTournamentId);
      if (!selectedTournamentId) { render(); return; }
      const t = await db.from('tournament_teams').select('*').eq('tournament_id', selectedTournamentId).order('name');
      const f = await db.from('tournament_schedule').select('*').eq('tournament_id', selectedTournamentId).order('jornada').order('created_at');
      if (t.error) throw t.error;
      if (f.error) throw f.error;
      teams = t.data || [];
      fixtures = f.data || [];
      await updateFinalFixtures(false);
      const latest = await db.from('tournament_schedule').select('*').eq('tournament_id', selectedTournamentId).order('jornada').order('created_at');
      fixtures = latest.data || fixtures;
      render();
    } catch (error) {
      console.error(error);
      const target = document.getElementById('wmSummary');
      if (target) target.textContent = 'No se pudo leer el calendario. Ejecuta la migracion de Supabase.';
    }
  }
  async function updateFinalFixtures(showMessage = true) {
    if (!canManageTournament() || !tournamentSessionToken()) return;
    if (!db || !selectedTournamentId || !teams.length) return;
    const regular = fixtures.filter(m => m.phase === 'regular');
    const standingsA = computeStandings('A', regular);
    const standingsB = computeStandings('B', regular);
    const pairs = [
      { competition: 'Copa Oro', rank: 1 }, { competition: 'Copa Oro', rank: 2 },
      { competition: 'Copa Oro', rank: 3 }, { competition: 'Copa Oro', rank: 4 },
      { competition: 'Copa Plata', rank: 5 }, { competition: 'Copa Plata', rank: 6 },
      { competition: 'Copa Plata', rank: 7 }, { competition: 'Copa Plata', rank: 8 }
    ];
    const current = fixtures.filter(m => m.phase === 'final');
    for (const pair of pairs) {
      const a = standingsA[pair.rank - 1]; const b = standingsB[pair.rank - 1];
      const aReady = a && !a.tiePending;
      const bReady = b && !b.tiePending;
      const existing = current.find(m => Number(m.home_rank) === pair.rank && m.competition === pair.competition);
      const selectedFinalDate = document.getElementById('wmFinalDate')?.value || '';
      const pendingNote = (!aReady || !bReady) ? 'Desempate pendiente: confirmar posicion antes de fijar cruce.' : null;
      const payload = {
        tournament_id: selectedTournamentId, jornada: 8, phase: 'final', competition: pair.competition,
        scheduled_date: selectedFinalDate || existing?.scheduled_date || null,
        scheduled_time: existing?.scheduled_time || null,
        date_label: selectedFinalDate ? fmtDate(selectedFinalDate) : (existing?.date_label || FINAL_DATE_LABEL),
        home_rank: pair.rank, away_rank: pair.rank, home_team_id: aReady ? a.id : null, away_team_id: bReady ? b.id : null,
        home_team_label: aReady ? a.name : `${pair.rank} Grupo A`, away_team_label: bReady ? b.name : `${pair.rank} Grupo B`,
        status: existing?.status || 'programado', home_goals: existing?.home_goals ?? null, away_goals: existing?.away_goals ?? null,
        home_penalties: existing?.home_penalties ?? null, away_penalties: existing?.away_penalties ?? null,
        winner_team_id: existing?.winner_team_id || null, is_wo: existing?.is_wo || false, venue: existing?.venue || VENUE, notes: pendingNote || existing?.notes || null
      };
      if (existing) await db.from('tournament_schedule').update(payload).eq('id', existing.id);
      else await db.from('tournament_schedule').insert([payload]);
    }
    if (showMessage) { await loadCurrent(); notify('Copas actualizadas segun tabla y criterios'); }
  }

  function render() {
    const panel = createPanel();
    if (!panel) return;
    const completed = fixtures.filter(isCompleted).length;
    const regularCount = fixtures.filter(m => m.phase === 'regular').length;
    const finalCount = fixtures.filter(m => m.phase === 'final').length;
    const summary = document.getElementById('wmSummary');
    if (summary) {
      if (!fixtures.length) {
        summary.textContent = `${Object.values(TEAM_SEED).flat().length} equipos previstos - ${OFFICIAL_FIXTURES.length} partidos oficiales listos para cargar - fecha final por confirmar`;
      } else {
        summary.textContent = `${teams.length} equipos - ${regularCount} partidos de fase regular - ${finalCount} definiciones - ${completed} resultados registrados`;
      }
    }
    const finalDate = fixtures.find(m => m.phase === 'final' && m.scheduled_date)?.scheduled_date;
    const finalDateInput = document.getElementById('wmFinalDate');
    if (finalDateInput && finalDate && !finalDateInput.value) finalDateInput.value = finalDate;
    const round = document.getElementById('wmRoundFilter');
    if (round) {
      const selected = round.value || 'all';
      const roundRows = fixtures.length ? fixtures : officialPreviewRows();
      round.innerHTML = '<option value="all">Todas las jornadas</option>' + [...new Set(roundRows.map(m => m.jornada))].sort((a,b) => a-b).map(n => `<option value="${n}">Jornada ${n}</option>`).join('');
      round.value = [...round.options].some(option => option.value === selected) ? selected : 'all';
    }
    renderStandings();
    renderMatches();
  }
  function last5Html(row) {
    if (!row.last?.length) return '<span class="wm-muted">-</span>';
    return `<span class="wm-form">${row.last.map(value => `<span class="${value.toLowerCase()}">${value}</span>`).join('')}</span>`;
  }
  function renderStandings() {
    const target = document.getElementById('wmStandings');
    if (!target) return;
    target.innerHTML = ['A', 'B'].map(group => {
      const rows = teams.length ? computeStandings(group, fixtures) : TEAM_SEED[group].map(name => ({ name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, last: [], tiePending: false }));
      return `<div><div class="wm-section-title">Grupo ${group}</div><div class="wm-table-wrap"><table class="wm-table"><thead><tr><th>#</th><th>Equipo</th><th>P</th><th>W</th><th>D</th><th>L</th><th>DIFF</th><th>GLS</th><th>Last 5</th><th>PTS</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${isOwnTeam(r.name) ? 'own' : ''}"><td class="wm-pos">${i + 1}</td><td class="wm-team">${esc(r.name)}${isOwnTeam(r.name) ? '<span class="wm-badge">GOLDEN</span>' : ''}${r.tiePending ? '<span class="wm-tie">Desempate pendiente</span>' : ''}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.dg > 0 ? '+' : ''}${r.dg}</td><td>${r.gf}:${r.gc}</td><td>${last5Html(r)}</td><td><strong>${r.pts}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
  }
  function renderMatches() {
    const target = document.getElementById('wmMatches');
    if (!target) return;
    const roundValue = document.getElementById('wmRoundFilter')?.value || 'all';
    const sourceRows = fixtures.length ? fixtures : officialPreviewRows();
    let rows = sourceRows.filter(m => currentFilter === 'all' || m.phase === currentFilter).filter(m => roundValue === 'all' || String(m.jornada) === String(roundValue));
    if (currentTeamFilter === 'own') rows = rows.filter(m => isOwnTeam(teamName(m.home_team_id, m.home_team_label)) || isOwnTeam(teamName(m.away_team_id, m.away_team_label)));
    if (!rows.length) { target.innerHTML = '<div class="wm-empty">No hay partidos para este filtro.</div>'; return; }
    const grouped = {};
    rows.forEach(m => { const key = `${m.jornada}|${m.phase}`; (grouped[key] ||= []).push(m); });
    const previewNote = fixtures.length ? '' : '<div class="wm-warning"><strong>Vista previa oficial:</strong> estos partidos vienen del fixture SofaScore pegado por la administradora. Usa Cargar fixture oficial para guardarlos y registrar resultados.</div>';
    target.innerHTML = previewNote + Object.entries(grouped).map(([key, list]) => {
      const [jornada, phase] = key.split('|');
      return `<div class="wm-phase" style="margin:12px 0 7px">Jornada ${jornada} - ${phase === 'regular' ? 'Fase regular' : 'Definiciones'}</div>${list.map(matchCard).join('')}`;
    }).join('');
    target.querySelectorAll('[data-wm-match]').forEach(el => el.addEventListener('click', () => openMatchModal(fixtures.find(m => String(m.id) === String(el.dataset.wmMatch)))));
  }
  function matchCard(match) {
    const home = teamName(match.home_team_id, match.home_team_label);
    const away = teamName(match.away_team_id, match.away_team_label);
    const completed = isCompleted(match);
    const score = match.preview ? 'Programado' : (completed ? `${match.home_goals} - ${match.away_goals}` : 'Pendiente');
    const penalty = completed && match.home_goals === match.away_goals && match.home_penalties != null ? `<div class="wm-muted">Penales ${match.home_penalties} - ${match.away_penalties}</div>` : '';
    const dataAttr = match.preview ? '' : ` data-wm-match="${esc(match.id)}"`;
    return `<div class="wm-match ${match.preview ? 'preview' : ''} ${isOwnTeam(home) || isOwnTeam(away) ? 'own' : ''} ${match.phase === 'final' ? (match.competition === 'Copa Oro' ? 'wm-cup' : 'wm-cup silver') : ''}"${dataAttr}><div class="wm-match-date">${esc(fmtDate(match.scheduled_date, match.date_label, match.scheduled_time))}<br>${match.competition === 'Copa Oro' ? 'ORO' : match.competition === 'Copa Plata' ? 'PLATA' : esc(match.competition || '')}</div><div class="wm-match-teams"><strong>${esc(home)}</strong><br>${esc(away)}</div><div class="wm-match-score ${completed ? '' : 'pending'}">${score}${penalty}</div></div>`;
  }
  function openMatchModal(match) {
    if (!match) return;
    if (!requireTournamentManager()) return;
    document.getElementById('wmMatchModal')?.remove();
    const isFinal = match.phase === 'final';
    const home = teamName(match.home_team_id, match.home_team_label);
    const away = teamName(match.away_team_id, match.away_team_label);
    const modal = document.createElement('div');
    modal.id = 'wmMatchModal'; modal.className = 'wm-modal-bg';
    const editableTeams = !isFinal ? teams.filter(t => (t.grupo || 'A') === teamGroup(match.home_team_id)) : [];
    const teamEditor = !isFinal ? `<div class="wm-form-row"><div><label class="wm-label">Local</label><select id="wmHomeTeam" class="wm-input">${editableTeams.map(t => `<option value="${esc(t.id)}" ${String(t.id) === String(match.home_team_id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div><div><label class="wm-label">Visitante</label><select id="wmAwayTeam" class="wm-input">${editableTeams.map(t => `<option value="${esc(t.id)}" ${String(t.id) === String(match.away_team_id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div></div>` : '';
    modal.innerHTML = `<div class="wm-modal"><div class="wm-kicker">${esc(match.competition || 'Partido')}</div><div class="wm-title" style="font-size:18px">${esc(home)} vs ${esc(away)}</div><div class="wm-help">${esc(VENUE)}. Registra el resultado despues de cada partido.</div><div class="wm-form-row"><div><label class="wm-label">Fecha</label><input id="wmDate" class="wm-input" type="date" value="${esc(match.scheduled_date || '')}"></div><div><label class="wm-label">Hora</label><input id="wmTime" class="wm-input" type="time" value="${esc(fmtTime(match.scheduled_time))}"></div></div>${teamEditor}<div class="wm-form-row"><div><label class="wm-label">${esc(home)}</label><input id="wmHg" class="wm-input" type="number" min="0" value="${match.home_goals ?? ''}"></div><div><label class="wm-label">${esc(away)}</label><input id="wmAg" class="wm-input" type="number" min="0" value="${match.away_goals ?? ''}"></div></div>${isFinal ? `<div class="wm-form-row"><div><label class="wm-label">Penales ${esc(home)}</label><input id="wmHp" class="wm-input" type="number" min="0" value="${match.home_penalties ?? ''}"></div><div><label class="wm-label">Penales ${esc(away)}</label><input id="wmAp" class="wm-input" type="number" min="0" value="${match.away_penalties ?? ''}"></div></div>` : ''}<label class="wm-label"><input id="wmWo" type="checkbox" ${match.is_wo ? 'checked' : ''}> Partido ganado por W.O. 3-0</label><label class="wm-label">Ganador W.O.</label><select id="wmWoWinner" class="wm-input"><option value="home">${esc(home)}</option><option value="away">${esc(away)}</option></select><textarea id="wmNotes" class="wm-input" rows="2" placeholder="Observaciones">${esc(match.notes || '')}</textarea><div class="wm-actions"><button class="wm-btn" id="wmCancel">Cancelar</button><button class="wm-btn primary" id="wmSave">Guardar resultado</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('wmCancel').onclick = () => modal.remove();
    document.getElementById('wmSave').onclick = () => saveMatch(match, modal);
  }

  async function saveMatch(match, modal) {
    if (!requireTournamentManager()) return;
    const hg = document.getElementById('wmHg').value; const ag = document.getElementById('wmAg').value;
    const wo = document.getElementById('wmWo').checked;
    if (hg === '' || ag === '' || Number(hg) < 0 || Number(ag) < 0) { alert('Ingresa ambos goles.'); return; }
    const dateValue = document.getElementById('wmDate').value || null;
    const timeValue = document.getElementById('wmTime').value || null;
    const payload = { scheduled_date: dateValue, scheduled_time: timeValue, date_label: dateValue ? fmtDate(dateValue) : (match.date_label || null), home_goals: Number(hg), away_goals: Number(ag), status: wo ? 'wo' : 'finalizado', is_wo: wo, notes: document.getElementById('wmNotes').value.trim() || null, winner_team_id: null, venue: VENUE };
    if (match.phase === 'regular') {
      const newHome = document.getElementById('wmHomeTeam')?.value;
      const newAway = document.getElementById('wmAwayTeam')?.value;
      if (newHome && newAway && newHome === newAway) { alert('El local y visitante deben ser equipos distintos.'); return; }
      if (newHome && newAway) {
        payload.home_team_id = newHome;
        payload.away_team_id = newAway;
        payload.home_team_label = teamName(newHome);
        payload.away_team_label = teamName(newAway);
      }
    }
    const homeId = payload.home_team_id || match.home_team_id;
    const awayId = payload.away_team_id || match.away_team_id;
    if (wo) {
      const winner = document.getElementById('wmWoWinner').value;
      payload.home_goals = winner === 'home' ? 3 : 0;
      payload.away_goals = winner === 'away' ? 3 : 0;
      payload.winner_team_id = winner === 'home' ? homeId : awayId;
    }
    if (!wo && match.phase === 'final' && payload.home_goals === payload.away_goals) {
      const hp = document.getElementById('wmHp').value; const ap = document.getElementById('wmAp').value;
      if (hp === '' || ap === '' || Number(hp) === Number(ap)) { alert('En una definicion empatada debes registrar penales distintos.'); return; }
      payload.home_penalties = Number(hp); payload.away_penalties = Number(ap);
      payload.winner_team_id = Number(hp) > Number(ap) ? homeId : awayId;
    } else {
      payload.home_penalties = null; payload.away_penalties = null;
      payload.winner_team_id = Number(payload.home_goals) === Number(payload.away_goals) ? null : Number(payload.home_goals) > Number(payload.away_goals) ? homeId : awayId;
    }
    const result = await db.from('tournament_schedule').update(payload).eq('id', match.id);
    if (result.error) { alert('No se pudo guardar: ' + result.error.message); return; }
    modal.remove(); await loadCurrent(); notify('Resultado guardado');
  }
  function notify(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else alert(message);
  }
  function boot() {
    injectStyles(); createPanel();
    const select = document.getElementById('tournamentSelect');
    select?.addEventListener('change', () => { selectedTournamentId = select.value || null; loadCurrent(); });
    loadCurrent();
  }
  window.WonderMomsTournament = { setup: setupTournament, refresh: loadCurrent };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400));
  else setTimeout(boot, 400);
})();
