'use strict';

(function(){
  const SESSION_KEY = 'gm_fitness_session';
  const SESSION_HEADER = 'x-gm-fitness-session';
  const SANTIAGO_TZ = 'America/Santiago';

  const state = {
    loaded: false,
    loading: false,
    error: '',
    month: null,
    days: [],
    videos: [],
    progress: [],
    ranking: [],
    selectedDate: '',
    selectedVideoId: '',
    adminOpen: false,
    adminMonths: [],
    adminDays: [],
    adminVideos: [],
    adminMonthId: '',
    adminDayId: '',
    adminVideoId: '',
    rpcClient: null
  };

  function current(){
    try { return currentUser || null; } catch(e){ return null; }
  }

  function h(value){
    if(typeof escapeHTML === 'function') return escapeHTML(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function toast(message){
    if(typeof showToast === 'function') showToast(message);
  }

  function isMissing(error){
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '');
    return code === '42P01' || code === 'PGRST202' || msg.includes('schema cache') || msg.includes('fitness_');
  }

  function isAdmin(){
    return String(current()?.role || '').toLowerCase() === 'admin';
  }

  function pad(number){
    return String(number).padStart(2, '0');
  }

  function ymd(year, month, day){
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function parseYMD(value){
    const [year, month, day] = String(value || '').split('-').map(Number);
    if(!year || !month || !day) return null;
    return { year, month, day };
  }

  function santiagoTodayYMD(){
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SANTIAGO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date()).reduce((acc, part) => {
      if(part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function monthLabel(month){
    if(!month) return '';
    const date = new Date(Number(month.year), Number(month.month) - 1, 1);
    const label = date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function dateLabel(value){
    const parsed = parseYMD(value);
    if(!parsed) return '';
    return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  function storedSession(){
    try{
      const raw = sessionStorage.getItem(SESSION_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      const expiresAt = Date.parse(parsed.expires_at || '');
      if(!parsed.session_token || !expiresAt || expiresAt <= Date.now()){
        sessionStorage.removeItem(SESSION_KEY);
        state.rpcClient = null;
        return null;
      }
      return parsed;
    } catch(e){
      return null;
    }
  }

  function saveFitnessSession(data){
    if(!data?.session_token || !data?.expires_at) return false;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        session_token: data.session_token,
        expires_at: data.expires_at
      }));
      state.rpcClient = null;
      return true;
    } catch(e){
      return false;
    }
  }

  function clearFitnessSession(){
    try { sessionStorage.removeItem(SESSION_KEY); } catch(e){}
    state.rpcClient = null;
  }

  function fitnessClient(){
    const session = storedSession();
    if(!session) return supa;
    if(state.rpcClient) return state.rpcClient;
    const factory = window.supabase?.createClient || (typeof createClient === 'function' ? createClient : null);
    if(!factory || typeof SUPA_CONFIG === 'undefined') return supa;
    state.rpcClient = factory(SUPA_CONFIG.url, SUPA_CONFIG.key, {
      global: { headers: { [SESSION_HEADER]: session.session_token } }
    });
    return state.rpcClient;
  }

  async function rememberLogin(username, password){
    if(!supa || !IS_CONNECTED || !username || !password) return false;
    try{
      const { data, error } = await supa.rpc('fitness_create_session', {
        p_username: username,
        p_password: password
      });
      if(error) throw error;
      return saveFitnessSession(data || {});
    } catch(error){
      if(!isMissing(error)) console.warn('fitness_create_session', error);
      return false;
    }
  }

  function videosForDay(dayId){
    return state.videos
      .filter(video => String(video.fitness_day_id) === String(dayId))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  function progressSet(){
    return new Set((state.progress || [])
      .filter(row => row.completed)
      .map(row => String(row.fitness_video_id)));
  }

  function requiredVideos(videos){
    return videos.filter(video => (video.activity_type || 'required') === 'required');
  }

  function progressStats(){
    const done = progressSet();
    const required = state.videos.filter(video => (video.activity_type || 'required') === 'required');
    const completed = required.filter(video => done.has(String(video.id)));
    const percent = required.length ? Math.round((completed.length / required.length) * 100) : 0;
    return { required: required.length, completed: completed.length, percent };
  }

  function dayStatus(day){
    if(!day) return 'pending';
    if(day.day_type === 'rest') return 'rest';
    if(day.day_type === 'challenge') return 'challenge';
    if(day.day_type === 'informational') return 'info';
    const done = progressSet();
    const required = requiredVideos(videosForDay(day.id));
    if(!required.length) return 'pending';
    const completed = required.filter(video => done.has(String(video.id))).length;
    if(completed === required.length) return 'completed';
    if(completed > 0) return 'partial';
    return 'pending';
  }

  function selectedDay(){
    return state.days.find(day => day.workout_date === state.selectedDate) || null;
  }

  function selectedVideo(){
    return state.videos.find(video => String(video.id) === String(state.selectedVideoId)) || null;
  }

  function getYouTubeVideoData(url){
    const originalUrl = String(url || '').trim();
    const invalid = error => ({ videoId: '', originalUrl, embedUrl: '', isValid: false, error });
    if(!originalUrl) return invalid('URL vacia');
    let parsed;
    try {
      parsed = new URL(originalUrl);
    } catch(e){
      return invalid('URL invalida');
    }
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    let videoId = '';
    if(host === 'youtu.be'){
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if(host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com'){
      if(parsed.pathname.startsWith('/watch')) videoId = parsed.searchParams.get('v') || '';
      else if(parsed.pathname.startsWith('/embed/')) videoId = parsed.pathname.split('/')[2] || '';
      else if(parsed.pathname.startsWith('/shorts/')) videoId = parsed.pathname.split('/')[2] || '';
    } else {
      return invalid('La URL no corresponde a YouTube');
    }
    if(!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return invalid('No se pudo identificar el video');
    return {
      videoId,
      originalUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      isValid: true,
      error: ''
    };
  }

  async function loadFitnessData(force){
    if(state.loaded && !force) return;
    state.loading = true;
    state.error = '';
    try{
      if(!supa || !IS_CONNECTED) throw new Error('Sin conexion');
      const db = fitnessClient();
      let query = db.from('fitness_months').select('*').eq('is_active', true).order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
      if(!isAdmin()) query = query.eq('status', 'published');
      let { data: months, error: monthError } = await query;
      if(monthError) throw monthError;
      if(!months?.length && isAdmin()){
        const fallback = await db.from('fitness_months').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
        if(fallback.error) throw fallback.error;
        months = fallback.data || [];
      }
      state.month = months?.[0] || null;
      state.days = [];
      state.videos = [];
      state.progress = [];
      state.ranking = [];
      if(!state.month){
        state.loaded = true;
        return;
      }
      const [{ data: days, error: daysError }, rankingResult] = await Promise.all([
        db.from('fitness_days').select('*').eq('fitness_month_id', state.month.id).order('workout_date', { ascending: true }),
        db.rpc('fitness_month_ranking', { p_fitness_month_id: state.month.id })
      ]);
      if(daysError) throw daysError;
      if(rankingResult.error && !isMissing(rankingResult.error)) console.warn('fitness ranking', rankingResult.error);
      state.days = days || [];
      state.ranking = rankingResult.data || [];

      const dayIds = state.days.map(day => day.id);
      if(dayIds.length){
        const { data: videos, error: videosError } = await db.from('fitness_videos')
          .select('*')
          .in('fitness_day_id', dayIds)
          .order('sort_order', { ascending: true });
        if(videosError) throw videosError;
        state.videos = videos || [];
      }
      const videoIds = state.videos.map(video => video.id);
      if(videoIds.length && current()?.player_id && storedSession()){
        const { data: progress, error: progressError } = await db.from('fitness_progress')
          .select('*')
          .eq('player_id', current().player_id)
          .in('fitness_video_id', videoIds);
        if(progressError && !isMissing(progressError)) throw progressError;
        state.progress = progress || [];
      }
      if(!state.selectedDate){
        const today = santiagoTodayYMD();
        const todayInMonth = state.days.find(day => day.workout_date === today);
        state.selectedDate = todayInMonth?.workout_date || state.days[0]?.workout_date || '';
      }
      state.loaded = true;
    } catch(error){
      console.warn('loadFitnessData', error);
      state.error = isMissing(error)
        ? 'Falta ejecutar la migracion SQL de Desafio fisico en Supabase.'
        : 'No se pudo cargar Desafio fisico.';
    } finally {
      state.loading = false;
    }
  }

  function render(){
    const root = document.getElementById('fitnessRoot');
    if(!root) return;
    root.innerHTML = '<div class="empty-state">Cargando Desafio fisico...</div>';
    loadFitnessData(false).then(() => {
      root.innerHTML = layout();
      bindRoot(root);
    });
  }

  function layout(){
    if(state.loading) return '<div class="empty-state">Cargando Desafio fisico...</div>';
    if(state.error) return errorView();
    if(!state.month) return noMonthView();
    return [
      headerView(),
      selectedRoutineView(),
      calendarView(),
      videosView(),
      rankingView(),
      adminView()
    ].join('');
  }

  function errorView(){
    return `<div class="card fitness-state">
      <div class="dash-card-title"><span class="dash-card-icon">💪</span>Desafio fisico</div>
      <div class="section-sub">${h(state.error)}</div>
      ${isAdmin() ? '<button class="btn p" type="button" data-fitness-action="reload">Reintentar</button>' : ''}
    </div>`;
  }

  function noMonthView(){
    return `<div class="card fitness-state">
      <div class="dash-card-title"><span class="dash-card-icon">💪</span>Desafio fisico</div>
      <div class="section-sub">No hay un mes publicado todavia.</div>
      ${isAdmin() ? '<button class="btn p" type="button" data-fitness-action="toggle-admin">Abrir administracion</button>' : ''}
    </div>${adminView()}`;
  }

  function headerView(){
    const stats = progressStats();
    return `<div class="fitness-head">
      <div>
        <div class="section-title">Desafio fisico</div>
        <div class="section-sub">${h(monthLabel(state.month))} · Rutinas complementarias para las Golden Moms</div>
      </div>
      <div class="fitness-progress-card">
        <div class="fitness-progress-value">${stats.percent}% completado</div>
        <div class="fitness-progress-sub">${stats.completed} de ${stats.required} videos realizados</div>
        <div class="fee-progress-bg"><div class="fee-progress-fill" style="width:${stats.percent}%"></div></div>
      </div>
    </div>`;
  }

  function selectedRoutineView(){
    const day = selectedDay();
    if(!day) return '<div class="card fitness-state">Sin rutina para el dia seleccionado.</div>';
    const dayVideos = videosForDay(day.id);
    const done = progressSet();
    const completed = requiredVideos(dayVideos).filter(video => done.has(String(video.id))).length;
    const requiredCount = requiredVideos(dayVideos).length;
    let note = `${completed} de ${requiredCount} videos obligatorios completados.`;
    if(day.day_type === 'rest') note = 'Dia de descanso. No suma puntos.';
    if(day.day_type === 'challenge') note = 'Dia de reto o contenido informativo. No suma puntos por defecto.';
    if(day.day_type === 'informational') note = 'Contenido informativo. No suma puntos.';
    const canStart = day.day_type === 'workout' && dayVideos.length;
    return `<div class="card fitness-routine-card">
      <div>
        <div class="fitness-date">${h(dateLabel(day.workout_date))}</div>
        <div class="fitness-category">${h(day.category || day.title || 'Rutina')}</div>
        <div class="section-sub">${h(note)}</div>
      </div>
      ${canStart ? `<button class="btn p" type="button" data-fitness-action="start-routine">${completed ? 'Continuar rutina' : 'Comenzar rutina'}</button>` : ''}
    </div>`;
  }

  function calendarView(){
    const month = state.month;
    const firstDate = new Date(Number(month.year), Number(month.month) - 1, 1);
    const daysInMonth = new Date(Number(month.year), Number(month.month), 0).getDate();
    const blanks = (firstDate.getDay() + 6) % 7;
    const dayMap = new Map(state.days.map(day => [day.workout_date, day]));
    const today = santiagoTodayYMD();
    const cells = [];
    for(let index = 0; index < blanks; index++) cells.push('<div class="fitness-day blank"></div>');
    for(let dayNum = 1; dayNum <= daysInMonth; dayNum++){
      const date = ymd(month.year, month.month, dayNum);
      const day = dayMap.get(date);
      const status = dayStatus(day);
      const active = date === state.selectedDate ? ' selected' : '';
      const todayClass = date === today ? ' today' : '';
      const category = day?.category ? String(day.category).slice(0, 9) : '';
      cells.push(`<button class="fitness-day ${status}${active}${todayClass}" type="button" data-fitness-date="${date}">
        <span class="fitness-day-num">${dayNum}</span>
        <span class="fitness-day-cat">${h(category)}</span>
      </button>`);
    }
    return `<div class="card fitness-calendar-card">
      <div class="month-bar">
        <div class="month-title">${h(monthLabel(month))}</div>
        <button class="btn" type="button" data-fitness-action="today">Ir a hoy</button>
      </div>
      <div class="fitness-weekdays"><span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span><span>Dom</span></div>
      <div class="fitness-calendar">${cells.join('')}</div>
      <div class="fitness-legend">
        <span>Pendiente</span><span>Parcial</span><span>Completado</span><span>Reto</span>
      </div>
    </div>`;
  }

  function videosView(){
    const day = selectedDay();
    if(!day) return '';
    if(day.day_type === 'rest') return '<div class="card fitness-state">Dia de descanso. Aprovecha de recuperar.</div>';
    if(day.day_type === 'challenge') return '<div class="card fitness-state">Dia de reto o contenido informativo. No hay video obligatorio para puntaje.</div>';
    const dayVideos = videosForDay(day.id);
    if(!dayVideos.length) return '<div class="card fitness-state">Sin videos cargados para este dia.</div>';
    const done = progressSet();
    return `<div class="fitness-grid">
      <div class="card">
        <div class="dash-card-title"><span class="dash-card-icon">▶</span>Videos del dia</div>
        <div class="fitness-video-list">
          ${dayVideos.map(video => videoCard(video, done.has(String(video.id)))).join('')}
        </div>
      </div>
      ${playerView()}
    </div>`;
  }

  function videoCard(video, completed){
    const material = video.equipment || 'Sin material indicado';
    const duration = video.duration_minutes ? `${video.duration_minutes} min` : '';
    return `<div class="fitness-video-card ${completed ? 'done' : ''}">
      <div class="fitness-video-order">${Number(video.sort_order || 0)}</div>
      <div class="fitness-video-main">
        <div class="fitness-video-title">${h(video.title || 'Video')}</div>
        <div class="fitness-video-meta">${h(material)}${duration ? ' · ' + h(duration) : ''}</div>
        <div class="fitness-video-state">${completed ? 'Completado' : 'Pendiente'}</div>
      </div>
      <div class="fitness-video-actions">
        <button class="btn" type="button" data-fitness-video="${h(video.id)}">Ver video</button>
        <button class="btn ${completed ? '' : 'p'}" type="button" data-fitness-toggle="${h(video.id)}">${completed ? 'Desmarcar' : 'Completar'}</button>
      </div>
    </div>`;
  }

  function playerView(){
    const video = selectedVideo();
    if(!video) return '<div class="card fitness-player-card"><div class="empty-state">Selecciona un video para verlo.</div></div>';
    const yt = getYouTubeVideoData(video.original_url || video.youtube_url || '');
    const original = yt.isValid ? yt.originalUrl : (video.source_page_url || video.original_url || '');
    return `<div class="card fitness-player-card">
      <div class="fitness-player-head">
        <div>
          <div class="dash-card-title"><span class="dash-card-icon">▶</span>${h(video.title || 'Video')}</div>
          <div class="section-sub">${h(video.equipment || 'Sin material indicado')}</div>
        </div>
        <button class="btn btn-icon" type="button" title="Cerrar reproductor" data-fitness-action="close-video">×</button>
      </div>
      ${yt.isValid ? `<div class="fitness-iframe-wrap"><iframe src="${h(yt.embedUrl)}" title="${h(video.title || 'Video')}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<div class="fitness-embed-warning">Este video debe abrirse directamente en YouTube.</div>`}
      <div class="fitness-player-actions">
        ${original ? `<a class="btn" href="${h(original)}" target="_blank" rel="noopener noreferrer">Abrir original</a>` : ''}
      </div>
    </div>`;
  }

  function rankingView(){
    if(state.month && state.month.ranking_enabled === false) return '<div class="card fitness-state">Ranking desactivado para este mes.</div>';
    if(!state.ranking.length) return '<div class="card fitness-state">Ranking mensual sin datos todavia.</div>';
    return `<div class="card fitness-ranking">
      <div class="dash-card-title"><span class="dash-card-icon">🏅</span>Ranking mensual</div>
      <div class="fitness-ranking-list">
        ${state.ranking.map(row => {
          const name = row.player_alias || row.player_name || 'Jugadora';
          const initial = name.charAt(0).toUpperCase();
          return `<div class="fitness-rank-row">
            <div class="fitness-rank-pos">#${h(row.position)}</div>
            <div class="birth-avatar ${row.player_photo ? 'birth-avatar-photo' : ''}" ${row.player_photo ? `style="background-image:url('${h(row.player_photo)}');background-size:cover"` : ''}>${row.player_photo ? '' : h(initial)}</div>
            <div class="fitness-rank-name">
              <strong>${h(name)}</strong>
              <span>${Number(row.completed_required_videos || 0)} videos · ${Number(row.completed_routines || 0)} rutinas</span>
            </div>
            <div class="fitness-rank-score">${Number(row.points || 0)} pts<br><span>${Number(row.compliance_percent || 0)}%</span></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function adminView(){
    if(!isAdmin()) return '';
    if(!state.adminOpen){
      return `<div class="card fitness-admin-card">
        <div class="fitness-admin-head">
          <div>
            <div class="dash-card-title"><span class="dash-card-icon">⚙</span>Administracion mensual</div>
            <div class="section-sub">Crear y editar meses, dias y videos sin tocar codigo.</div>
          </div>
          <button class="btn p" type="button" data-fitness-action="toggle-admin">Abrir administracion</button>
        </div>
      </div>`;
    }
    return `<div class="card fitness-admin-card">
      <div class="fitness-admin-head">
        <div>
          <div class="dash-card-title"><span class="dash-card-icon">⚙</span>Administracion mensual</div>
          <div class="section-sub">${storedSession() ? 'Sesion administrativa lista.' : 'Reingresa para habilitar escritura segura.'}</div>
        </div>
        <button class="btn" type="button" data-fitness-action="toggle-admin">Cerrar</button>
      </div>
      <div id="fitnessAdminBody">${adminBody()}</div>
    </div>`;
  }

  function adminBody(){
    if(!storedSession()){
      return '<div class="fitness-embed-warning">Para editar Desafio fisico, cierra sesion e ingresa nuevamente. La migracion creara una sesion segura para validar tu rol.</div>';
    }
    return [
      adminMonthEditor(),
      adminDayEditor(),
      adminVideoEditor()
    ].join('');
  }

  function adminMonthEditor(){
    const months = state.adminMonths.length ? state.adminMonths : (state.month ? [state.month] : []);
    const selected = months.find(month => String(month.id) === String(state.adminMonthId)) || state.month || {};
    return `<div class="fitness-admin-section">
      <div class="treasury-section-title">Mes</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mes existente</label>
          <select class="input" id="fitAdminMonthSelect" data-fitness-admin-month-select>
            <option value="">Nuevo mes</option>
            ${months.map(month => `<option value="${h(month.id)}" ${String(month.id) === String(selected.id) ? 'selected' : ''}>${h(month.name || monthLabel(month))} · ${h(month.status)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="input" id="fitMonthName" value="${h(selected.name || '')}" placeholder="Julio 2026">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Año</label><input class="input" id="fitMonthYear" type="number" value="${h(selected.year || new Date().getFullYear())}"></div>
        <div class="form-group"><label class="form-label">Mes</label><input class="input" id="fitMonthNumber" type="number" min="1" max="12" value="${h(selected.month || (new Date().getMonth() + 1))}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PDF referencia</label><input class="input" id="fitMonthPdf" value="${h(selected.source_pdf_url || '')}"></div>
        <div class="form-group"><label class="form-label">Estado</label><select class="input" id="fitMonthStatus"><option value="draft" ${selected.status === 'draft' ? 'selected' : ''}>Borrador</option><option value="published" ${selected.status === 'published' ? 'selected' : ''}>Publicado</option><option value="archived" ${selected.status === 'archived' ? 'selected' : ''}>Archivado</option></select></div>
      </div>
      <label class="equipo-check-label chip-all"><input type="checkbox" id="fitMonthActive" ${selected.is_active ? 'checked' : ''}> Mes activo</label>
      <label class="equipo-check-label chip-all"><input type="checkbox" id="fitRankingEnabled" ${selected.ranking_enabled !== false ? 'checked' : ''}> Ranking habilitado</label>
      <div class="fitness-admin-actions">
        <button class="btn p" type="button" data-fitness-action="save-month">Guardar mes</button>
        <button class="btn" type="button" data-fitness-action="load-admin">Actualizar datos</button>
        <button class="btn" type="button" data-fitness-action="duplicate-month">Duplicar como borrador</button>
        <button class="btn" type="button" data-fitness-action="preview-month">Vista previa</button>
      </div>
    </div>`;
  }

  function adminDayEditor(){
    const monthId = state.adminMonthId || state.month?.id || '';
    const days = state.adminDays.length ? state.adminDays : state.days;
    const selected = days.find(day => String(day.id) === String(state.adminDayId)) || {};
    return `<div class="fitness-admin-section">
      <div class="treasury-section-title">Dias</div>
      <div class="fitness-admin-list">
        ${days.map(day => `<button class="team-chip chip-all ${String(day.id) === String(selected.id) ? 'active' : ''}" type="button" data-fitness-admin-day="${h(day.id)}">${h(day.workout_date?.slice(8, 10))} ${h(day.category || '')}</button>`).join('')}
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Fecha</label><input class="input" id="fitDayDate" type="date" value="${h(selected.workout_date || '')}"></div>
        <div class="form-group"><label class="form-label">Categoria</label><input class="input" id="fitDayCategory" value="${h(selected.category || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tipo de dia</label><select class="input" id="fitDayType"><option value="workout" ${selected.day_type === 'workout' ? 'selected' : ''}>Rutina</option><option value="rest" ${selected.day_type === 'rest' ? 'selected' : ''}>Descanso</option><option value="challenge" ${selected.day_type === 'challenge' ? 'selected' : ''}>Reto</option><option value="informational" ${selected.day_type === 'informational' ? 'selected' : ''}>Informativo</option></select></div>
        <div class="form-group"><label class="form-label">Titulo</label><input class="input" id="fitDayTitle" value="${h(selected.title || '')}"></div>
      </div>
      <input type="hidden" id="fitDayMonthId" value="${h(monthId)}">
      <div class="fitness-admin-actions">
        <button class="btn p" type="button" data-fitness-action="save-day">Guardar dia</button>
        <button class="btn danger" type="button" data-fitness-action="delete-day">Eliminar dia</button>
      </div>
    </div>`;
  }

  function adminVideoEditor(){
    const dayId = state.adminDayId || selectedDay()?.id || '';
    const videos = (state.adminVideos.length ? state.adminVideos : state.videos).filter(video => String(video.fitness_day_id) === String(dayId));
    const selected = videos.find(video => String(video.id) === String(state.adminVideoId)) || {};
    return `<div class="fitness-admin-section">
      <div class="treasury-section-title">Videos</div>
      <div class="fitness-admin-list">
        ${videos.map(video => `<button class="team-chip chip-all" type="button" data-fitness-admin-video="${h(video.id)}">${Number(video.sort_order || 0)}. ${h(video.title || 'Video')}</button>`).join('')}
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Titulo</label><input class="input" id="fitVideoTitle" value="${h(selected.title || '')}"></div>
        <div class="form-group"><label class="form-label">Orden</label><input class="input" id="fitVideoOrder" type="number" value="${h(selected.sort_order || (videos.length + 1))}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">URL YouTube</label><input class="input" id="fitVideoUrl" value="${h(selected.original_url || '')}"></div>
        <div class="form-group"><label class="form-label">Material</label><input class="input" id="fitVideoEquipment" value="${h(selected.equipment || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">URL fuente</label><input class="input" id="fitVideoSource" value="${h(selected.source_page_url || '')}"></div>
        <div class="form-group"><label class="form-label">Tipo</label><select class="input" id="fitVideoActivity"><option value="required" ${selected.activity_type === 'required' ? 'selected' : ''}>Obligatorio</option><option value="optional" ${selected.activity_type === 'optional' ? 'selected' : ''}>Opcional</option><option value="informational" ${selected.activity_type === 'informational' ? 'selected' : ''}>Informativo</option></select></div>
      </div>
      <input type="hidden" id="fitVideoDayId" value="${h(dayId)}">
      <div class="fitness-admin-actions">
        <button class="btn p" type="button" data-fitness-action="save-video">Guardar video</button>
        <button class="btn danger" type="button" data-fitness-action="delete-video">Eliminar video</button>
        <button class="btn" type="button" data-fitness-action="new-video">Nuevo video</button>
      </div>
    </div>`;
  }

  function bindRoot(root){
    if(root.__fitnessBound) return;
    root.__fitnessBound = true;
    root.addEventListener('click', handleClick);
    root.addEventListener('change', handleChange);
  }

  function rerender(){
    const root = document.getElementById('fitnessRoot');
    if(root){
      root.innerHTML = layout();
      bindRoot(root);
    }
  }

  async function handleClick(event){
    const dateBtn = event.target.closest('[data-fitness-date]');
    if(dateBtn){
      state.selectedDate = dateBtn.dataset.fitnessDate;
      state.selectedVideoId = '';
      rerender();
      return;
    }
    const videoBtn = event.target.closest('[data-fitness-video]');
    if(videoBtn){
      state.selectedVideoId = videoBtn.dataset.fitnessVideo;
      rerender();
      return;
    }
    const toggleBtn = event.target.closest('[data-fitness-toggle]');
    if(toggleBtn){
      await toggleProgress(toggleBtn.dataset.fitnessToggle);
      return;
    }
    const adminDay = event.target.closest('[data-fitness-admin-day]');
    if(adminDay){
      state.adminDayId = adminDay.dataset.fitnessAdminDay;
      state.adminVideoId = '';
      rerender();
      return;
    }
    const adminVideo = event.target.closest('[data-fitness-admin-video]');
    if(adminVideo){
      state.adminVideoId = adminVideo.dataset.fitnessAdminVideo;
      rerender();
      return;
    }
    const action = event.target.closest('[data-fitness-action]')?.dataset.fitnessAction;
    if(!action) return;
    await handleAction(action);
  }

  function handleChange(event){
    if(event.target.matches('[data-fitness-admin-month-select]')){
      state.adminMonthId = event.target.value;
      const selected = state.adminMonths.find(month => String(month.id) === String(state.adminMonthId));
      state.adminDays = [];
      state.adminVideos = [];
      state.adminDayId = '';
      state.adminVideoId = '';
      if(selected) loadAdminDetails(selected.id).then(rerender);
      else rerender();
    }
  }

  async function handleAction(action){
    if(action === 'reload'){
      state.loaded = false;
      await loadFitnessData(true);
      rerender();
    }
    if(action === 'today'){
      const today = santiagoTodayYMD();
      if(state.days.some(day => day.workout_date === today)) state.selectedDate = today;
      rerender();
    }
    if(action === 'start-routine'){
      const first = videosForDay(selectedDay()?.id).find(Boolean);
      if(first) state.selectedVideoId = first.id;
      rerender();
    }
    if(action === 'close-video'){
      state.selectedVideoId = '';
      rerender();
    }
    if(action === 'toggle-admin'){
      state.adminOpen = !state.adminOpen;
      if(state.adminOpen) await loadAdmin();
      rerender();
    }
    if(action === 'load-admin'){
      await loadAdmin();
      rerender();
    }
    if(action === 'save-month') await saveMonth();
    if(action === 'save-day') await saveDay();
    if(action === 'delete-day') await deleteDay();
    if(action === 'save-video') await saveVideo();
    if(action === 'delete-video') await deleteVideo();
    if(action === 'new-video'){
      state.adminVideoId = '';
      rerender();
    }
    if(action === 'preview-month'){
      state.loaded = false;
      await loadFitnessData(true);
      state.adminOpen = false;
      rerender();
    }
    if(action === 'duplicate-month') await duplicateMonth();
  }

  async function toggleProgress(videoId){
    const user = current();
    if(!user?.player_id){
      toast('No se pudo asociar tu cuenta con una jugadora del Plantel.');
      return;
    }
    if(!storedSession()){
      toast('Vuelve a ingresar para guardar progreso de forma segura.');
      return;
    }
    const video = state.videos.find(item => String(item.id) === String(videoId));
    if(!video || (video.activity_type || 'required') === 'informational'){
      toast('Este contenido no suma progreso.');
      return;
    }
    const done = progressSet().has(String(videoId));
    const next = !done;
    try{
      const { error } = await fitnessClient().from('fitness_progress').upsert({
        player_id: user.player_id,
        fitness_video_id: videoId,
        completed: next,
        completed_at: next ? new Date().toISOString() : null
      }, { onConflict: 'player_id,fitness_video_id' });
      if(error) throw error;
      state.loaded = false;
      await loadFitnessData(true);
      toast(next ? 'Progreso guardado' : 'Progreso desmarcado');
      rerender();
    } catch(error){
      console.warn('toggleProgress', error);
      toast('No se pudo guardar el progreso.');
    }
  }

  async function loadAdmin(){
    if(!isAdmin() || !storedSession()) return;
    const db = fitnessClient();
    const { data, error } = await db.from('fitness_months').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    if(error){
      console.warn('loadAdmin months', error);
      return;
    }
    state.adminMonths = data || [];
    state.adminMonthId = state.adminMonthId || state.month?.id || state.adminMonths[0]?.id || '';
    if(state.adminMonthId) await loadAdminDetails(state.adminMonthId);
  }

  async function loadAdminDetails(monthId){
    const db = fitnessClient();
    const { data: days, error: daysError } = await db.from('fitness_days').select('*').eq('fitness_month_id', monthId).order('workout_date');
    if(daysError){
      console.warn('loadAdmin days', daysError);
      return;
    }
    state.adminDays = days || [];
    state.adminDayId = state.adminDayId || state.adminDays[0]?.id || '';
    const ids = state.adminDays.map(day => day.id);
    state.adminVideos = [];
    if(ids.length){
      const { data: videos, error: videosError } = await db.from('fitness_videos').select('*').in('fitness_day_id', ids).order('sort_order');
      if(videosError) console.warn('loadAdmin videos', videosError);
      state.adminVideos = videos || [];
    }
  }

  async function saveMonth(){
    const year = Number(document.getElementById('fitMonthYear')?.value);
    const month = Number(document.getElementById('fitMonthNumber')?.value);
    const name = document.getElementById('fitMonthName')?.value.trim();
    if(!year || !month || month < 1 || month > 12 || !name){
      toast('Completa año, mes y nombre.');
      return;
    }
    const payload = {
      year,
      month,
      name,
      source_pdf_url: document.getElementById('fitMonthPdf')?.value.trim() || null,
      status: document.getElementById('fitMonthStatus')?.value || 'draft',
      is_active: !!document.getElementById('fitMonthActive')?.checked,
      ranking_enabled: !!document.getElementById('fitRankingEnabled')?.checked
    };
    const db = fitnessClient();
    const id = state.adminMonthId || '';
    const result = id
      ? await db.from('fitness_months').update(payload).eq('id', id).select('*').maybeSingle()
      : await db.from('fitness_months').insert([payload]).select('*').maybeSingle();
    if(result.error){
      console.warn('saveMonth', result.error);
      toast('No se pudo guardar el mes.');
      return;
    }
    state.adminMonthId = result.data?.id || state.adminMonthId;
    state.loaded = false;
    await loadAdmin();
    await loadFitnessData(true);
    toast('Mes guardado');
    rerender();
  }

  async function saveDay(){
    const monthId = document.getElementById('fitDayMonthId')?.value || state.adminMonthId;
    const date = document.getElementById('fitDayDate')?.value;
    if(!monthId || !date){
      toast('Selecciona mes y fecha.');
      return;
    }
    const payload = {
      fitness_month_id: monthId,
      workout_date: date,
      category: document.getElementById('fitDayCategory')?.value.trim() || null,
      title: document.getElementById('fitDayTitle')?.value.trim() || null,
      day_type: document.getElementById('fitDayType')?.value || 'workout',
      sort_order: Number(date.slice(8, 10))
    };
    const db = fitnessClient();
    const result = state.adminDayId
      ? await db.from('fitness_days').update(payload).eq('id', state.adminDayId).select('*').maybeSingle()
      : await db.from('fitness_days').insert([payload]).select('*').maybeSingle();
    if(result.error){
      console.warn('saveDay', result.error);
      toast('No se pudo guardar el dia.');
      return;
    }
    state.adminDayId = result.data?.id || state.adminDayId;
    state.loaded = false;
    await loadAdminDetails(monthId);
    await loadFitnessData(true);
    toast('Dia guardado');
    rerender();
  }

  async function deleteDay(){
    if(!state.adminDayId || !confirm('Eliminar este dia y sus videos?')) return;
    const { error } = await fitnessClient().from('fitness_days').delete().eq('id', state.adminDayId);
    if(error){
      toast('No se pudo eliminar el dia.');
      return;
    }
    state.adminDayId = '';
    state.loaded = false;
    await loadAdminDetails(state.adminMonthId);
    await loadFitnessData(true);
    rerender();
  }

  async function saveVideo(){
    const dayId = document.getElementById('fitVideoDayId')?.value || state.adminDayId;
    const title = document.getElementById('fitVideoTitle')?.value.trim();
    const url = document.getElementById('fitVideoUrl')?.value.trim();
    if(!dayId || !title || !url){
      toast('Completa dia, titulo y URL de YouTube.');
      return;
    }
    const yt = getYouTubeVideoData(url);
    if(!yt.isValid){
      toast(yt.error || 'URL de YouTube invalida.');
      return;
    }
    const payload = {
      fitness_day_id: dayId,
      title,
      original_url: yt.originalUrl,
      embed_url: yt.embedUrl,
      video_provider: 'youtube',
      source_page_url: document.getElementById('fitVideoSource')?.value.trim() || null,
      equipment: document.getElementById('fitVideoEquipment')?.value.trim() || null,
      activity_type: document.getElementById('fitVideoActivity')?.value || 'required',
      sort_order: Number(document.getElementById('fitVideoOrder')?.value || 1)
    };
    const db = fitnessClient();
    const result = state.adminVideoId
      ? await db.from('fitness_videos').update(payload).eq('id', state.adminVideoId).select('*').maybeSingle()
      : await db.from('fitness_videos').insert([payload]).select('*').maybeSingle();
    if(result.error){
      console.warn('saveVideo', result.error);
      toast('No se pudo guardar el video.');
      return;
    }
    state.adminVideoId = result.data?.id || state.adminVideoId;
    state.loaded = false;
    await loadAdminDetails(state.adminMonthId);
    await loadFitnessData(true);
    toast('Video guardado');
    rerender();
  }

  async function deleteVideo(){
    if(!state.adminVideoId || !confirm('Eliminar este video?')) return;
    const { error } = await fitnessClient().from('fitness_videos').delete().eq('id', state.adminVideoId);
    if(error){
      toast('No se pudo eliminar el video.');
      return;
    }
    state.adminVideoId = '';
    state.loaded = false;
    await loadAdminDetails(state.adminMonthId);
    await loadFitnessData(true);
    rerender();
  }

  async function duplicateMonth(){
    const sourceId = state.adminMonthId || state.month?.id;
    if(!sourceId){
      toast('Selecciona un mes para duplicar.');
      return;
    }
    const source = state.adminMonths.find(month => String(month.id) === String(sourceId)) || state.month;
    if(!source) return;
    const targetYear = Number(prompt('Año del nuevo borrador:', source.year));
    const targetMonth = Number(prompt('Mes del nuevo borrador:', source.month === 12 ? 1 : Number(source.month) + 1));
    if(!targetYear || !targetMonth) return;
    const db = fitnessClient();
    const monthInsert = await db.from('fitness_months').insert([{
      year: targetYear,
      month: targetMonth,
      name: `Borrador ${pad(targetMonth)}/${targetYear}`,
      source_pdf_url: source.source_pdf_url || null,
      status: 'draft',
      is_active: false,
      ranking_enabled: source.ranking_enabled !== false
    }]).select('*').maybeSingle();
    if(monthInsert.error){
      toast('No se pudo duplicar el mes.');
      console.warn('duplicate month', monthInsert.error);
      return;
    }
    await loadAdminDetails(sourceId);
    const newMonth = monthInsert.data;
    const dayMap = new Map();
    for(const sourceDay of state.adminDays){
      const dayNum = Number(String(sourceDay.workout_date).slice(8, 10));
      const targetDate = ymd(targetYear, targetMonth, Math.min(dayNum, new Date(targetYear, targetMonth, 0).getDate()));
      const inserted = await db.from('fitness_days').insert([{
        fitness_month_id: newMonth.id,
        workout_date: targetDate,
        category: sourceDay.category,
        title: sourceDay.title,
        day_type: sourceDay.day_type,
        description: sourceDay.description,
        sort_order: sourceDay.sort_order
      }]).select('*').maybeSingle();
      if(!inserted.error) dayMap.set(String(sourceDay.id), inserted.data.id);
    }
    const newVideos = state.adminVideos
      .filter(video => dayMap.has(String(video.fitness_day_id)))
      .map(video => ({
        fitness_day_id: dayMap.get(String(video.fitness_day_id)),
        title: video.title,
        original_url: video.original_url,
        embed_url: video.embed_url,
        video_provider: video.video_provider,
        source_page_url: video.source_page_url,
        equipment: video.equipment,
        duration_minutes: video.duration_minutes,
        activity_type: video.activity_type,
        sort_order: video.sort_order
      }));
    if(newVideos.length) await db.from('fitness_videos').insert(newVideos);
    state.adminMonthId = newMonth.id;
    await loadAdmin();
    toast('Mes duplicado como borrador');
    rerender();
  }

  window.GoldenFitness = {
    render,
    rememberLogin,
    clearSession: clearFitnessSession,
    getYouTubeVideoData
  };
  window.renderFitnessChallenge = render;
})();
