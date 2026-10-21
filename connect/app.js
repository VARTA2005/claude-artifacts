/*
 * Claude в браузере («Доступ с компьютера»). Страницу и API отдаёт приложение на телефоне:
 * /api/... — запросы с токеном (Authorization: Bearer), /api/events — поток событий (SSE).
 * Без библиотек: свой разбор Markdown, маршруты через #/…
 */
(function () {
  'use strict';

  // ------------------------------------------------------------ состояние
  const S = {
    token: load('token'),
    info: null,            // /api/state: телефон, настройки, режимы
    settings: {},
    chats: [],
    projects: [],
    running: new Set(),
    live: {},              // chatId → живой ответ
    questions: [],
    models: null,
    route: { name: 'home' },
    chat: null,            // { id, chat, messages, pending: [] }
    files: [],             // вложения в поле ввода: { name, path, url, image, uploading }
    online: true,
    panel: null,           // открытый артефакт
    collapsed: load('collapsed') === '1'
  };
  const $ = (sel, root) => (root || document).querySelector(sel);
  // Страница-закладка на GitHub Pages («Доступ из интернета»): адрес телефона — текущий туннель из connect/tunnel.json
  const REMOTE = window.CLAUDE_REMOTE || null;
  let BASE = '';
  const app = $('#app');
  let events = null;

  function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function save(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }

  // ------------------------------------------------------------ утилиты
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function icon(name, extra) { return `<svg class="i"${extra ? ' ' + extra : ''}><use href="#i-${name}"/></svg>`; }
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function fileUrl(path, download) {
    return BASE + '/api/file?path=' + encodeURIComponent(path) + '&token=' + encodeURIComponent(S.token) + (download ? '&download=1' : '');
  }
  function size(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' КБ';
    return (n / 1024 / 1024).toFixed(1) + ' МБ';
  }
  function when(t) {
    const d = new Date(t), now = new Date();
    const day = 86400000, diff = (now - d) / day;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    if (diff < 7) return d.toLocaleDateString('ru', { weekday: 'long' });
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    const hh = Math.round(m / 60);
    if (hh < 24) return hh + ' ч назад';
    return when(t);
  }
  let toastTimer = null;
  function toast(text) {
    let el = $('.toast');
    if (!el) { el = h('<div class="toast"></div>'); document.body.appendChild(el); }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3200);
  }
  function copy(text) {
    const done = () => toast('Скопировано');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = h('<textarea style="position:fixed;opacity:0"></textarea>');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  }
  const LOGO = (() => {
    const rays = [];
    const lens = [9.5, 7.8, 9.2, 8.2, 9.6, 7.6, 9.0, 8.4, 9.4, 7.9, 9.1, 8.3];
    for (let i = 0; i < 12; i++) rays.push(`<line x1="12" y1="12" x2="12" y2="${12 - lens[i]}" transform="rotate(${i * 30} 12 12)"/>`);
    return `<svg viewBox="0 0 24 24"><g stroke="#D97757" stroke-width="2.3" stroke-linecap="round">${rays.join('')}</g></svg>`;
  })();
  document.querySelectorAll('[data-logo]').forEach(el => { el.innerHTML = LOGO; });

  // ------------------------------------------------------------ API
  async function api(method, path, body, raw) {
    const opts = { method, headers: { Authorization: 'Bearer ' + S.token } };
    if (raw !== undefined) opts.body = raw;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(BASE + path, opts); } catch (e) { throw new Error('Нет связи с телефоном'); }
    if (res.status === 401) { logout(true); throw new Error('Нужно подключение'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Ошибка ' + res.status));
    return data;
  }

  // ------------------------------------------------------------ подключение к телефону
  function defaultName() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /YaBrowser/.test(ua) ? 'Яндекс Браузер'
      : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Браузер';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android'
      : /Linux/.test(ua) ? 'Linux' : /CrOS/.test(ua) ? 'ChromeOS' : '';
    return browser + (os ? ' · ' + os : '');
  }

  function showPair(message) {
    app.classList.add('hidden');
    const el = $('#pair');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="pair-card">
        <div class="logo">${LOGO}</div>
        <h1>Claude на компьютере</h1>
        <p>Подключите этот браузер к приложению Claude на телефоне. После подключения здесь будут все чаты, проекты и артефакты.</p>
        ${message ? `<p style="color:var(--danger)">${esc(message)}</p>` : ''}
        <input class="field" id="pair-name" value="${esc(load('deviceName') || defaultName())}" maxlength="60" placeholder="Название компьютера">
        <button class="btn accent" id="pair-go">Подключить</button>
        <div class="small">${REMOTE ? 'Подключение через интернет: телефон может быть в любой сети.' : 'Телефон и компьютер должны быть в одной сети Wi-Fi.'} На телефоне: «Настройки» → «Доступ с компьютера».</div>
      </div>`;
    $('#pair-go').onclick = startPair;
    $('#pair-name').onkeydown = e => { if (e.key === 'Enter') startPair(); };
  }

  async function startPair() {
    const name = $('#pair-name').value.trim() || defaultName();
    save('deviceName', name);
    let res;
    try {
      const r = await fetch(BASE + '/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      res = await r.json();
      if (!r.ok) throw new Error(res.error || 'Ошибка ' + r.status);
    } catch (e) { showPair(e.message === 'Failed to fetch' ? 'Нет связи с телефоном' : e.message); return; }
    $('#pair').innerHTML = `
      <div class="pair-card">
        <div class="logo">${LOGO.replace('<svg', '<svg class="spark"')}</div>
        <h1>Подтвердите на телефоне</h1>
        <p>На телефоне ${esc(res.phone || '')} появилось окно «Подключить компьютер?». Проверьте, что код совпадает, и нажмите «Разрешить».</p>
        <div class="code">${esc(res.code)}</div>
        <button class="btn" id="pair-cancel">Отмена</button>
        <div class="small">Окна нет? Откройте приложение Claude на телефоне.</div>
      </div>`;
    let stopped = false;
    $('#pair-cancel').onclick = () => { stopped = true; showPair(); };
    const started = Date.now();
    while (!stopped) {
      await new Promise(r => setTimeout(r, 1500));
      if (stopped) return;
      let st;
      try { st = await (await fetch(BASE + '/api/pair/' + encodeURIComponent(res.id))).json(); } catch (e) { continue; }
      if (st.status === 'approved' && st.token) {
        S.token = st.token; save('token', st.token);
        $('#pair').classList.add('hidden');
        boot();
        return;
      }
      if (st.status === 'denied') { showPair('На телефоне нажали «Отклонить».'); return; }
      if (st.status === 'expired' || Date.now() - started > 175000) { showPair('Время ожидания вышло — попробуйте ещё раз.'); return; }
    }
  }

  function logout(silent) {
    S.token = ''; save('token', '');
    if (events) { events.close(); events = null; }
    showPair(silent ? 'Доступ этого компьютера отозван на телефоне — подключитесь заново.' : '');
  }

  // ------------------------------------------------------------ запуск
  async function boot() {
    if (REMOTE && !BASE && !(await resolveBase())) { showOffline(); return; }
    if (!S.token) { showPair(); return; }
    let state;
    try { state = await api('GET', '/api/state'); } catch (e) {
      if (S.token) {
        // Через интернет адрес туннеля мог смениться — узнаём заново
        if (REMOTE) BASE = '';
        setTimeout(boot, 3000);
        setOnline(false);
      }
      return;
    }
    applyState(state);
    $('#pair').classList.add('hidden');
    app.classList.remove('hidden');
    app.classList.toggle('collapsed', S.collapsed);
    connectEvents();
    route();
  }

  function applyState(st) {
    S.info = st;
    S.settings = st.settings || {};
    if (st.chats) S.chats = st.chats;
    if (st.projects) S.projects = st.projects;
    if (st.running) S.running = new Set(st.running);
    $('#phone-name').textContent = st.phone || 'Телефон';
  }

  function connectEvents() {
    if (events) events.close();
    events = new EventSource(BASE + '/api/events?token=' + encodeURIComponent(S.token));
    events.addEventListener('hello', e => {
      setOnline(true);
      applyState(JSON.parse(e.data));
      renderSidebar();
      renderComposerState();
      if (S.route.name === 'chat') reloadChat(); else if (S.pageRedraw) S.pageRedraw();
    });
    events.addEventListener('chats', e => onChats(JSON.parse(e.data)));
    events.addEventListener('live', e => onLive(JSON.parse(e.data)));
    events.addEventListener('questions', e => onQuestions(JSON.parse(e.data)));
    events.addEventListener('revoked', () => logout(true));
    events.onopen = () => setOnline(true);
    events.onerror = () => {
      setOnline(false);
      // Токен отозван — EventSource сам этого не скажет: проверяем обычным запросом
      fetch(BASE + '/api/state', { headers: { Authorization: 'Bearer ' + S.token } })
        .then(r => { if (r.status === 401) logout(true); })
        .catch(() => { if (REMOTE) relocate(); });
    };
  }

  // ------------------------------------------------------------ доступ из интернета
  /** Текущий адрес туннеля: GitHub API (без задержки), запасной путь — копия на Pages. Проверяет, что телефон отвечает. */
  async function resolveBase() {
    const sources = [
      () => fetch(`https://api.github.com/repos/${REMOTE.repo}/contents/connect/tunnel.json?ref=${encodeURIComponent(REMOTE.branch || 'main')}`,
        { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }),
      () => fetch('tunnel.json?ts=' + Date.now(), { cache: 'no-store' })
    ];
    for (const get of sources) {
      let info;
      try { const r = await get(); if (!r.ok) continue; info = await r.json(); } catch (e) { continue; }
      const url = String(info.url || '').replace(/\/+$/, '');
      if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) return false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        const ping = await fetch(url + '/api/ping', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (!ping.ok) return false;
      } catch (e) { return false; }
      BASE = url;
      return true;
    }
    return false;
  }

  /** Связь пропала: туннель мог перезапуститься с новым адресом — переподключаемся к нему. */
  let relocating = false;
  async function relocate() {
    if (relocating) return;
    relocating = true;
    const old = BASE;
    try {
      if (await resolveBase() && BASE !== old) connectEvents();
    } finally {
      setTimeout(() => { relocating = false; }, 15000);
    }
  }

  let offlineTimer = null;
  function showOffline() {
    app.classList.add('hidden');
    const el = $('#pair');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="pair-card">
        <div class="logo">${LOGO}</div>
        <h1>Телефон не в сети</h1>
        <p>Включите на телефоне: «Настройки» → «Доступ с компьютера» → «Доступ из интернета». Нужен интернет на телефоне (Wi-Fi или мобильный).</p>
        <button class="btn accent" id="retry">Проверить снова</button>
        <div class="small">Страница проверяет сама каждые 15 секунд.</div>
      </div>`;
    $('#retry').onclick = () => { clearTimeout(offlineTimer); $('#retry').textContent = 'Проверяю…'; boot(); };
    clearTimeout(offlineTimer);
    offlineTimer = setTimeout(boot, 15000);
  }

  function setOnline(on) {
    S.online = on;
    $('#conn').classList.toggle('off', !on);
    $('#conn-text').textContent = on ? 'Подключено' : 'Нет связи';
    $('#banner').classList.toggle('hidden', on);
  }

  // ------------------------------------------------------------ события телефона
  let chatReload = null;
  function onChats(data) {
    const prevRunning = S.running;
    const prev = S.chat && S.chats.find(c => c.id === S.chat.id);
    S.chats = data.chats || [];
    S.projects = data.projects || [];
    S.running = new Set(data.running || []);
    renderSidebar();
    if (S.chat) {
      const cur = S.chats.find(c => c.id === S.chat.id);
      if (!cur) { toast('Чат удалён'); location.hash = '#/'; return; }
      if (!prev || cur.updatedAt !== prev.updatedAt || prevRunning.has(cur.id) !== S.running.has(cur.id)) scheduleReload();
      if (prev && cur.title !== prev.title) renderTopbar();
      renderComposerState();
    } else if (S.pageRedraw) {
      S.pageRedraw();
    }
    updateDocTitle();
  }

  function scheduleReload() {
    clearTimeout(chatReload);
    chatReload = setTimeout(reloadChat, 120);
  }

  function onLive(list) {
    const prev = S.live;
    S.live = {};
    list.forEach(a => { S.live[a.chatId] = a; });
    if (S.chat) {
      const was = prev[S.chat.id], now = S.live[S.chat.id];
      if (was && was.running && (!now || !now.running)) { S.chat.holdLive = true; scheduleReload(); }
      renderLive();
      renderComposerState();
    }
    renderSidebar();
    updateDocTitle();
  }

  function onQuestions(list) {
    const before = new Set(S.questions.map(q => q.id));
    S.questions = list;
    list.forEach(q => {
      if (!before.has(q.id) && (!S.chat || q.chatId !== S.chat.id)) {
        const c = S.chats.find(x => x.id === q.chatId);
        toast('Claude спрашивает в чате «' + (c ? c.title : 'Чат') + '»');
      }
    });
    renderSidebar();
    if (S.chat) renderQuestions();
  }

  function updateDocTitle() {
    const busy = [...S.running].length;
    const cur = S.chat && S.chats.find(c => c.id === S.chat.id);
    document.title = (busy ? '● ' : '') + (cur ? cur.title + ' — ' : '') + 'Claude';
  }

  // ------------------------------------------------------------ маршруты
  window.addEventListener('hashchange', route);
  function route() {
    // Ещё не подключены: маршрут откроется после boot()
    if (!S.info) return;
    const hash = location.hash.replace(/^#\/?/, '');
    const [name, id] = hash.split('/');
    closeMenus();
    if (name === 'chat' && id) S.route = { name: 'chat', id: decodeURIComponent(id) };
    else if (name === 'project' && id) S.route = { name: 'project', id: decodeURIComponent(id) };
    else if (['projects', 'chats', 'artifacts'].includes(name)) S.route = { name };
    else S.route = { name: 'home' };
    if (S.route.name !== 'chat') S.chat = null;
    if (window.innerWidth <= 860) setCollapsed(true);
    renderSidebar();
    renderView();
  }

  function renderView() {
    renderTopbar();
    const view = $('#view');
    view.innerHTML = '';
    S.pageRedraw = null;
    switch (S.route.name) {
      case 'chat': openChat(S.route.id); break;
      case 'projects': view.appendChild(projectsPage()); break;
      case 'project': view.appendChild(projectPage(S.route.id)); break;
      case 'chats': view.appendChild(chatsPage()); break;
      case 'artifacts': view.appendChild(artifactsPage()); break;
      default: view.appendChild(homePage());
    }
    updateDocTitle();
  }

  function renderTopbar() {
    const title = $('#title'), crumb = $('#crumb');
    const menu = $('#chat-menu'), arts = $('#artifacts-btn');
    title.classList.remove('editable');
    title.onclick = null;
    menu.classList.add('hidden');
    arts.classList.add('hidden');
    crumb.textContent = '';
    if (S.route.name === 'chat') {
      const c = S.chats.find(x => x.id === S.route.id);
      const p = c && c.projectId && S.projects.find(x => x.id === c.projectId);
      if (p) { crumb.innerHTML = `<a href="#/project/${encodeURIComponent(p.id)}" style="color:inherit;text-decoration:none">${esc(p.name)}</a> /`; }
      title.textContent = c ? c.title : '';
      title.classList.add('editable');
      title.title = 'Переименовать';
      title.onclick = () => c && renameChat(c);
      menu.classList.remove('hidden');
      menu.onclick = e => c && chatMenu(c, e.currentTarget);
      arts.classList.remove('hidden');
      arts.onclick = () => showChatArtifacts(S.route.id, arts);
    } else {
      title.textContent = '';
    }
  }

  function goHome() {
    if (location.hash === '#/' || location.hash === '') route(); else location.hash = '#/';
  }

  // ------------------------------------------------------------ боковая панель
  function setCollapsed(on) {
    S.collapsed = on;
    app.classList.toggle('collapsed', on);
    if (window.innerWidth > 860) save('collapsed', on ? '1' : '');
  }
  $('#collapse').onclick = () => setCollapsed(true);
  $('#open-sb').onclick = () => setCollapsed(false);
  $('#new-chat').onclick = () => { goHome(); setTimeout(() => { const t = $('#view textarea'); if (t) t.focus(); }, 30); };
  $('#settings-btn').onclick = e => settingsMenu(e.currentTarget);

  function renderSidebar() {
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === S.route.name));
    const list = $('#chat-list');
    const asked = new Set(S.questions.map(q => q.chatId));
    const current = S.route.name === 'chat' ? S.route.id : null;
    const item = c => `
      <div class="chat-item${c.id === current ? ' active' : ''}" data-id="${esc(c.id)}">
        <span class="t">${esc(c.title || 'Без названия')}</span>
        ${asked.has(c.id) ? '<span class="dot-ask" title="Claude ждёт ответа">?</span>' : ''}
        ${isRunning(c.id) ? '<span class="dot-run" title="Claude работает"></span>' : ''}
        <button class="icon-btn sm menu-btn" data-menu="${esc(c.id)}" title="Ещё">${icon('dots')}</button>
      </div>`;
    const starred = S.chats.filter(c => c.starred);
    const recent = S.chats.filter(c => !c.starred).slice(0, 60);
    let html = '';
    if (starred.length) html += '<div class="sb-section">Избранные</div>' + starred.map(item).join('');
    html += '<div class="sb-section">Недавние</div>' + (recent.length ? recent.map(item).join('') : '<div class="sb-section" style="padding-top:0">Чатов пока нет</div>');
    list.innerHTML = html;
    list.querySelectorAll('.chat-item').forEach(el => {
      el.onclick = e => {
        const m = e.target.closest('[data-menu]');
        const c = S.chats.find(x => x.id === el.dataset.id);
        if (m) { e.stopPropagation(); if (c) chatMenu(c, m); return; }
        location.hash = '#/chat/' + encodeURIComponent(el.dataset.id);
      };
    });
  }

  function isRunning(id) { return S.running.has(id) || !!(S.live[id] && S.live[id].running); }

  // ------------------------------------------------------------ меню и окна
  function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.remove()); }
  document.addEventListener('mousedown', e => { if (!e.target.closest('.menu')) closeMenus(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('.lightbox')) { $('.lightbox').remove(); return; }
      if ($('.menu')) { closeMenus(); return; }
      if ($('.modal-bg')) { $('.modal-bg').remove(); return; }
      if (S.panel) { closePanel(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); location.hash = '#/chats'; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#new-chat').click(); }
  });

  /** items: { label, sub, onClick, danger, checked, sep, header } */
  function menu(anchor, items, opts) {
    closeMenus();
    const el = h('<div class="menu"></div>');
    items.forEach(it => {
      if (it.sep) { el.appendChild(h('<div class="sep"></div>')); return; }
      if (it.header) { el.appendChild(h(`<div class="mh">${esc(it.header)}</div>`)); return; }
      const b = h(`<button class="mi${it.danger ? ' danger' : ''}">
          ${it.checked !== undefined ? `<span class="ck">${it.checked ? icon('check') : ''}</span>` : ''}
          <span style="flex:1;min-width:0"><div>${esc(it.label)}</div>${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ''}</span>
        </button>`);
      b.onclick = () => { closeMenus(); it.onClick && it.onClick(); };
      el.appendChild(b);
    });
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let x = (opts && opts.alignRight) ? r.right - mw : r.left;
    let y = (opts && opts.above) ? r.top - mh - 6 : r.bottom + 6;
    if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 6);
    if (y < 8) y = 8;
    x = Math.min(Math.max(8, x), window.innerWidth - mw - 8);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    return el;
  }

  function modal(html, onReady) {
    const bg = h(`<div class="modal-bg"><div class="modal">${html}</div></div>`);
    bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
    const close = () => bg.remove();
    onReady && onReady(bg, close);
    const f = bg.querySelector('input,textarea');
    if (f) { f.focus(); if (f.select) f.select(); }
    return close;
  }

  function confirmBox(title, text, okText, onOk) {
    modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="btns"><button class="btn" data-x>Отмена</button><button class="btn danger" data-ok>${esc(okText)}</button></div>`,
      (bg, close) => {
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = () => { close(); onOk(); };
      });
  }

  function renameChat(c) {
    modal(`<h3>Переименовать чат</h3><input class="field" value="${esc(c.title)}" maxlength="120"><div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Сохранить</button></div>`,
      (bg, close) => {
        const input = bg.querySelector('input');
        const ok = async () => {
          const title = input.value.trim();
          if (!title) return;
          close();
          try { await api('POST', `/api/chats/${encodeURIComponent(c.id)}/rename`, { title }); } catch (e) { toast(e.message); }
        };
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = ok;
        input.onkeydown = e => { if (e.key === 'Enter') ok(); };
      });
  }

  function chatMenu(c, anchor) {
    const items = [
      { label: 'Переименовать', onClick: () => renameChat(c) },
      { label: c.starred ? 'Убрать из избранного' : 'В избранное', onClick: () => api('POST', `/api/chats/${encodeURIComponent(c.id)}/star`, { starred: !c.starred }).catch(e => toast(e.message)) },
      { label: 'Перенести в проект…', onClick: () => moveChat(c, anchor) }
    ];
    if (isRunning(c.id)) items.push({ label: 'Остановить Claude', onClick: () => stopChat(c.id) });
    items.push({ sep: true }, {
      label: 'Удалить', danger: true,
      onClick: () => confirmBox('Удалить чат?', `«${c.title}» будет удалён на телефоне вместе с сообщениями.`, 'Удалить',
        () => api('POST', `/api/chats/${encodeURIComponent(c.id)}/delete`).then(() => { if (S.chat && S.chat.id === c.id) location.hash = '#/'; }).catch(e => toast(e.message)))
    });
    menu(anchor, items);
  }

  function moveChat(c, anchor) {
    const items = [{ header: 'Проект' }, { label: 'Без проекта', checked: !c.projectId, onClick: () => setProject(null) }];
    S.projects.forEach(p => items.push({ label: p.name, checked: c.projectId === p.id, onClick: () => setProject(p.id) }));
    menu(anchor, items);
    function setProject(id) {
      api('POST', `/api/chats/${encodeURIComponent(c.id)}/project`, { projectId: id || '' }).then(() => toast('Чат перенесён')).catch(e => toast(e.message));
    }
  }

  function settingsMenu(anchor) {
    const theme = load('theme') || 'system';
    const st = S.settings;
    const items = [{ header: 'Тема' }];
    [['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].forEach(([id, label]) =>
      items.push({ label, checked: theme === id, onClick: () => setTheme(id) }));
    items.push({ sep: true }, { header: 'Разрешения «Кода»' });
    (S.info.permissionModes || []).forEach(m => items.push({
      label: m.title, sub: m.description, checked: st.permissionMode === m.id, onClick: () => setSetting({ permissionMode: m.id })
    }));
    items.push({ sep: true }, { header: 'Стиль ответа' });
    (S.info.styles || []).forEach(m => items.push({ label: m.title, sub: m.description, checked: st.style === m.id, onClick: () => setSetting({ style: m.id }) }));
    items.push({ sep: true }, {
      label: 'О подключении', sub: `${S.info.phone} · Claude ${S.info.version} (сборка ${S.info.build})`,
      onClick: () => toast('Этот компьютер: ' + ((S.info.device && S.info.device.name) || ''))
    }, {
      label: 'Отключить этот компьютер', danger: true,
      onClick: () => confirmBox('Отключить компьютер?', 'Браузер потеряет доступ к чатам. Подключиться снова можно, разрешив доступ на телефоне.', 'Отключить',
        () => api('POST', '/api/logout').catch(() => {}).finally(() => logout(false)))
    });
    menu(anchor, items, { above: true });
  }

  function setTheme(id) {
    save('theme', id === 'system' ? '' : id);
    if (id === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
  }

  async function setSetting(patch) {
    Object.assign(S.settings, patch);
    renderComposerState();
    try { S.settings = await api('POST', '/api/settings', patch); renderComposerState(); } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------ главная
  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  }

  function homePage(projectId) {
    const el = h(`<div class="scroll" style="display:flex;flex-direction:column"><div class="home column" style="width:100%"></div></div>`);
    const col = el.firstElementChild;
    col.appendChild(h(`<h1 class="greet">${LOGO}${esc(greeting())}</h1>`));
    if (!S.settings.configured) {
      col.appendChild(h(`<div class="err-box" style="margin-bottom:16px">На телефоне не настроен сервер модели: откройте «Настройки» в приложении и укажите адрес, API-ключ и модель.</div>`));
    }
    col.appendChild(composer({ projectId: projectId || null }));
    const chips = h(`<div class="chips"></div>`);
    [['code', 'Код', 'Напиши'], ['bulb', 'Объясни', 'Объясни простыми словами: '], ['globe', 'Найди в интернете', 'Найди в интернете и кратко перескажи: '], ['edit', 'Помоги написать', 'Помоги написать ']]
      .forEach(([ic, label, text]) => {
        const b = h(`<button class="chip">${icon(ic)}${esc(label)}</button>`);
        b.onclick = () => { const t = col.querySelector('textarea'); t.value = text + (text.endsWith(' ') ? '' : ' '); t.focus(); t.dispatchEvent(new Event('input')); };
        chips.appendChild(b);
      });
    col.appendChild(chips);
    col.appendChild(h(`<div class="hint">Claude работает на телефоне ${esc(S.info.phone || '')} — здесь всё то же, что в приложении.</div>`));
    return el;
  }

  // ------------------------------------------------------------ поле ввода
  function composer(opts) {
    const wrap = h(`
      <div class="composer-wrap">
        <div class="composer">
          <div class="pending-files hidden"></div>
          <textarea rows="1" placeholder="${opts.chatId ? 'Ответить Claude…' : 'Чем могу помочь?'}"></textarea>
          <div class="c-row">
            <button class="c-btn" data-attach title="Прикрепить файлы">${icon('clip')}</button>
            <button class="c-btn" data-tools title="Режимы">${icon('tools')}</button>
            <span class="modes" style="display:flex;gap:6px"></span>
            <div class="spacer"></div>
            <button class="c-btn model-btn" data-model title="Модель"><span></span>${icon('down', 'style="width:14px;height:14px"')}</button>
            <button class="send" data-send title="Отправить">${icon('up')}</button>
          </div>
        </div>
        ${opts.chatId ? '<div class="note">Claude может ошибаться. Проверяйте важное.</div>' : ''}
      </div>`);
    const ta = wrap.querySelector('textarea');
    const box = wrap.querySelector('.composer');
    const send = wrap.querySelector('[data-send]');
    wrap._opts = opts;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.4) + 'px'; updateSend(); };
    function updateSend() {
      const running = opts.chatId && isRunning(opts.chatId);
      const empty = !ta.value.trim() && !S.files.some(f => f.path);
      const uploading = S.files.some(f => f.uploading);
      if (running && empty) {
        send.className = 'send stop'; send.innerHTML = icon('stop'); send.title = 'Остановить'; send.disabled = false;
      } else {
        send.className = 'send'; send.innerHTML = icon('up'); send.title = running ? 'В очередь: Claude ответит после текущей задачи' : 'Отправить';
        send.disabled = empty || uploading;
      }
    }
    wrap._update = () => { updateSend(); renderModes(wrap); renderFiles(wrap); };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled && !send.classList.contains('stop')) submit(); }
    });
    ta.addEventListener('paste', e => {
      const files = [...(e.clipboardData && e.clipboardData.files || [])];
      if (files.length) { e.preventDefault(); files.forEach(f => uploadFile(f, wrap)); }
    });
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', e => {
      e.preventDefault(); box.classList.remove('drag');
      [...(e.dataTransfer && e.dataTransfer.files || [])].forEach(f => uploadFile(f, wrap));
    });
    wrap.querySelector('[data-attach]').onclick = () => {
      const input = $('#file-input');
      input.value = '';
      input.onchange = () => [...input.files].forEach(f => uploadFile(f, wrap));
      input.click();
    };
    wrap.querySelector('[data-tools]').onclick = e => toolsMenu(e.currentTarget, wrap);
    wrap.querySelector('[data-model]').onclick = e => modelMenu(e.currentTarget, wrap);
    send.onclick = () => { if (send.classList.contains('stop')) stopChat(opts.chatId); else submit(); };

    async function submit() {
      const text = ta.value.trim();
      const files = S.files.filter(f => f.path);
      if (!text && !files.length) return;
      if (S.files.some(f => f.uploading)) { toast('Дождитесь загрузки файлов'); return; }
      ta.value = ''; S.files = []; grow(); renderFiles(wrap);
      try {
        if (opts.chatId) {
          addPending(text, files);
          await api('POST', `/api/chats/${encodeURIComponent(opts.chatId)}/messages`, { text, files: files.map(f => f.path) });
        } else {
          const res = await api('POST', '/api/chats', { text, files: files.map(f => f.path), projectId: opts.projectId || '' });
          S.firstMessage = { chatId: res.id, text, files };
          location.hash = '#/chat/' + encodeURIComponent(res.id);
        }
      } catch (e) {
        toast(e.message);
        ta.value = text; S.files = files; grow(); renderFiles(wrap);
        if (S.chat) { S.chat.pending = []; renderMessages(); }
      }
    }
    setTimeout(() => { renderModes(wrap); renderFiles(wrap); grow(); }, 0);
    return wrap;
  }

  function renderModes(wrap) {
    const st = S.settings;
    const modes = wrap.querySelector('.modes');
    const on = [];
    if (st.codeMode) on.push(['code', 'Код', 'codeMode']);
    if (st.webSearch) on.push(['globe', 'Поиск', 'webSearch']);
    if (st.research) on.push(['search', 'Исследование', 'research']);
    if (st.planMode) on.push(['bulb', 'План', 'planMode']);
    modes.innerHTML = on.map(([ic, label, key]) => `<button class="c-btn on" data-key="${key}" title="Выключить">${icon(ic)}${label}</button>`).join('');
    modes.querySelectorAll('[data-key]').forEach(b => { b.onclick = () => setSetting({ [b.dataset.key]: false }); });
    const depth = (S.info.depths || []).find(d => d.id === st.depth);
    const model = shortModel(st.model);
    wrap.querySelector('[data-model] span').textContent = model + (depth && depth.id !== 'NORMAL' ? ' · ' + depth.title : '');
  }

  function shortModel(id) {
    if (!id) return 'Модель';
    const m = S.models && S.models.find(x => x.id === id);
    let name = (m && m.name) || id;
    name = name.replace(/^claude-/i, 'Claude ').replace(/-(\d{8}|latest)$/, '').replace(/-/g, ' ');
    return name.replace(/\b([a-z])/g, c => c.toUpperCase());
  }

  function toolsMenu(anchor, wrap) {
    const st = S.settings;
    const items = [
      { header: 'Режимы' },
      { label: 'Код', sub: 'Claude работает с файлами проекта, как Claude Code', checked: !!st.codeMode, onClick: () => setSetting({ codeMode: !st.codeMode }) },
      { label: 'Поиск в интернете', checked: !!st.webSearch, onClick: () => setSetting({ webSearch: !st.webSearch }) },
      { label: 'Исследование', sub: 'Многошаговый поиск и отчёт с источниками', checked: !!st.research, onClick: () => setSetting({ research: !st.research }) },
      { label: 'План', sub: 'В «Коде»: только изучить и предложить план', checked: !!st.planMode, onClick: () => setSetting({ planMode: !st.planMode }) },
      { sep: true }, { header: 'Глубина ответа' }
    ];
    (S.info.depths || []).forEach(d => items.push({ label: d.title, sub: d.description, checked: st.depth === d.id, onClick: () => setSetting({ depth: d.id }) }));
    menu(anchor, items, { above: true });
  }

  async function modelMenu(anchor, wrap) {
    if (!S.models) {
      const m = menu(anchor, [{ header: 'Загружаю модели…' }], { above: true, alignRight: true });
      try { S.models = (await api('GET', '/api/models')).models || []; } catch (e) { S.models = null; toast(e.message); return; }
      if (!document.body.contains(m)) return;
      renderModes(wrap);
    }
    const items = [{ header: 'Модель' }];
    if (!S.models.length) items.push({ label: S.settings.model || 'Список моделей недоступен', checked: true });
    S.models.forEach(m => items.push({ label: m.name || m.id, sub: m.name && m.name !== m.id ? m.id : '', checked: m.id === S.settings.model, onClick: () => setSetting({ model: m.id }) }));
    menu(anchor, items, { above: true, alignRight: true });
  }

  async function uploadFile(file, wrap) {
    if (file.size > 20 * 1024 * 1024) { toast('Файл больше 20 МБ'); return; }
    const entry = { name: file.name || 'file', uploading: true, image: /^image\//.test(file.type) && !/svg/.test(file.type), local: null };
    if (entry.image) entry.local = URL.createObjectURL(file);
    S.files.push(entry);
    renderFiles(wrap);
    try {
      const res = await api('POST', '/api/upload?name=' + encodeURIComponent(entry.name), undefined, file);
      entry.path = res.path; entry.name = res.name || entry.name;
    } catch (e) {
      toast('Не удалось загрузить «' + entry.name + '»: ' + e.message);
      S.files = S.files.filter(f => f !== entry);
    }
    entry.uploading = false;
    renderFiles(wrap);
  }

  function renderFiles(wrap) {
    const box = wrap.querySelector('.pending-files');
    if (!box) return;
    box.classList.toggle('hidden', !S.files.length);
    box.innerHTML = '';
    S.files.forEach(f => {
      const el = h(`<div class="pf${f.uploading ? ' up' : ''}">
        ${f.image && (f.local || f.path) ? `<img src="${esc(f.local || fileUrl(f.path))}">` : `<span class="fi" style="padding:6px">${icon('file')}</span>`}
        <span class="nm">${esc(f.name)}</span><button class="x" title="Убрать">×</button></div>`);
      el.querySelector('.x').onclick = () => { S.files = S.files.filter(x => x !== f); renderFiles(wrap); };
      box.appendChild(el);
    });
    const send = wrap.querySelector('[data-send]');
    if (send && wrap._update && !wrap._busy) { wrap._busy = true; wrap._update(); wrap._busy = false; }
  }

  function renderComposerState() {
    document.querySelectorAll('.composer-wrap').forEach(w => { if (w._update) { w._busy = true; w._update(); w._busy = false; } });
  }

  async function stopChat(id) {
    try { await api('POST', `/api/chats/${encodeURIComponent(id)}/stop`); toast('Остановлено'); } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------ чат
  async function openChat(id) {
    const view = $('#view');
    const el = h(`
      <div style="display:flex;flex-direction:column;flex:1;min-height:0">
        <div class="scroll" id="chat-scroll"><div class="column"><div class="messages" id="messages"></div><div id="live"></div><div id="questions"></div></div></div>
        <div class="column" style="width:100%" id="composer-box"></div>
      </div>`);
    view.appendChild(el);
    const pending = S.firstMessage && S.firstMessage.chatId === id ? [S.firstMessage] : [];
    S.firstMessage = null;
    S.chat = { id, messages: null, pending };
    $('#composer-box').appendChild(composer({ chatId: id }));
    renderMessages();
    await reloadChat(true);
    const t = $('#composer-box textarea');
    if (t) t.focus();
  }

  async function reloadChat(scrollDown) {
    if (!S.chat) return;
    const id = S.chat.id;
    let data;
    try { data = await api('GET', `/api/chats/${encodeURIComponent(id)}`); } catch (e) {
      if (S.chat && S.chat.id === id && !S.chat.messages) $('#messages').innerHTML = `<div class="err-box">${esc(e.message)}</div>`;
      return;
    }
    if (!S.chat || S.chat.id !== id) return;
    const sc = $('#chat-scroll');
    const atBottom = scrollDown || !sc || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
    S.chat.messages = data.messages;
    // Сообщение из браузера появилось в чате — черновик больше не нужен
    const users = data.messages.filter(m => m.role === 'user').length;
    if (S.chat.userCount !== undefined && users > S.chat.userCount) S.chat.pending = S.chat.pending.slice(users - S.chat.userCount);
    if (S.chat.userCount === undefined && data.messages.length) S.chat.pending = S.chat.pending.filter(p => !data.messages.some(m => m.role === 'user' && m.content === p.text));
    S.chat.userCount = users;
    S.chat.holdLive = false;
    renderMessages();
    renderLive();
    renderQuestions();
    renderTopbar();
    if (atBottom) scrollBottom();
  }

  function addPending(text, files) {
    if (!S.chat) return;
    S.chat.pending.push({ text, files });
    renderMessages();
    scrollBottom();
  }

  function scrollBottom() {
    const sc = $('#chat-scroll');
    if (sc) requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
  }

  function renderMessages() {
    const box = $('#messages');
    if (!box || !S.chat) return;
    const list = S.chat.messages;
    if (!list) { box.innerHTML = '<div class="live-status">' + LOGO.replace('<svg', '<svg class="spark"') + 'Загружаю чат…</div>'; return; }
    const frag = document.createDocumentFragment();
    list.forEach(m => frag.appendChild(m.role === 'user' ? userMessage(m) : assistantMessage(m)));
    S.chat.pending.forEach(p => frag.appendChild(userMessage({ content: p.text, files: (p.files || []).map(f => ({ kind: f.image ? 'image' : 'file', path: f.path, name: f.name })) }, true)));
    if (!list.length && !S.chat.pending.length && !isRunning(S.chat.id)) frag.appendChild(h('<div class="empty">В этом чате пока нет сообщений</div>'));
    box.innerHTML = '';
    box.appendChild(frag);
  }

  function userMessage(m, pending) {
    const el = h(`<div class="msg user${pending ? ' pending' : ''}"><div class="wrap"></div></div>`);
    const wrap = el.firstElementChild;
    if (m.files && m.files.length) wrap.appendChild(filesBlock(m.files));
    if (m.content) {
      const auto = m.content.startsWith('[Автоматически] ');
      wrap.appendChild(h(`<div class="bubble"${auto ? ' style="opacity:.75;font-size:14px"' : ''}>${esc(m.content)}</div>`));
    }
    return el;
  }

  function assistantMessage(m) {
    const el = h('<div class="msg assistant"></div>');
    if (m.error) { el.appendChild(h(`<div class="err-box">${esc(m.content)}</div>`)); return el; }
    if (m.thinking) el.appendChild(fold('Размышления', `<div class="thinking">${esc(m.thinking)}</div>`));
    if (m.tools && m.tools.length) el.appendChild(stepsFold(m.tools, false));
    const body = h('<div class="assistant-body md"></div>');
    body.innerHTML = markdown(m.content || '');
    enhance(body);
    el.appendChild(body);
    if (m.files && m.files.length) el.appendChild(filesBlock(m.files));
    const actions = h(`<div class="msg-actions"><button class="icon-btn sm" title="Копировать">${icon('copy')}</button><span class="meta">${esc(when(m.createdAt))}${usageText(m.usage)}</span></div>`);
    actions.querySelector('button').onclick = () => copy(m.content || '');
    el.appendChild(actions);
    return el;
  }

  function usageText(u) {
    if (!u || typeof u !== 'object') return '';
    const inT = u.in || u.input || 0, outT = u.out || u.output || 0;
    return inT || outT ? ` · ${(inT / 1000).toFixed(1)}K → ${(outT / 1000).toFixed(1)}K токенов` : '';
  }

  function fold(title, inner, open) {
    return h(`<details class="fold"${open ? ' open' : ''}><summary>${icon('chev', 'class="i chev" style="width:14px;height:14px"')}${esc(title)}</summary><div class="fold-body">${inner}</div></details>`);
  }

  function stepsFold(tools, open) {
    const errors = tools.filter(t => t.error).length;
    const title = 'Действия: ' + tools.length + (errors ? ` (ошибок: ${errors})` : '');
    const el = fold(title, '<div class="steps"></div>', open);
    const box = el.querySelector('.steps');
    tools.forEach(t => {
      const s = h(`<details class="step${t.error ? ' err' : ''}"><summary><span class="ic">${icon(t.error ? 'x' : 'check', 'style="width:15px;height:15px"')}</span><span>${esc(t.title)}</span></summary></details>`);
      if (t.result) {
        s.addEventListener('toggle', () => {
          if (s.open && !s.querySelector('pre')) s.appendChild(h(`<pre>${esc(t.result)}</pre>`));
        });
      }
      box.appendChild(s);
    });
    return el;
  }

  function filesBlock(files) {
    const grid = h('<div class="att-grid"></div>');
    files.forEach(f => {
      if (f.kind === 'image' && f.path) {
        const el = h(`<div class="att-img"><img loading="lazy" src="${esc(fileUrl(f.path))}" alt="${esc(f.name)}"></div>`);
        el.onclick = () => lightbox(fileUrl(f.path));
        grid.appendChild(el);
      } else if (f.kind === 'video' && f.path) {
        grid.appendChild(h(`<video class="att-video" controls preload="metadata" src="${esc(fileUrl(f.path))}"></video>`));
      } else if (f.kind === 'artifact') {
        const el = h(`<div class="artifact-card"><div class="ai">${icon('artifact')}</div><div><div class="n">${esc(f.name)}</div><div class="s">Артефакт · открыть</div></div></div>`);
        el.onclick = () => openArtifact(f.id);
        grid.appendChild(el);
      } else if (f.kind === 'findings' && f.report) {
        grid.appendChild(findingsBlock(f.report));
      } else if (f.path) {
        const el = h(`<a class="file-card" href="${esc(fileUrl(f.path, true))}" title="Скачать"><span class="fi">${icon('file')}</span>
          <span class="meta"><div class="fn">${esc(f.name)}</div><div class="fs">${f.exists === false ? 'файла нет на телефоне' : esc(size(f.size))}</div></span>${icon('download')}</a>`);
        grid.appendChild(el);
      }
    });
    return grid;
  }

  function findingsBlock(report) {
    const list = report.findings || [];
    const el = h(`<div class="findings" style="width:100%"><h4>${esc(report.title || 'Находки')} · ${list.length ? 'находок: ' + list.length : 'находок нет'}</h4></div>`);
    list.forEach(f => {
      el.appendChild(h(`<div class="finding"><div><span class="sev">${esc(f.severity || 'medium')}</span><b>${esc(f.title)}</b></div>
        ${f.file ? `<div class="loc">${esc(f.file)}${f.line ? ':' + esc(f.line) : ''}</div>` : ''}
        ${f.detail ? `<div>${esc(f.detail)}</div>` : ''}${f.fix ? `<div style="color:var(--muted)">Как исправить: ${esc(f.fix)}</div>` : ''}</div>`));
    });
    return el;
  }

  function lightbox(src) {
    const el = h(`<div class="lightbox"><img src="${esc(src)}"></div>`);
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }

  // ------------------------------------------------------------ живой ответ
  let liveFrame = 0;
  function renderLive() {
    if (liveFrame) return;
    liveFrame = requestAnimationFrame(() => { liveFrame = 0; drawLive(); });
  }

  function drawLive() {
    const box = $('#live');
    if (!box || !S.chat) return;
    const a = S.live[S.chat.id];
    const running = (a && a.running) || S.running.has(S.chat.id);
    if (!running) {
      if (S.chat.holdLive) return;
      box.innerHTML = '';
      return;
    }
    const sc = $('#chat-scroll');
    const atBottom = !sc || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140;
    const status = (a && a.status) || 'Думаю…';
    const steps = (a && a.steps) || [];
    const text = (a && a.text) || '';
    if (!box.firstElementChild) {
      box.innerHTML = `<div class="msg assistant"><div class="live-steps"></div><div class="assistant-body md live-text"></div>
        <div class="live-status">${LOGO.replace('<svg', '<svg class="spark"')}<span class="st"></span></div><div class="queued"></div></div>`;
    }
    box.querySelector('.st').textContent = status;
    box.querySelector('.queued').textContent = a && a.queued ? `Ещё сообщений в очереди: ${a.queued}` : '';
    const stepsBox = box.querySelector('.live-steps');
    if (stepsBox._n !== steps.length) {
      stepsBox._n = steps.length;
      const wasOpen = stepsBox.firstElementChild && stepsBox.firstElementChild.open;
      stepsBox.innerHTML = '';
      if (steps.length) stepsBox.appendChild(stepsFold(steps, wasOpen));
    }
    const textBox = box.querySelector('.live-text');
    if (textBox._text !== text) {
      textBox._text = text;
      textBox.innerHTML = markdown(text);
      textBox.classList.toggle('cursor', !!text);
      enhance(textBox);
    }
    if (atBottom) scrollBottom();
  }

  // ------------------------------------------------------------ вопросы Claude
  function renderQuestions() {
    const box = $('#questions');
    if (!box || !S.chat) return;
    const list = S.questions.filter(q => q.chatId === S.chat.id);
    const key = list.map(q => q.id).join(',');
    if (box._key === key) return;
    box._key = key;
    box.innerHTML = '';
    list.forEach(q => box.appendChild(questionCard(q)));
    if (list.length) scrollBottom();
  }

  function questionCard(q) {
    const el = h(`<div class="question"><div class="qh">${esc(q.header || 'Вопрос Claude')}</div><div class="qt">${esc(q.question)}</div><div class="opts"></div></div>`);
    const opts = el.querySelector('.opts');
    const selected = new Set();
    const answer = text => api('POST', `/api/questions/${encodeURIComponent(q.id)}`, { answer: text }).catch(e => toast(e.message));
    (q.options || []).forEach(o => {
      const b = h(`<button class="opt"><span>${q.multi ? '☐' : '›'}</span><span><div>${esc(o.label)}</div>${o.description ? `<div class="d">${esc(o.description)}</div>` : ''}</span></button>`);
      b.onclick = () => {
        if (!q.multi) { answer(o.label); el.style.opacity = '.5'; return; }
        if (selected.has(o.label)) selected.delete(o.label); else selected.add(o.label);
        b.classList.toggle('sel', selected.has(o.label));
        b.firstElementChild.textContent = selected.has(o.label) ? '☑' : '☐';
      };
      opts.appendChild(b);
    });
    if (q.multi) {
      const done = h('<button class="btn primary" style="align-self:flex-start;margin-top:6px">Ответить</button>');
      done.onclick = () => { if (selected.size) answer([...selected].join('; ')); };
      opts.appendChild(done);
    }
    if (q.allowOther) {
      const other = h('<div class="other"><input placeholder="Свой ответ…"><button class="btn">Отправить</button></div>');
      const input = other.querySelector('input');
      const go = () => { if (input.value.trim()) answer(input.value.trim()); };
      other.querySelector('button').onclick = go;
      input.onkeydown = e => { if (e.key === 'Enter') go(); };
      el.appendChild(other);
    }
    return el;
  }

  // ------------------------------------------------------------ страницы
  function pageShell(title, actions) {
    const el = h(`<div class="scroll"><div class="column page"><div class="page-head"><h1>${esc(title)}</h1></div><div class="page-body"></div></div></div>`);
    if (actions) el.querySelector('.page-head').appendChild(actions);
    return el;
  }

  function chatsPage() {
    const el = pageShell('Чаты', (() => { const b = h(`<button class="btn primary">${icon('plus', 'style="width:15px;height:15px;vertical-align:-2px"')} Новый чат</button>`); b.onclick = () => { location.hash = '#/'; }; return b; })());
    const body = el.querySelector('.page-body');
    body.appendChild(h(`<div class="search-box">${icon('search')}<input placeholder="Поиск по чатам…"></div>`));
    const list = h('<div></div>');
    body.appendChild(list);
    const input = body.querySelector('input');
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const items = S.chats.filter(c => !q || (c.title || '').toLowerCase().includes(q));
      list.innerHTML = items.length ? '' : '<div class="empty">Ничего не найдено</div>';
      list.appendChild(h(`<div style="font-size:13px;color:var(--muted);margin-bottom:8px">Чатов: ${items.length}</div>`));
      items.forEach(c => {
        const p = c.projectId && S.projects.find(x => x.id === c.projectId);
        const row = h(`<div class="list-row"><div class="t"><div class="n">${esc(c.title || 'Без названия')}</div><div class="s">${p ? esc(p.name) + ' · ' : ''}${esc(ago(c.updatedAt))}</div></div>
          ${isRunning(c.id) ? '<span class="dot-run"></span>' : ''}<button class="icon-btn sm" data-m>${icon('dots')}</button></div>`);
        row.onclick = e => {
          if (e.target.closest('[data-m]')) { e.stopPropagation(); chatMenu(c, e.target.closest('[data-m]')); return; }
          location.hash = '#/chat/' + encodeURIComponent(c.id);
        };
        list.appendChild(row);
      });
    };
    input.oninput = draw;
    draw();
    S.pageRedraw = draw;
    setTimeout(() => input.focus(), 0);
    return el;
  }

  function projectsPage() {
    S.pageRedraw = () => { if (S.route.name === 'projects') renderView(); };
    const add = h(`<button class="btn primary">${icon('plus', 'style="width:15px;height:15px;vertical-align:-2px"')} Новый проект</button>`);
    add.onclick = newProject;
    const el = pageShell('Проекты', add);
    const body = el.querySelector('.page-body');
    if (!S.projects.length) { body.appendChild(h('<div class="empty">Проектов пока нет. Проект объединяет чаты, инструкции и файлы.</div>')); return el; }
    const grid = h('<div class="grid"></div>');
    S.projects.forEach(p => {
      const count = S.chats.filter(c => c.projectId === p.id).length;
      const card = h(`<div class="card"><div class="n">${esc(p.name)}</div><div class="d">${esc(p.description || (p.repo ? 'GitHub: ' + p.repo : 'Без описания'))}</div>
        <div class="s">${icon('chat', 'style="width:13px;height:13px"')} ${count} · ${esc(ago(p.createdAt))}</div></div>`);
      card.onclick = () => { location.hash = '#/project/' + encodeURIComponent(p.id); };
      grid.appendChild(card);
    });
    body.appendChild(grid);
    return el;
  }

  function newProject() {
    modal(`<h3>Новый проект</h3><input class="field" placeholder="Название" maxlength="80"><textarea class="field" placeholder="Описание (необязательно)"></textarea>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`, (bg, close) => {
      bg.querySelector('[data-x]').onclick = close;
      bg.querySelector('[data-ok]').onclick = async () => {
        const name = bg.querySelector('input').value.trim();
        if (!name) return;
        try {
          const res = await api('POST', '/api/projects', { name, description: bg.querySelector('textarea').value.trim() });
          close();
          location.hash = '#/project/' + encodeURIComponent(res.id);
        } catch (e) { toast(e.message); }
      };
    });
  }

  function projectPage(id) {
    const p = S.projects.find(x => x.id === id);
    if (!p) return pageShell('Проект не найден');
    $('#crumb').innerHTML = '<a href="#/projects" style="color:inherit;text-decoration:none">Проекты</a> /';
    $('#title').textContent = p.name;
    const el = pageShell(p.name);
    const body = el.querySelector('.page-body');
    if (p.description || p.repo) body.appendChild(h(`<p style="color:var(--text-2);margin:-8px 0 18px">${esc(p.description)}${p.repo ? `<br><span style="color:var(--muted);font-size:13px">GitHub: ${esc(p.repo)}</span>` : ''}</p>`));
    body.appendChild(composer({ projectId: id }));
    const listBox = h('<div></div>');
    body.appendChild(listBox);
    const draw = () => {
      const chats = S.chats.filter(c => c.projectId === id);
      listBox.innerHTML = '';
      listBox.appendChild(h(`<div class="sb-section" style="padding-left:6px">Чаты проекта: ${chats.length}</div>`));
      chats.forEach(c => {
        const row = h(`<div class="list-row"><div class="t"><div class="n">${esc(c.title || 'Без названия')}</div><div class="s">${esc(ago(c.updatedAt))}</div></div>${isRunning(c.id) ? '<span class="dot-run"></span>' : ''}</div>`);
        row.onclick = () => { location.hash = '#/chat/' + encodeURIComponent(c.id); };
        listBox.appendChild(row);
      });
    };
    draw();
    S.pageRedraw = draw;
    return el;
  }

  function artifactsPage() {
    const el = pageShell('Артефакты');
    const body = el.querySelector('.page-body');
    body.innerHTML = '<div class="empty">Загружаю…</div>';
    api('GET', '/api/artifacts').then(res => {
      const list = res.artifacts || [];
      body.innerHTML = '';
      if (!list.length) { body.appendChild(h('<div class="empty">Артефактов пока нет: Claude сохраняет сюда веб-страницы, SVG и большие блоки кода.</div>')); return; }
      body.appendChild(h(`<div class="search-box">${icon('search')}<input placeholder="Поиск артефактов…"></div>`));
      const grid = h('<div class="grid"></div>');
      body.appendChild(grid);
      const input = body.querySelector('input');
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        grid.innerHTML = '';
        list.filter(a => !q || a.title.toLowerCase().includes(q)).forEach(a => {
          const chat = S.chats.find(c => c.id === a.chatId);
          const card = h(`<div class="card"><div class="n">${esc(a.title)}</div><div class="d">${esc(chat ? chat.title : '')}</div>
            <div class="s">${icon('code', 'style="width:13px;height:13px"')} ${esc(a.language)} · версия ${a.version} · ${esc(ago(a.updatedAt))}</div></div>`);
          card.onclick = () => openArtifact(a.id);
          grid.appendChild(card);
        });
      };
      input.oninput = draw;
      draw();
    }).catch(e => { body.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; });
    return el;
  }

  async function showChatArtifacts(chatId, anchor) {
    let res;
    try { res = await api('GET', '/api/artifacts?chatId=' + encodeURIComponent(chatId)); } catch (e) { toast(e.message); return; }
    const list = res.artifacts || [];
    menu(anchor, list.length ? [{ header: 'Артефакты чата' }].concat(list.map(a => ({ label: a.title, sub: a.language + ' · версия ' + a.version, onClick: () => openArtifact(a.id) })))
      : [{ header: 'В этом чате нет артефактов' }], { alignRight: true });
  }

  // ------------------------------------------------------------ панель артефакта
  async function openArtifact(id) {
    let a;
    try { a = await api('GET', '/api/artifacts/' + encodeURIComponent(id)); } catch (e) { toast(e.message); return; }
    showPanel({ title: a.title, language: a.language, content: a.content, versions: a.versions || [], version: a.version });
  }

  function previewable(lang, content) {
    lang = (lang || '').toLowerCase();
    if (['html', 'htm', 'svg', 'xml', 'markdown', 'md', 'mermaid'].includes(lang)) return lang === 'xml' ? /^\s*<svg/i.test(content) : true;
    return /^\s*(<!doctype html|<html|<svg)/i.test(content);
  }

  function showPanel(doc) {
    S.panel = doc;
    const panel = $('#panel');
    panel.classList.remove('hidden');
    $('#resizer').classList.remove('hidden');
    const canPreview = previewable(doc.language, doc.content);
    let tab = canPreview ? 'preview' : 'code';
    panel.innerHTML = `
      <div class="ph">
        <span class="n">${esc(doc.title)}</span>
        ${doc.versions && doc.versions.length > 1 ? `<select class="ver-select">${doc.versions.map(v => `<option value="${v.version}"${v.version === doc.version ? ' selected' : ''}>Версия ${v.version}${v.note ? ' — ' + esc(v.note) : ''}</option>`).join('')}</select>` : ''}
        ${canPreview ? '<div class="tabs"><button data-tab="preview">Просмотр</button><button data-tab="code">Код</button></div>' : ''}
        <button class="icon-btn" data-copy title="Копировать">${icon('copy')}</button>
        <button class="icon-btn" data-dl title="Скачать">${icon('download')}</button>
        <button class="icon-btn" data-close title="Закрыть">${icon('x')}</button>
      </div>
      <div class="pb"></div>`;
    let content = doc.content;
    const pb = panel.querySelector('.pb');
    const draw = () => {
      panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
      pb.innerHTML = '';
      const lang = (doc.language || '').toLowerCase();
      if (tab === 'code') {
        const pre = h('<pre></pre>');
        pre.innerHTML = highlight(content, lang);
        pb.appendChild(pre);
      } else if (lang === 'markdown' || lang === 'md') {
        const md = h('<div class="md"></div>');
        md.innerHTML = markdown(content);
        enhance(md);
        pb.appendChild(md);
      } else {
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
        frame.srcdoc = /^\s*<svg/i.test(content) && !/<html/i.test(content)
          ? `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${content}</body></html>`
          : content;
        pb.appendChild(frame);
      }
    };
    panel.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
    panel.querySelector('[data-copy]').onclick = () => copy(content);
    panel.querySelector('[data-dl]').onclick = () => download(doc.title, doc.language, content);
    panel.querySelector('[data-close]').onclick = closePanel;
    const sel = panel.querySelector('.ver-select');
    if (sel) sel.onchange = () => { const v = doc.versions.find(x => String(x.version) === sel.value); if (v) { content = v.content; draw(); } };
    draw();
  }

  function closePanel() {
    S.panel = null;
    $('#panel').classList.add('hidden');
    $('#resizer').classList.add('hidden');
    $('#panel').innerHTML = '';
  }

  (function resizer() {
    const r = $('#resizer');
    r.addEventListener('mousedown', e => {
      e.preventDefault();
      const move = ev => {
        const w = Math.min(window.innerWidth * 0.7, Math.max(320, window.innerWidth - ev.clientX));
        document.documentElement.style.setProperty('--panel-w', w + 'px');
      };
      const frames = document.querySelectorAll('iframe');
      frames.forEach(f => { f.style.pointerEvents = 'none'; });
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        frames.forEach(f => { f.style.pointerEvents = ''; });
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  })();

  const EXT = { html: 'html', htm: 'html', svg: 'svg', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', kotlin: 'kt', java: 'java', css: 'css', json: 'json', markdown: 'md', md: 'md', bash: 'sh', sh: 'sh', shell: 'sh', yaml: 'yml', yml: 'yml', xml: 'xml', sql: 'sql', go: 'go', rust: 'rs', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', ruby: 'rb', swift: 'swift', jsx: 'jsx', tsx: 'tsx' };
  function download(title, lang, content) {
    const ext = EXT[(lang || '').toLowerCase()] || 'txt';
    const name = (title || 'artifact').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) + (title && /\.[a-z0-9]{1,5}$/i.test(title) ? '' : '.' + ext);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = h(`<a download="${esc(name)}" href="${url}"></a>`);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ------------------------------------------------------------ Markdown
  function markdown(src) {
    src = String(src || '').replace(/\r\n?/g, '\n');
    const blocks = [];
    // Блоки кода — первыми, чтобы их содержимое не разбиралось как Markdown
    src = src.replace(/(^|\n)([ \t]*)(```|~~~)[ \t]*([^\n`]*)\n([\s\S]*?)(?:\n[ \t]*\3[ \t]*(?=\n|$)|$)/g, (m, pre, indent, fence, info, code) => {
      blocks.push({ lang: info.trim().split(/\s+/)[0] || '', code: indent ? code.replace(new RegExp('^' + indent, 'gm'), '') : code });
      return pre + '\u0000' + (blocks.length - 1) + '\u0000';
    });
    const lines = src.split('\n');
    let out = '', i = 0;
    const isBlank = l => !l.trim();
    while (i < lines.length) {
      const line = lines[i];
      const code = line.match(/^\u0000(\d+)\u0000$/);
      if (code) { out += codeBlock(blocks[+code[1]]); i++; continue; }
      if (isBlank(line)) { i++; continue; }
      let m;
      if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += '<hr>'; i++; continue; }
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out += `<blockquote>${markdown(restore(buf.join('\n'), blocks))}</blockquote>`;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
        const head = cells(line);
        const aligns = cells(lines[i + 1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '');
        i += 2;
        let t = '<table><thead><tr>' + head.map((c, k) => `<th${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          t += '<tr>' + cells(lines[i]).map((c, k) => `<td${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(c)}</td>`).join('') + '</tr>';
          i++;
        }
        out += t + '</tbody></table>';
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        const res = list(lines, i, blocks);
        out += res.html; i = res.next;
        continue;
      }
      const buf = [];
      while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,6}\s|\s*>|\s*```|\u0000)/.test(lines[i]) &&
        !(buf.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      // Строка, которую не разобрали правила выше (например, «```» ещё печатается), — обычный текст
      if (!buf.length) { buf.push(lines[i]); i++; }
      out += `<p>${buf.map(inline).join('<br>')}</p>`;
    }
    return out;
  }

  function restore(text, blocks) {
    return text.replace(/\u0000(\d+)\u0000/g, (m, n) => '```' + blocks[+n].lang + '\n' + blocks[+n].code + '\n```');
  }

  function list(lines, start, blocks) {
    const indentOf = l => l.match(/^\s*/)[0].replace(/\t/g, '    ').length;
    const ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
    const base = indentOf(lines[start]);
    const ordered = /^\s*\d+[.)]/.test(lines[start]);
    const first = ordered ? parseInt(lines[start].trim(), 10) : 1;
    let html = ordered ? `<ol${first !== 1 ? ` start="${first}"` : ''}>` : '<ul>';
    let i = start;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        const next = lines[i + 1];
        if (next !== undefined && indentOf(next) === base && ITEM.test(next)) { i++; continue; }
        break;
      }
      const m = l.match(ITEM);
      // Другой вид списка (нумерованный после маркированного) — новый список
      if (!m || indentOf(l) !== base || /^\d/.test(m[1]) !== ordered) break;
      let item = m[2];
      const body = [];
      i++;
      while (i < lines.length) {
        const nl = lines[i];
        if (!nl.trim()) {
          const next = lines[i + 1];
          if (next !== undefined && next.trim() && indentOf(next) > base) { body.push(''); i++; continue; }
          break;
        }
        if (indentOf(nl) <= base && (ITEM.test(nl) || /^(#{1,6}\s|\s*>|\u0000)/.test(nl))) break;
        body.push(nl);
        i++;
      }
      let task = '';
      const tm = item.match(/^\[([ xX])\]\s+(.*)$/);
      if (tm) { task = `<input type="checkbox" class="task" disabled${tm[1] !== ' ' ? ' checked' : ''}>`; item = tm[2]; }
      const nested = body.length ? markdown(restore(body.map(b => b.slice(Math.min(indentOf(b), base + 2))).join('\n'), blocks)) : '';
      html += `<li>${task}${inline(item)}${nested}</li>`;
    }
    html += ordered ? '</ol>' : '</ul>';
    return { html, next: i };
  }

  function inline(text) {
    const codes = [];
    let s = String(text).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => { codes.push(code.trim() ? code.replace(/^ (.*) $/, '$1') : code); return '\u0001' + (codes.length - 1) + '\u0001'; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s.replace(/\u0001(\d+)\u0001/g, (m, n) => `<code>${esc(codes[+n])}</code>`);
  }

  function codeBlock(b) {
    const lang = (b.lang || '').toLowerCase();
    const open = previewable(lang, b.code) && b.code.length > 40;
    return `<div class="codeblock" data-lang="${esc(lang)}"><div class="ch"><span class="lang">${esc(lang || 'текст')}</span>
      ${open ? `<button data-act="open">${icon('open', 'style="width:14px;height:14px"')}Открыть</button>` : ''}
      <button data-act="dl">${icon('download', 'style="width:14px;height:14px"')}</button>
      <button data-act="copy">${icon('copy', 'style="width:14px;height:14px"')}Копировать</button></div>
      <pre><code>${highlight(b.code, lang)}</code></pre></div>`;
  }
  /** Кнопки блоков кода внутри отрисованного Markdown */
  function enhance(root) {
    root.querySelectorAll('.codeblock').forEach(cb => {
      // Подсветка только оборачивает текст в span — исходный код равен тексту блока
      const b = { lang: cb.dataset.lang, code: cb.querySelector('pre').textContent };
      cb.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          if (btn.dataset.act === 'copy') copy(b.code);
          else if (btn.dataset.act === 'dl') download('code', b.lang, b.code);
          else showPanel({ title: (b.lang || 'Код').toUpperCase() + ' — предпросмотр', language: b.lang, content: b.code, versions: [] });
        };
      });
    });
  }

  // Простая подсветка: строки, комментарии, числа, ключевые слова
  const KW = new Set(('abstract and as async await break case catch class const continue data def default del do elif else enum export extends ' +
    'false final finally fn for from fun function func go if impl import in interface is lambda let match module mut new nil none not null ' +
    'object or override package pass private protected pub public raise return self static struct super switch this throw throws true try type ' +
    'typeof undefined use val var void when where while with yield True False None').split(' '));
  function highlight(code, lang) {
    if (code.length > 60000 || ['', 'text', 'txt', 'markdown', 'md', 'plain'].includes(lang)) return esc(code);
    const re = /(\/\/[^\n]*|#(?![!\[{])[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    const hashComments = ['python', 'py', 'bash', 'sh', 'shell', 'yaml', 'yml', 'ruby', 'rb', 'toml', 'r', 'perl', 'dockerfile', 'makefile', 'ps1', 'powershell'].includes(lang);
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      last = re.lastIndex;
      if (m[1]) {
        if (m[1][0] === '#' && !hashComments) { out += esc(m[1].slice(0, 1)); re.lastIndex = m.index + 1; last = re.lastIndex; continue; }
        out += `<span class="tok-c">${esc(m[1])}</span>`;
      } else if (m[2]) out += `<span class="tok-s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="tok-n">${esc(m[3])}</span>`;
      else if (m[4]) out += KW.has(m[4]) ? `<span class="tok-k">${esc(m[4])}</span>` : esc(m[4]);
    }
    return out + esc(code.slice(last));
  }

  // ------------------------------------------------------------ старт
  // Узкое окно: боковая панель поверх чата, закрывается нажатием мимо неё
  let narrow = window.innerWidth <= 860;
  window.addEventListener('resize', () => {
    const now = window.innerWidth <= 860;
    if (now && !narrow) setCollapsed(true);
    narrow = now;
  });
  $('#main').addEventListener('mousedown', () => { if (narrow && !S.collapsed) setCollapsed(true); });
  if (narrow) S.collapsed = true;
  boot();
})();
