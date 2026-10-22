/*
 * Claude в браузере («Доступ с компьютера»). Страницу и API отдаёт приложение на телефоне:
 * /api/... — запросы с токеном (Authorization: Bearer), /api/events — поток событий (SSE).
 * Без библиотек: свой разбор Markdown, маршруты через #/…
 */
(function () {
  'use strict';

  // Внутренний экран складного телефона: приложение открывает эту страницу в своём WebView (мост ClaudeInner)
  // и передаёт токен после # (эта часть адреса не уходит на сервер) — сохраняем его и сразу убираем из адреса
  const INNER = !!window.ClaudeInner;
  (function () {
    const m = /^#inner=([0-9a-f]+)(?:\|(.*))?$/.exec(location.hash);
    if (!m) return;
    try { localStorage.setItem('token', m[1]); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search + (m[2] ? '#' + m[2] : ''));
  })();
  // Внутренний экран: в WebView нет распознавания и синтеза речи браузера и «Поделиться» — вместо них телефонные
  // (мост ClaudeInner; события распознавания и чтения приходят в window.__innerVoice)
  if (INNER) {
    const V = window.ClaudeInner;
    let cur = null, finals = [], utterances = {}, uid = 0;
    const item = (t, fin) => { const r = [{ transcript: t, confidence: 1 }]; r.isFinal = fin; return r; };
    class InnerRecognition {
      constructor() { this.lang = 'ru-RU'; this.continuous = false; this.interimResults = true; this.onresult = this.onerror = this.onend = null; }
      start() { if (cur && cur !== this) cur._end(); cur = this; finals = []; V.listenStart(!!this.continuous); }
      stop() { if (cur === this) V.listenStop(); }
      abort() { if (cur === this) { V.listenAbort(); this._err('aborted'); this._end(); } }
      _err(code) { if (this.onerror) this.onerror({ error: code }); }
      _end() { if (cur === this) cur = null; if (this.onend) this.onend(); }
    }
    // Всегда своё: в WebView webkitSpeechRecognition есть, но не работает (сразу «not-allowed», запись не останавливается)
    try { Object.defineProperty(window, 'SpeechRecognition', { value: InnerRecognition, configurable: true, writable: true }); } catch (e) { window.SpeechRecognition = InnerRecognition; }
    try { Object.defineProperty(window, 'webkitSpeechRecognition', { value: InnerRecognition, configurable: true, writable: true }); } catch (e) { window.webkitSpeechRecognition = InnerRecognition; }
    window.__innerVoice = (ev, data) => {
      if (ev === 'spoken' || ev === 'speakerror') {
        const u = utterances[data]; delete utterances[data];
        const f = u && (ev === 'spoken' ? u.onend : u.onerror);
        if (f) f({});
        return;
      }
      const r = cur;
      if (!r) return;
      if (ev === 'partial') { if (r.interimResults && r.onresult) r.onresult({ resultIndex: finals.length, results: finals.concat([item(data, false)]) }); }
      else if (ev === 'final') { finals.push(item(data, true)); if (r.onresult) r.onresult({ resultIndex: finals.length - 1, results: finals.slice() }); }
      else if (ev === 'error') r._err(data);
      else if (ev === 'end') r._end();
    };
    window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = 'ru-RU'; this.voice = null; this.onend = this.onerror = null; };
    const synth = {
      speak(u) { const id = 'u' + (++uid); utterances[id] = u; V.speak(id, String(u.text || '')); },
      cancel() { utterances = {}; V.stopSpeaking(); },
      getVoices() { return []; },
      speaking: false
    };
    try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true }); } catch (e) {}
    try { navigator.share = d => { V.share(String((d && d.title) || ''), String((d && (d.text || d.url)) || '')); return Promise.resolve(); }; } catch (e) {}
  }

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
  // Страница открыта через свой сервер-пересадку («Через свой сервер»): SSE там не проходит
  const RELAY = !!window.CLAUDE_RELAY;
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
    let el = $('.toast:not(.leaving)');
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

  // ------------------------------------------------------------ вибрация (тактильный отклик)
  // На телефоне — та же вибрация, что в приложении (мост ClaudeInner.haptic, настройка «Тактильный отклик»);
  // в мобильном браузере — navigator.vibrate; на компьютере — ничего.
  function haptic(kind) {
    try {
      if (INNER && window.ClaudeInner.haptic) { window.ClaudeInner.haptic(kind || 'click'); return; }
      if (navigator.vibrate && window.matchMedia && matchMedia('(hover: none)').matches) navigator.vibrate(kind === 'long' ? 25 : kind === 'send' || kind === 'confirm' ? 14 : 7);
    } catch (e) {}
  }
  // Нажатия на кнопки, пункты меню и чаты — лёгкий щелчок; «Отправить» — свой отклик
  document.addEventListener('click', e => {
    const el = e.target.closest('button, a.sb-link, .chat-item, [data-haptic]');
    if (el && !el.disabled) haptic(el.matches('[data-send]') ? 'send' : el.dataset.haptic || 'click');
  }, true);

  // ------------------------------------------------------------ плавное закрытие
  // Меню, окна, подсказки, просмотр картинок и выезжающие панели закрываются с анимацией: remove() ставит
  // класс .leaving (анимация в app.css) и убирает элемент после неё. Поиск открытых — с :not(.leaving).
  const ANIMATED = '.menu, .modal-bg, .toast, .lightbox, .cw-drawer, .cw-drawer-bg, .cw-voice';
  const LEAVE_MS = 200;
  const nativeRemove = Element.prototype.remove;
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  Element.prototype.remove = function () {
    if (!this.isConnected || this.classList.contains('leaving') || reducedMotion() || !this.matches(ANIMATED)) {
      if (!this.classList.contains('leaving') || !this.isConnected) nativeRemove.call(this);
      return;
    }
    this.classList.add('leaving');
    setTimeout(() => nativeRemove.call(this), LEAVE_MS);
  };
  /** Спрятать панель (класс hidden) после анимации закрытия */
  function hideAnimated(el, done) {
    if (el.classList.contains('hidden') || reducedMotion()) { el.classList.add('hidden'); done && done(); return; }
    if (el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    el._hide = setTimeout(() => { el._hide = null; el.classList.remove('leaving'); el.classList.add('hidden'); done && done(); }, LEAVE_MS);
  }
  /** Показать панель, отменив незаконченное закрытие */
  function showAnimated(el) {
    if (el._hide) { clearTimeout(el._hide); el._hide = null; }
    el.classList.remove('leaving', 'hidden');
  }

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
        <div class="small">${REMOTE || RELAY ? 'Подключение через интернет: телефон может быть в любой сети.' : 'Телефон и компьютер должны быть в одной сети Wi-Fi.'} На телефоне: «Настройки» → «Доступ с компьютера».</div>
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
    // Внутренний экран не подключают кодом: приложение откроет страницу заново с новым токеном
    if (INNER) { stopUpdates(); window.ClaudeInner.reconnect(); return; }
    S.token = ''; save('token', '');
    stopUpdates();
    showPair(silent ? 'Доступ этого компьютера отозван на телефоне — подключитесь заново.' : '');
  }

  // ------------------------------------------------------------ запуск
  async function boot() {
    clearTimeout(offlineTimer);
    if (REMOTE && !BASE) {
      const found = await resolveBase();
      if (found !== true) { showOffline(found); return; }
    }
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
    startUpdates();
    route();
  }

  function applyState(st) {
    S.info = st;
    S.settings = st.settings || {};
    if (st.chats) S.chats = st.chats;
    if (st.projects) S.projects = st.projects;
    if (st.running) S.running = new Set(st.running);
    $('#phone-name').textContent = st.phone || 'Телефон';
    applyMode();
  }

  // ------------------------------------------------------------ Чат / Код (как переключатель claude.ai)
  // «Код» — режим Claude Code (настройка codeMode): Claude работает с файлами проекта, командами и GitHub.
  function mode() { return S.settings && S.settings.codeMode ? 'code' : 'chat'; }
  function applyMode() {
    const m = mode();
    document.body.classList.toggle('mode-code', m === 'code');
    $('#brand').textContent = m === 'code' ? 'Claude Code' : 'Claude';
    $('#new-label').textContent = m === 'code' ? 'Создать' : 'Новый чат';
    document.querySelectorAll('#mode-switch [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    document.querySelectorAll('[data-only]').forEach(el => el.classList.toggle('hidden', el.dataset.only !== m));
  }
  document.querySelectorAll('#mode-switch [data-mode]').forEach(b => {
    b.onclick = () => {
      if (b.dataset.mode === mode()) return;
      setSetting({ codeMode: b.dataset.mode === 'code' });
      applyMode();
      if (S.route.name !== 'chat') renderView();
    };
  });

  function onHello(st) {
    setOnline(true);
    applyState(st);
    HOOKS.hello.forEach(f => { try { f(st); } catch (e) {} });
    renderSidebar();
    renderComposerState();
    if (S.route.name === 'chat') reloadChat(); else if (S.pageRedraw) S.pageRedraw();
  }

  // ------------------------------------------------------------ обновления с телефона
  // В сети Wi-Fi — поток событий (SSE). Через туннель Cloudflare SSE не проходит (ограничение бесплатных туннелей),
  // поэтому там — долгий опрос /api/poll: телефон отвечает, как только что-то изменилось.
  let pollCtrl = null;
  let sseErrors = 0;
  function startUpdates() {
    stopUpdates();
    if (REMOTE || RELAY || S.forcePoll) pollLoop(); else connectEvents();
  }

  function stopUpdates() {
    if (events) { events.close(); events = null; }
    if (pollCtrl) { pollCtrl.abort(); pollCtrl = null; }
  }

  function connectEvents() {
    let opened = false;
    events = new EventSource(BASE + '/api/events?token=' + encodeURIComponent(S.token));
    events.addEventListener('hello', e => onHello(JSON.parse(e.data)));
    events.addEventListener('chats', e => onChats(JSON.parse(e.data)));
    events.addEventListener('live', e => onLive(JSON.parse(e.data)));
    events.addEventListener('questions', e => onQuestions(JSON.parse(e.data)));
    events.addEventListener('revoked', () => logout(true));
    events.onopen = () => { opened = true; sseErrors = 0; setOnline(true); };
    events.onerror = () => {
      setOnline(false);
      // Поток не открывается (его режет антивирус или прокси) — переходим на опрос
      if (!opened && ++sseErrors >= 3) { S.forcePoll = true; startUpdates(); return; }
      // Токен отозван — EventSource сам этого не скажет: проверяем обычным запросом
      fetch(BASE + '/api/state', { headers: { Authorization: 'Bearer ' + S.token } })
        .then(r => { if (r.status === 401) logout(true); })
        .catch(() => {});
    };
  }

  async function pollLoop() {
    const ctrl = new AbortController();
    pollCtrl = ctrl;
    let keys = {};
    let fails = 0;
    while (pollCtrl === ctrl) {
      try {
        const r = await fetch(BASE + '/api/poll?' + new URLSearchParams(keys).toString(), {
          headers: { Authorization: 'Bearer ' + S.token }, signal: ctrl.signal, cache: 'no-store'
        });
        if (r.status === 401) { logout(true); return; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (pollCtrl !== ctrl) return;
        fails = 0;
        setOnline(true);
        if (d.revoked) { logout(true); return; }
        keys = d.keys || {};
        if (d.hello) onHello(d.hello);
        if (d.chats) onChats(d.chats);
        if (d.live) onLive(d.live);
        if (d.questions) onQuestions(d.questions);
      } catch (e) {
        if (ctrl.signal.aborted || pollCtrl !== ctrl) return;
        fails++;
        setOnline(false);
        // Через интернет: туннель мог перезапуститься с новым адресом
        if (REMOTE && fails >= 2) {
          const old = BASE;
          if (await resolveBase() === true && BASE !== old) keys = {};
        }
        await new Promise(res => setTimeout(res, Math.min(10000, 1000 * fails)));
      }
    }
  }

  // ------------------------------------------------------------ доступ из интернета
  /**
   * Текущий адрес туннеля: GitHub API (сразу после изменения), запасной путь — копия на Pages (если API исчерпал
   * лимит 60 запросов в час). true — телефон отвечает; иначе причина: 'off' — доступ выключен, 'noanswer' — адрес
   * есть, но телефон не отвечает, 'nolink' — не удалось узнать адрес.
   */
  async function resolveBase() {
    const sources = [
      () => fetch(`https://api.github.com/repos/${REMOTE.repo}/contents/connect/tunnel.json?ref=${encodeURIComponent(REMOTE.branch || 'main')}`,
        { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }),
      () => fetch('tunnel.json?ts=' + Date.now(), { cache: 'no-store' })
    ];
    let reason = 'nolink';
    const tried = new Set();
    for (const get of sources) {
      let info;
      try { const r = await get(); if (!r.ok) continue; info = await r.json(); } catch (e) { continue; }
      const url = String(info.url || '').replace(/\/+$/, '');
      if (!url) { if (reason === 'nolink') reason = 'off'; continue; }
      if (!/^https:\/\/[a-z0-9.-]+$/i.test(url) || tried.has(url)) continue;
      tried.add(url);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const ping = await fetch(url + '/api/ping', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (ping.ok) { BASE = url; return true; }
      } catch (e) { /* не отвечает */ }
      reason = 'noanswer';
    }
    return reason;
  }

  let offlineTimer = null;
  let offlineTries = 0;
  function showOffline(reason) {
    stopUpdates();
    app.classList.add('hidden');
    const el = $('#pair');
    el.classList.remove('hidden');
    const text = reason === 'off'
      ? 'На телефоне выключен «Через интернет». Включите: «Настройки» → «Доступ с компьютера» → «Через интернет».'
      : reason === 'noanswer'
        ? 'Адрес телефона известен, но телефон не отвечает. Проверьте, что на телефоне есть интернет и приложение Claude не закрыто. На телефоне нажмите «Проверить подключение».'
        : 'Не удалось узнать адрес телефона (нет связи с GitHub). Проверьте интернет на компьютере.';
    el.innerHTML = `
      <div class="pair-card">
        <div class="logo">${LOGO}</div>
        <h1>Телефон не в сети</h1>
        <p>${esc(text)}</p>
        <button class="btn accent" id="retry">Проверить снова</button>
        <div class="small">Страница проверяет сама каждые ${offlineTries < 8 ? 15 : 60} секунд.</div>
      </div>`;
    $('#retry').onclick = () => { $('#retry').textContent = 'Проверяю…'; boot(); };
    clearTimeout(offlineTimer);
    offlineTries++;
    // Реже после 2 минут: GitHub API разрешает 60 запросов в час
    offlineTimer = setTimeout(boot, offlineTries < 8 ? 15000 : 60000);
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
    S.suggestions = data.suggestions || {};
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
      renderPlan();
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
    else if (PAGES[name]) S.route = { name, id: id ? decodeURIComponent(hash.slice(name.length + 1)) : '' };
    else S.route = { name: 'home' };
    if (S.route.name !== 'chat') S.chat = null;
    if (window.innerWidth <= 860) setCollapsed(true);
    renderSidebar();
    renderView();
    // Новая страница проявляется плавно
    const view = $('#view');
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
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
      case 'artifacts': view.appendChild(PAGES.artifacts ? PAGES.artifacts.render('') : artifactsPage()); break;
      default:
        if (PAGES[S.route.name]) {
          try { const page = PAGES[S.route.name].render(S.route.id || ''); if (page) view.appendChild(page); }
          catch (e) { view.appendChild(h(`<div class="scroll"><div class="column page"><div class="err-box">${esc(e.message)}</div></div></div>`)); }
        } else view.appendChild(homePage());
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
      title.title = 'Действия с чатом';
      title.onclick = e => c && chatMenu(c, e.currentTarget);
      menu.classList.remove('hidden');
      menu.onclick = e => c && chatMenu(c, title);
      arts.classList.remove('hidden');
      arts.onclick = () => showChatArtifacts(S.route.id, arts);
    } else {
      title.textContent = PAGES[S.route.name] ? (PAGES[S.route.name].title || '') : '';
    }
    $('#info-btn').classList.toggle('hidden', S.route.name !== 'chat');
    $('#info-btn').classList.toggle('on', S.route.name === 'chat' && S.infoOpen);
    renderInfo();
    const extra = $('#topbar-extra');
    if (extra) {
      extra.innerHTML = '';
      HOOKS.topbar.forEach(f => { try { const b = f(S.route); if (b) extra.appendChild(b); } catch (e) {} });
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
  $('#sb-scrim').onclick = () => setCollapsed(true);
  // Страница никогда не прокручивается целиком (только свои области): иначе выезжающая панель
  // или клавиатура сдвигали весь экран вбок и вниз
  window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });

  // Внутренний экран телефона: вместо «Телефон · Подключено» (это для компьютера) — кнопка «Доступ с ПК»,
  // как внизу бокового меню приложения: нажатие включает и выключает «Через свой сервер»
  if (INNER && window.ClaudeInner.relayState) {
    const V = window.ClaudeInner;
    const phone = $('.sb-foot .phone');
    const btn = h(`<button class="relay-pill" title="Нажмите — включить или выключить доступ с компьютера через свой сервер. Долгое нажатие — настройки доступа">
      <svg class="i"><use href="#i-phone"/></svg><span class="rp-t">Доступ с ПК</span><span class="rp-dot"></span></button>`);
    // Строку не удаляем — в неё пишут applyState и setOnline; только прячем
    phone.classList.add('hidden');
    phone.before(btn);
    const draw = () => {
      let st = {};
      try { st = JSON.parse(V.relayState() || '{}'); } catch (e) {}
      const status = st.on ? (st.status || 'connecting') : 'off';
      btn.dataset.status = status;
      btn.querySelector('.rp-t').textContent = status === 'online' ? 'Доступ с ПК: вкл' : status === 'connecting' ? 'Подключаюсь…' : status === 'error' ? 'Ошибка доступа' : 'Доступ с ПК';
      btn.title = status === 'error' && st.message ? st.message : btn.title;
    };
    let pressTimer = null, long = false;
    btn.addEventListener('pointerdown', () => { long = false; pressTimer = setTimeout(() => { long = true; haptic('long'); V.openRelaySettings(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => clearTimeout(pressTimer)));
    btn.onclick = () => { if (long) return; V.toggleRelay(); setTimeout(draw, 150); };
    draw();
    setInterval(() => { if (!document.hidden) draw(); }, 1500);
  }

  // ------------------------------------------------------------ свайпы (сенсорный экран)
  // Как в приложении: провели вправо — открылось левое меню, влево — закрылось; в чате влево — правая панель
  // (Среда · Контекст · Задачи), вправо — закрылась; вправо закрывает и панель «Сессия». Когда меню или
  // панель лежат поверх страницы, они идут за пальцем. Свайп не начинается в полях ввода, коде, таблицах
  // и других местах с горизонтальной прокруткой.
  (function swipes() {
    const sb = $('#sidebar'), info = $('#info');
    const sbOverlay = () => window.innerWidth <= 860;
    const infoOverlay = () => window.innerWidth <= 1100;
    const infoShown = () => !info.classList.contains('hidden') && !info.classList.contains('leaving');
    let t = null;

    function blocked(el) {
      for (; el && el !== document.body; el = el.parentElement) {
        if (el.matches('input, textarea, select, iframe, pre, .menu, .modal-bg, .lightbox, .cw-voice, [contenteditable="true"]')) return true;
        if (el.scrollWidth > el.clientWidth + 2) {
          const ox = getComputedStyle(el).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
      }
      return false;
    }

    // Левое меню: открыть (opening) или закрыть
    function sidebarGesture(opening) {
      // ширина + отступ от края: закрытое меню уезжает за экран целиком вместе с тенью
      const w = (sb.offsetWidth || 288) + 24;
      const follow = sbOverlay();
      return {
        begin() { if (follow) app.classList.add('sb-drag'); },
        move(dx) {
          if (!follow) return;
          const off = Math.max(-w, Math.min(0, opening ? -w + dx : dx));
          sb.style.transform = `translateX(${off}px)`;
          $('#sb-scrim').style.opacity = String(1 + off / w);
        },
        end(dx, v) {
          const open = opening ? (dx > w * 0.3 || v > 0.35) : !(-dx > w * 0.3 || v < -0.35);
          // Снимаем «перетаскивание» и сдвиг пальца в одном кадре — дальше меню доезжает плавной анимацией
          app.classList.remove('sb-drag');
          sb.style.transform = '';
          $('#sb-scrim').style.opacity = '';
          if (open !== !S.collapsed) { setCollapsed(!open); haptic('tick'); }
        }
      };
    }

    // Правая панель чата
    function infoGesture(opening) {
      const follow = infoOverlay();
      let w = 300;
      return {
        begin() {
          // Панель ведёт палец — своя анимация появления не нужна (иначе после отпускания она проигрывалась
          // ещё раз: панель «открывалась дважды» со скачком); вернётся, когда панель снова скроется
          info.classList.add('no-enter');
          if (opening) { S.infoOpen = true; renderInfo(); }
          // ширина + отступ от края: закрытая панель уезжает за экран целиком вместе с тенью
          w = (info.offsetWidth || 300) + 24;
          if (follow) { info.classList.add('drag'); info.style.transform = opening ? `translateX(${w}px)` : ''; }
        },
        move(dx) {
          if (!follow) return;
          info.style.transform = `translateX(${Math.max(0, Math.min(w, opening ? w + dx : dx))}px)`;
        },
        end(dx, v) {
          const open = opening ? (-dx > w * 0.3 || v < -0.35) : !(dx > w * 0.3 || v > 0.35);
          if (follow) {
            info.classList.remove('drag');
            info.style.transition = 'transform .22s cubic-bezier(.2,0,0,1)';
            info.style.transform = open ? 'translateX(0)' : `translateX(${w}px)`;
            setTimeout(() => {
              info.style.transition = ''; info.style.transform = '';
              if (!open) { S.infoOpen = false; save('info', '0'); info.classList.add('hidden'); renderInfo(); }
              else save('info', '1');
            }, 230);
          } else if (open !== S.infoOpen) {
            S.infoOpen = open; save('info', open ? '1' : '0'); renderInfo();
          } else if (!open) renderInfo();
          // Жест удался (панель открылась или закрылась, как просили) — лёгкий отклик
          if (open === opening) haptic('tick');
        }
      };
    }

    // Панель «Сессия» (mod-chat) — закрыть свайпом вправо
    // Панель идёт за пальцем, затемнение светлеет вместе с ней; отпустили — панель плавно доезжает за край
    // (или назад) и только потом закрывается, без второй анимации и скачка (3.12.22)
    function drawerGesture(el) {
      const bg = $('.cw-drawer-bg:not(.leaving)');
      let w = 400;
      return {
        begin() {
          w = el.offsetWidth + 24;
          el.style.transition = 'none'; el.style.animation = 'none'; el.style.willChange = 'transform';
          if (bg) { bg.style.transition = 'none'; bg.style.animation = 'none'; }
        },
        move(dx) {
          const x = Math.max(0, Math.min(w, dx));
          el.style.transform = `translateX(${x}px)`;
          if (bg) bg.style.opacity = String(1 - x / w);
        },
        end(dx, v) {
          const close = dx > el.offsetWidth * 0.3 || v > 0.35;
          const ease = 'cubic-bezier(.2,0,0,1)';
          el.style.transition = `transform .22s ${ease}`;
          el.style.transform = close ? `translateX(${w}px)` : '';
          if (bg) { bg.style.transition = `opacity .22s ${ease}`; bg.style.opacity = close ? '0' : ''; }
          setTimeout(() => {
            if (!close) { el.style.transition = ''; el.style.willChange = ''; if (bg) bg.style.transition = ''; return; }
            haptic('tick');
            // уже за краем: убрать сразу, без анимации закрытия
            el.style.visibility = 'hidden';
            if (bg) bg.style.visibility = 'hidden';
            const x = el.querySelector('[data-x]');
            if (x) x.click(); else el.remove();
          }, 230);
        }
      };
    }

    function pick(dir) {
      const drawer = $('.cw-drawer:not(.leaving)');
      if (drawer) return dir === 'right' ? drawerGesture(drawer) : null;
      if ($('.modal-bg:not(.leaving)')) return null;
      if (dir === 'right') {
        if (S.route.name === 'chat' && infoShown()) return infoGesture(false);
        if (S.collapsed) return sidebarGesture(true);
        return null;
      }
      if (!S.collapsed) return sidebarGesture(false);
      if (S.route.name === 'chat' && S.chat && !infoShown()) return infoGesture(true);
      return null;
    }

    document.addEventListener('touchstart', e => {
      t = null;
      if (e.touches.length !== 1 || app.classList.contains('hidden') || blocked(e.target)) return;
      const p = e.touches[0];
      t = { x: p.clientX, y: p.clientY, at: Date.now(), dir: null, g: null, dx: 0, lx: p.clientX, lt: Date.now(), v: 0 };
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (!t) return;
      // Жест наш — страница не должна ни прокручиваться, ни сдвигаться вслед за пальцем
      if (t.g && e.cancelable) e.preventDefault();
      const p = e.touches[0], dx = p.clientX - t.x, dy = p.clientY - t.y;
      if (!t.dir) {
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.4) { t = null; return; }
        t.dir = dx > 0 ? 'right' : 'left';
        t.g = pick(t.dir);
        if (!t.g) { t = null; return; }
        t.g.begin();
      }
      const now = Date.now();
      if (now > t.lt) { t.v = (p.clientX - t.lx) / (now - t.lt); t.lx = p.clientX; t.lt = now; }
      t.dx = dx;
      // Не чаще одного раза за кадр экрана — без лишней работы и рывков
      if (!t.raf) t.raf = requestAnimationFrame(() => { if (t && t.g) { t.raf = 0; t.g.move(t.dx); } });
    }, { passive: false });
    const finish = () => { if (t && t.raf) cancelAnimationFrame(t.raf); if (t && t.g) t.g.end(t.dx, t.v); t = null; };
    document.addEventListener('touchend', finish, { passive: true });
    document.addEventListener('touchcancel', finish, { passive: true });
  })();
  $('#new-chat').onclick = () => { goHome(); setTimeout(() => focusSoft($('#view textarea')), 30); };
  $('#new-chat-2').onclick = () => $('#new-chat').click();

  // Проект, как в боковом меню приложения: новые чаты создаются в нём, в «Недавних» — его чаты.
  // Выбор общий с телефоном (активный проект приложения, /api/work/projects/<id>/activate).
  function currentProject() { return S.homeProject ? S.projects.find(p => p.id === S.homeProject) || null : null; }
  function selectProject(id) {
    const prev = S.homeProject;
    S.homeProject = id || null;
    save('homeProject', id || '');
    if (id) api('POST', `/api/work/projects/${encodeURIComponent(id)}/activate`, { on: true }).catch(() => {});
    else if (prev) api('POST', `/api/work/projects/${encodeURIComponent(prev)}/activate`, { on: false }).catch(() => {});
    renderSidebar();
    goHome();
  }
  $('#sb-project').onclick = e => {
    const cur = S.homeProject;
    const items = [{ label: 'Без проекта', sub: 'Общая папка', checked: !cur, onClick: () => selectProject(null) }];
    S.projects.forEach(p => items.push({ label: p.name, sub: p.description || '', checked: cur === p.id, onClick: () => selectProject(p.id) }));
    items.push({ sep: true }, { label: 'Все проекты', onClick: () => { location.hash = '#/projects'; } });
    menu(e.currentTarget, items);
  };
  // Активный проект телефона — при запуске страницы (если в этом браузере ещё не выбран)
  setTimeout(() => {
    if (load('homeProject') || !S.token) return;
    api('GET', '/api/work/projects/repo').then(r => {
      if (r && r.activeProjectId && !S.homeProject) { S.homeProject = r.activeProjectId; renderSidebar(); }
    }).catch(() => {});
  }, 1500);
  if (load('homeProject')) S.homeProject = load('homeProject');
  $('#sb-search').addEventListener('input', e => { S.sbQuery = e.target.value.trim().toLowerCase(); renderSidebar(); });
  $('#sb-search').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; S.sbQuery = ''; renderSidebar(); e.target.blur(); } });
  $('#info-btn').onclick = () => { S.infoOpen = !S.infoOpen; save('info', S.infoOpen ? '1' : '0'); renderInfo(); };
  $('#settings-btn').onclick = e => settingsMenu(e.currentTarget);

  function renderSidebar() {
    renderNavExtra();
    const proj = currentProject();
    if (S.homeProject && S.projects.length && !proj) S.homeProject = null;
    $('#sb-project-name').textContent = proj ? proj.name : 'Без проекта';
    const head = $('.sb-recent-head span');
    if (head) head.textContent = proj ? 'Чаты проекта' : 'Недавние';
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
    let html = '';
    if (S.sbQuery) {
      const found = S.chats.filter(c => (c.title || '').toLowerCase().includes(S.sbQuery));
      html = found.length ? found.slice(0, 100).map(item).join('') : '<div class="sb-section" style="padding-top:4px">Ничего не найдено</div>';
    } else {
      const inProject = S.chats.filter(c => (c.projectId || null) === (S.homeProject || null) || !S.homeProject);
      const starred = inProject.filter(c => c.starred);
      const recent = inProject.filter(c => !c.starred).slice(0, 60);
      if (starred.length) html += '<div class="sb-section">Избранные</div>' + starred.map(item).join('') + '<div class="sb-section">Остальные</div>';
      html += recent.length ? recent.map(item).join('') : `<div class="sb-section" style="padding-top:4px">${S.homeProject ? 'В этом проекте пока нет чатов' : 'Чатов пока нет'}</div>`;
    }
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
  function closeMenus() { document.querySelectorAll('.menu:not(.leaving)').forEach(m => m.remove()); }
  document.addEventListener('mousedown', e => { if (!e.target.closest('.menu')) closeMenus(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const lb = $('.lightbox:not(.leaving)'), mb = $('.modal-bg:not(.leaving)');
      if (lb) { lb.remove(); return; }
      if ($('.menu:not(.leaving)')) { closeMenus(); return; }
      if (mb) { mb.remove(); return; }
      if (S.panel) { closePanel(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); location.hash = '#/chats'; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#new-chat').click(); }
  });

  /** items: { label, sub, onClick, danger, checked, sep, header } */
  function menu(anchor, items, opts) {
    closeMenus();
    const el = h(`<div class="menu${opts && opts.cls ? ' ' + opts.cls : ''}"></div>`);
    if (opts && opts.minWidth) el.style.minWidth = Math.min(opts.minWidth, window.innerWidth - 16) + 'px';
    items.forEach(it => {
      if (it.sep) { el.appendChild(h('<div class="sep"></div>')); return; }
      if (it.header) { el.appendChild(h(`<div class="mh">${esc(it.header)}</div>`)); return; }
      const b = h(`<button class="mi${it.danger ? ' danger' : ''}">
          ${it.checked !== undefined ? `<span class="ck">${it.checked ? icon('check') : ''}</span>` : ''}
          <span style="flex:1;min-width:0"><div>${esc(it.label)}${it.badge ? ` <span class="mi-badge">${esc(it.badge)}</span>` : ''}</div>${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ''}</span>
          ${it.key ? `<span class="mi-key">${esc(it.key)}</span>` : ''}
        </button>`);
      if (it.key) b.dataset.key = it.key;
      b.onclick = () => { closeMenus(); it.onClick && it.onClick(); };
      el.appendChild(b);
    });
    document.body.appendChild(el);
    // Цифры на клавиатуре выбирают пункт с подсказкой (как меню «Режим» в Claude Code)
    if (items.some(it => it.key)) {
      const onKey = e => {
        if (!document.body.contains(el)) { document.removeEventListener('keydown', onKey, true); return; }
        const b = el.querySelector(`[data-key="${e.key}"]`);
        if (b) { e.preventDefault(); e.stopPropagation(); document.removeEventListener('keydown', onKey, true); b.click(); }
      };
      document.addEventListener('keydown', onKey, true);
    }
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

  /* Клавиатура не выскакивает сама (3.12.17): на сенсорном экране поле ввода получает фокус только от нажатия
     пальцем. focusSoft — для автоматического фокуса при появлении окна или страницы: на компьютере ставит курсор,
     на телефоне ничего не делает. */
  const TOUCH = INNER || matchMedia('(hover: none), (pointer: coarse)').matches;
  function focusSoft(el, selectAll) {
    if (!el || TOUCH) return;
    const was = document.activeElement === el;
    el.focus();
    if (selectAll && el.select) el.select();
    else if (!was && el.setSelectionRange && typeof el.value === 'string') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  }

  /* Свои выпадающие списки (3.12.17): системный <select> на телефоне открывает белое окно вверху экрана, которое
     прыгает на место и не в цвет темы. Каждый <select> страницы прячется (.cs-native), рядом — кнопка .cs-btn
     с теми же классами; нажатие открывает обычное меню страницы (стекло, анимация). Значение и события
     input/change — у самого <select>, поэтому код разделов работает с ним как раньше. */
  ['value', 'selectedIndex'].forEach(k => {
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, k);
    Object.defineProperty(HTMLSelectElement.prototype, k, {
      configurable: true, enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, v); if (this._cs) this._cs(); }
    });
  });
  function enhanceSelect(sel) {
    if (sel._cs || sel.multiple || sel.size > 1 || sel.classList.contains('native')) return;
    const b = h(`<button type="button" class="cs-btn ${esc(sel.className)}"><span class="cs-t"></span>${icon('down', 'class="i cs-i"')}</button>`);
    if (sel.getAttribute('style')) b.setAttribute('style', sel.getAttribute('style'));
    const t = b.querySelector('.cs-t');
    sel._cs = () => {
      const o = sel.options[sel.selectedIndex];
      t.textContent = o ? o.textContent : '';
      b.disabled = sel.disabled;
      b.title = sel.title || '';
      b.hidden = sel.hidden || sel.style.display === 'none';
    };
    sel.classList.add('cs-native');
    sel.after(b);
    sel._cs();
    new MutationObserver(() => sel._cs()).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'style', 'hidden', 'title', 'selected'] });
    let open = null, wasOpen = false;
    b.addEventListener('mousedown', () => { wasOpen = !!(open && open.isConnected && !open.classList.contains('leaving')); });
    b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      if (wasOpen) { wasOpen = false; closeMenus(); return; }
      const items = [];
      [...sel.children].forEach(n => {
        const add = o => {
          if (o.hidden) return;
          const i = o.index;
          items.push({ label: o.textContent, checked: i === sel.selectedIndex, onClick: o.disabled ? null : () => {
            if (i === sel.selectedIndex) return;
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } });
        };
        if (n.tagName === 'OPTGROUP') { items.push({ header: n.label }); [...n.children].forEach(add); }
        else if (n.tagName === 'OPTION') add(n);
      });
      open = menu(b, items, { minWidth: b.offsetWidth, cls: 'cs-menu' });
      const cur = open.querySelector('.ck svg');
      if (cur) cur.closest('.mi').scrollIntoView({ block: 'nearest' });
    };
  }
  function enhanceSelects(root) {
    if (root.tagName === 'SELECT') enhanceSelect(root);
    else if (root.querySelectorAll) root.querySelectorAll('select').forEach(enhanceSelect);
  }
  enhanceSelects(document.body);
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && enhanceSelects(n))))
    .observe(document.body, { childList: true, subtree: true });

  function modal(html, onReady) {
    const bg = h(`<div class="modal-bg"><div class="modal">${html}</div></div>`);
    // Открытое окно на телефоне убирает клавиатуру, если она осталась от поля под окном
    if (TOUCH && document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
    const close = () => bg.remove();
    onReady && onReady(bg, close);
    focusSoft(bg.querySelector('input,textarea'), true);
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
    HOOKS.chatMenu.forEach(f => { try { (f(c) || []).forEach(it => items.push(it)); } catch (e) {} });
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
    HOOKS.settingsMenu.forEach(f => { try { (f() || []).forEach(it => items.push(it)); } catch (e) {} });
    // Внутренний экран телефона: вместо отключения компьютера — переход к обычному виду приложения
    if (INNER) {
      items.push({ sep: true }, {
        label: 'Вид телефона', sub: `Обычное приложение на большом экране · Claude ${S.info.version} (сборка ${S.info.build})`,
        onClick: () => window.ClaudeInner.phoneView()
      });
      menu(anchor, items, { above: true });
      return;
    }
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
    // На внутреннем экране «Как в системе» запоминается явно — иначе страница возьмёт тему из настроек приложения
    save('theme', id === 'system' ? (INNER ? 'system' : '') : id);
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
    col.appendChild(composer({ projectId: projectId || S.homeProject || null }));
    const chips = h(`<div class="chips"></div>`);
    [['code', 'Код', 'Напиши'], ['bulb', 'Объясни', 'Объясни простыми словами: '], ['globe', 'Найди в интернете', 'Найди в интернете и кратко перескажи: '], ['edit', 'Помоги написать', 'Помоги написать ']]
      .forEach(([ic, label, text]) => {
        const b = h(`<button class="chip">${icon(ic)}${esc(label)}</button>`);
        b.onclick = () => { const t = col.querySelector('textarea'); t.value = text + (text.endsWith(' ') ? '' : ' '); focusSoft(t); t.dispatchEvent(new Event('input')); };
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
          <div class="suggest hidden"><button class="sg-text" title="Вставить в поле"></button><button class="sg-send" title="Отправить">${icon('chev')}</button></div>
          <textarea rows="1" placeholder="${mode() === 'code' ? 'Enter — отправить, Ctrl+Enter — добавить в очередь' : opts.chatId ? 'Ответить Claude…' : 'Чем могу помочь?'}"></textarea>
          <div class="c-row">
            <button class="c-btn" data-attach title="Прикрепить файлы">${icon('clip')}</button>
            <button class="c-btn" data-tools title="Режимы">${icon('tools')}</button>
            <span class="modes" style="display:flex;gap:6px"></span>
            <div class="spacer"></div>
            <button class="c-btn model-btn" data-model title="Модель"><span></span>${icon('down', 'style="width:14px;height:14px"')}</button>
            <button class="send" data-send title="Отправить">${icon('up')}</button>
          </div>
        </div>
        <div class="c-foot">
          <button class="cf-btn cf-repo" data-repo title="С чем работать: проект, репозиторий и ветка"></button>
          <button class="cf-btn" data-perm title="Режим разрешений — нажмите, чтобы сменить (Shift+Tab)"></button>
          <span class="cf-note">${opts.chatId ? 'Claude может ошибаться. Проверяйте важное.' : ''}</span>
          <div class="spacer"></div>
          <button class="cf-btn" data-model2 title="Модель и глубина ответа"></button>
          <button class="cf-ring" data-ring title="Контекст — открыть панель"></button>
        </div>
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
    wrap._update = () => { updateSend(); renderModes(wrap); renderFiles(wrap); renderSuggestion(); renderFoot(); };
    // Нижняя строка в режиме «Код» (как Claude Code): разрешения слева, модель и контекст справа
    const repoBtn = wrap.querySelector('[data-repo]');
    const perm = wrap.querySelector('[data-perm]'), model2 = wrap.querySelector('[data-model2]'), ring = wrap.querySelector('[data-ring]');
    function renderFoot() {
      const code = mode() === 'code';
      repoBtn.classList.toggle('hidden', !code);
      if (code) repoBtn.innerHTML = S.linking ? `<span class="spin-sm"></span>${esc(S.linking)}` : placeLabel(placeProject(opts));
      ta.placeholder = code ? 'Enter — отправить, Ctrl+Enter — добавить в очередь' : opts.chatId ? 'Ответить Claude…' : 'Чем могу помочь?';
      perm.innerHTML = esc(modeTitle()) + icon('down');
      const depth = (S.info.depths || []).find(d => d.id === S.settings.depth);
      model2.textContent = shortModel(S.settings.model) + (depth ? ' · ' + depth.title : '');
      model2.classList.toggle('hidden', !code);
      const frac = opts.chatId ? contextOf(opts.chatId).frac : 0;
      ring.innerHTML = ringSvg(frac);
      ring.classList.toggle('hidden', !code || !opts.chatId);
      ring.title = `Контекст: ${Math.round(frac * 100)}% — открыть панель`;
    }
    perm.onclick = e => modeMenu(e.currentTarget);
    repoBtn.onclick = () => { if (!S.linking) repoPicker(opts, wrap); };
    model2.onclick = e => modelMenu(e.currentTarget, wrap);
    ring.onclick = () => { S.infoOpen = true; save('info', '1'); renderTopbar(); };
    // Подсказка следующего сообщения (как в приложении Claude): текст — вставить, «›» — отправить
    const sg = wrap.querySelector('.suggest');
    function renderSuggestion() {
      const text = opts.chatId && (S.suggestions || {})[opts.chatId];
      const show = !!text && !ta.value && !isRunning(opts.chatId) && !S.files.length;
      sg.classList.toggle('hidden', !show);
      if (show) sg.querySelector('.sg-text').textContent = text;
    }
    sg.querySelector('.sg-text').onclick = () => {
      ta.value = (S.suggestions || {})[opts.chatId] || '';
      grow(); focusSoft(ta);
    };
    sg.querySelector('.sg-send').onclick = () => {
      ta.value = (S.suggestions || {})[opts.chatId] || '';
      if (ta.value) submit();
    };
    ta.addEventListener('input', () => { grow(); renderSuggestion(); });
    ta.addEventListener('keydown', e => {
      // Enter — отправить; Ctrl+Enter — в очередь, даже пока Claude отвечает; Shift+Enter — новая строка
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) { e.preventDefault(); if (ta.value.trim() || S.files.some(f => f.path)) submit(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled && !send.classList.contains('stop')) submit(); }
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); cyclePermission(); }
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
      if (opts.chatId && S.suggestions) { delete S.suggestions[opts.chatId]; renderSuggestion(); }
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
    wrap._setText = t => { ta.value = t; grow(); focusSoft(ta); };
    wrap._submit = () => submit();
    // В чате над полем ввода — план задач и «Сейчас: …» (renderPlan)
    if (opts.chatId) { wrap.insertBefore(h('<div class="plan-panel hidden"></div>'), wrap.firstChild); setTimeout(renderPlan, 0); }
    HOOKS.composer.forEach(f => { try { f(wrap, opts, ta); } catch (e) {} });
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
    HOOKS.composerTools.forEach(f => { try { (f(wrap._opts, wrap) || []).forEach(it => items.push(it)); } catch (e) {} });
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
    applyMode();
    document.querySelectorAll('.composer-wrap').forEach(w => { if (w._update) { w._busy = true; w._update(); w._busy = false; } });
    scheduleInfo();
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
    focusSoft($('#composer-box textarea'));
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
    loadInfo(true);
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
    el._message = m;
    if (m.files && m.files.length) wrap.appendChild(filesBlock(m.files));
    if (m.content) {
      const auto = m.content.startsWith('[Автоматически] ');
      wrap.appendChild(h(`<div class="bubble"${auto ? ' style="opacity:.75;font-size:14px"' : ''}>${esc(m.content)}</div>`));
    }
    if (!pending) HOOKS.userMessage.forEach(f => { try { f(el, m); } catch (e) {} });
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
    el._message = m;
    HOOKS.assistantMessage.forEach(f => { try { f(el, m, actions); } catch (e) {} });
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
    const raw = (a && a.status) || 'Думаю…';
    // Состояние до начала текста («Синхронизация…», «Думаю…») не обновляется, пока модель пишет
    const status = a && a.text && /^(Синхронизация|Думаю)/.test(raw) ? 'Пишу ответ…' : raw;
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
    setTimeout(() => focusSoft(input), 0);
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
    showPanel({ id: a.id, title: a.title, language: a.language, content: a.content, versions: a.versions || [], version: a.version });
  }

  function previewable(lang, content) {
    lang = (lang || '').toLowerCase();
    if (['html', 'htm', 'svg', 'xml', 'markdown', 'md', 'mermaid'].includes(lang)) return lang === 'xml' ? /^\s*<svg/i.test(content) : true;
    return /^\s*(<!doctype html|<html|<svg)/i.test(content);
  }

  function showPanel(doc) {
    S.panel = doc;
    const panel = $('#panel');
    showAnimated(panel);
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
    $('#resizer').classList.add('hidden');
    hideAnimated($('#panel'), () => { if (!S.panel) $('#panel').innerHTML = ''; });
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
    if (INNER) { window.ClaudeInner.saveText(name, String(content)); return; }
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

  // ------------------------------------------------------------ правая панель: среда, контекст, задачи
  // Как боковая панель Claude Code: где работает Claude, заполнение контекста по частям, план задач, результаты.
  S.infoOpen = load('info') ? load('info') === '1' : window.innerWidth > 1280;
  const INFO = {};          // chatId → { meta, session, at }
  let infoTimer = null, infoBusy = false;
  const PART_COLORS = { 'Сообщения': '#3b82f6', 'Память и инструкции': '#e0632f', 'Системные инструменты': '#1fa37a', 'Системный промпт': '#d99a1e',
    'Инструменты': '#1fa37a', 'Файлы': '#8b5cf6', 'Изображения': '#c55a9a', 'Навыки': '#9e9e9e', 'Инструменты MCP': '#2fb5a8' };
  function partColor(label, i) { return PART_COLORS[label] || ['#9e9e9e', '#6b7280', '#a3a3a3', '#78716c'][i % 4]; }
  function tokens(n) { n = n || 0; return n < 1000 ? String(n) : n < 1e6 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; }
  function ringSvg(frac) {
    const C = 2 * Math.PI * 7;
    return `<svg viewBox="0 0 18 18" class="ring${frac > 0.8 ? ' hot' : ''}"><circle class="tr" cx="9" cy="9" r="7"/><circle class="fg" cx="9" cy="9" r="7" stroke-dasharray="${(Math.min(1, frac) * C).toFixed(2)} ${C.toFixed(2)}"/></svg>`;
  }
  /** Заполнение контекста по последнему ответу: части входа + ответ, размер окна из настроек */
  function contextOf(chatId) {
    const msgs = S.chat && S.chat.id === chatId && S.chat.messages || [];
    const m = [...msgs].reverse().find(x => x.role === 'assistant' && x.usage && typeof x.usage === 'object');
    const meta = INFO[chatId] && INFO[chatId].meta;
    const win = (meta && meta.contextWindow > 0 ? meta.contextWindow : 0) || (m && m.usage.window) || 0;
    if (!m) {
      const est = meta && meta.contextFill ? meta.contextFill : 0;
      return { frac: est, used: Math.round(est * win), win, parts: [], estimated: true };
    }
    const u = m.usage;
    const parts = (u.inParts || []).map(p => ({ label: p.label, tokens: p.tokens || 0 }));
    const inputSum = parts.reduce((a, p) => a + p.tokens, 0);
    const answer = Math.max(0, (u.context || 0) - inputSum);
    const msgPart = parts.find(p => p.label === 'Сообщения');
    if (msgPart) msgPart.tokens += answer; else if (answer > 0) parts.unshift({ label: 'Сообщения', tokens: answer });
    const used = parts.reduce((a, p) => a + p.tokens, 0) || u.context || 0;
    return { frac: win ? Math.min(1, used / win) : 0, used, win, parts: parts.filter(p => p.tokens > 0).sort((a, b) => b.tokens - a.tokens), estimated: !!u.estimated };
  }
  function scheduleInfo() { clearTimeout(infoTimer); infoTimer = setTimeout(() => renderInfo(), 60); }
  async function loadInfo(force) {
    if (!S.chat || infoBusy) return;
    const id = S.chat.id;
    const cached = INFO[id];
    if (!force && cached && Date.now() - cached.at < (isRunning(id) ? 3000 : 15000)) return;
    infoBusy = true;
    try {
      const [meta, session] = await Promise.all([
        api('GET', `/api/chatx/${encodeURIComponent(id)}/meta`).catch(() => null),
        api('GET', `/api/chatx/${encodeURIComponent(id)}/session`).catch(() => null)
      ]);
      INFO[id] = { meta, session, at: Date.now() };
    } finally { infoBusy = false; }
    renderInfo();
    renderComposerState();
    renderPlan();
  }
  // ------------------------------------------------------------ план и «Сейчас» над полем ввода (как в Claude Code)
  /** План задач чата: живой (во время работы) или из последнего ответа; status — completed / in_progress / pending */
  function planOf(id) {
    const live = S.live[id], meta = INFO[id] && INFO[id].meta;
    const raw = (live && live.running && live.todo) || (meta && meta.todo) || [];
    const norm = st => st === 2 || st === 'completed' ? 'completed' : st === 1 || st === 'in_progress' ? 'in_progress' : 'pending';
    return raw.map(t => ({ text: t.text, status: norm(t.status) }));
  }
  const planOpen = {};
  let planWasRunning = {};
  function renderPlan() {
    const box = $('.plan-panel');
    if (!box) return;
    const id = S.chat && S.chat.id;
    if (!id) { box.classList.add('hidden'); return; }
    const live = S.live[id], working = !!(live && live.running);
    // План последнего ответа — из /meta; закончился ответ — забираем итоговый
    if (planWasRunning[id] && !working) setTimeout(() => loadInfo(true), 600);
    planWasRunning[id] = working;
    if (!INFO[id]) loadInfo();
    const todo = planOf(id);
    if (!todo.length && !working) { box.classList.add('hidden'); box._key = ''; return; }
    const done = todo.filter(t => t.status === 'completed').length, all = todo.length > 0 && done === todo.length;
    const open = planOpen[id] !== undefined ? planOpen[id] : !all;
    const steps = working ? (live.steps || []).slice(-5) : [];
    const key = JSON.stringify([id, todo, working, open, working ? live.status : '', steps.map(x => x.title + x.error)]);
    box.classList.remove('hidden');
    if (box._key === key) return;
    box._key = key;
    const title = todo.length
      ? `Задачи ${done}/${todo.length}${all ? ' · выполнено' : working ? '' : ' · работа остановлена'}`
      : 'Claude работает' + (live.steps && live.steps.length ? ' · шагов: ' + live.steps.length : '');
    const bar = box.querySelector('.pp-bar span');
    const oldPct = bar ? bar.style.width : '0%';
    box.classList.toggle('open', open);
    box.innerHTML = `
      <button class="pp-h"><span class="pp-ic">${icon('check')}</span><span class="pp-t">${esc(title)}</span><span class="pp-arrow">${icon('down')}</span></button>
      ${todo.length ? `<div class="pp-bar"><span style="width:${oldPct}"></span></div>` : ''}
      ${working ? `<div class="pp-now"><span class="cw-spin"></span><span class="ellipsis">Сейчас: ${esc(live.status || 'Думаю…')}</span></div>` : ''}
      ${open ? `<div class="pp-body">${todo.map(t => `<div class="ip-todo ${t.status}"><span class="ck">${t.status === 'completed' ? icon('check') : t.status === 'in_progress' ? '<span class="dot-run"></span>' : ''}</span><span>${esc(t.text)}</span></div>`).join('')}
        ${steps.length ? `<div class="pp-sub">Последние шаги</div>${steps.map(x => `<div class="pp-step${x.error ? ' err' : ''}">${icon(x.error ? 'x' : 'check')}<span class="ellipsis">${esc(x.title)}</span></div>`).join('')}` : ''}</div>` : ''}`;
    // Полоса прогресса плавно доезжает до нового значения
    const nb = box.querySelector('.pp-bar span');
    if (nb) requestAnimationFrame(() => { nb.style.width = (todo.length ? done / todo.length * 100 : 0) + '%'; });
    box.querySelector('.pp-h').onclick = () => { planOpen[id] = !open; renderPlan(); };
  }

  function renderInfo() {
    const box = $('#info');
    const show = S.route.name === 'chat' && S.infoOpen && S.chat;
    // Закрыли кнопкой или свайпом — уезжает плавно; ушли со страницы чата — прячется сразу
    if (!show && S.route.name === 'chat' && !box.classList.contains('hidden')) hideAnimated(box, () => box.classList.remove('no-enter'));
    else if (show) showAnimated(box);
    else { box.classList.add('hidden'); box.classList.remove('no-enter'); }
    $('#info-btn').classList.toggle('on', !!show);
    if (!show) return;
    const id = S.chat.id;
    const data = INFO[id] || {};
    if (!data.at || Date.now() - data.at > (isRunning(id) ? 3000 : 15000)) loadInfo();
    const sess = data.session, meta = data.meta;
    const ctx = contextOf(id);
    const env = sess && sess.environment, place = sess && sess.place;
    const fold = (key, title, body, extra) => `<section class="ip${load('ip-' + key) === '0' ? ' closed' : ''}" data-key="${key}"><button class="ip-h">${esc(title)}${icon('down')}${extra || ''}</button><div class="ip-b">${body}</div></section>`;
    let html = '';
    html += fold('env', 'Среда', sess ? `
      <div class="ip-row">${icon('cloud')}<span class="grow">${esc(env ? env.name : 'По умолчанию')}</span><span class="ip-sub">${esc(env ? env.networkTitle || '' : '')}</span></div>
      <div class="ip-row">${icon('repo')}<span class="grow">${esc(place.repo || place.project)}</span></div>
      ${place.branch ? `<div class="ip-row">${icon('branch')}<span class="grow">${esc(place.branch)}</span></div>` : ''}
      <div class="ip-row ip-dim" title="${esc(place.folder)}">${icon('folder')}<span class="grow ellipsis">${esc(place.folder.split('/').slice(-2).join('/'))}</span></div>` : '<div class="ip-dim">Загружаю…</div>');
    const pct = Math.round(ctx.frac * 100);
    const bar = ctx.win ? ctx.parts.map((p, i) => `<span style="width:${(p.tokens / ctx.win * 100).toFixed(2)}%;background:${partColor(p.label, i)}"></span>`).join('') : '';
    const rows = ctx.parts.map((p, i) => `<div class="ip-ctx"><span class="dot" style="background:${partColor(p.label, i)}"></span><span class="grow">${esc(p.label)}</span><span class="n">${tokens(p.tokens)}</span><span class="p">${ctx.win ? (p.tokens / ctx.win * 100).toFixed(1) + ' %' : ''}</span></div>`).join('');
    const free = ctx.win ? `<div class="ip-ctx"><span class="dot free"></span><span class="grow">Свободно</span><span class="n">${tokens(Math.max(0, ctx.win - ctx.used))}</span><span class="p">${(Math.max(0, ctx.win - ctx.used) / ctx.win * 100).toFixed(1)} %</span></div>` : '';
    html += fold('ctx', 'Контекст', `
      <div class="ip-used"><b>Использовано: ${pct} %</b><span>${tokens(ctx.used)} / ${ctx.win ? tokens(ctx.win) : '—'}${ctx.estimated ? ' ≈' : ''}</span></div>
      <div class="ip-bar">${bar}</div>${rows}${free}
      ${meta && meta.autoCompact ? '<div class="ip-dim" style="margin-top:6px">Автосжатие включено: при заполнении Claude сам сожмёт историю.</div>' : ''}`);
    const todo = planOf(id);
    if (todo.length) {
      const done = todo.filter(t => t.status === 'completed').length;
      html += fold('todo', `Задачи · ${done}/${todo.length}`, todo.map(t => `<div class="ip-todo ${esc(t.status)}"><span class="ck">${t.status === 'completed' ? icon('check') : t.status === 'in_progress' ? '<span class="dot-run"></span>' : ''}</span><span>${esc(t.text)}</span></div>`).join(''));
    }
    const live = S.live[id];
    if (live && live.running && live.steps && live.steps.length) {
      html += fold('steps', 'Сейчас', live.steps.slice(-6).map(st => `<div class="ip-row${st.error ? ' err' : ''}"><span class="grow ellipsis">${esc(st.title)}</span></div>`).join(''));
    }
    const results = sess && sess.results || [];
    if (results.length) {
      html += fold('res', `Результаты · ${results.length}`, results.slice(-12).reverse().map(r =>
        `<a class="ip-row ip-link" ${r.artifactId ? `data-art="${esc(r.artifactId)}"` : `href="${esc(fileUrl(r.path))}" target="_blank" rel="noopener"`}>${icon(r.artifactId ? 'artifact' : 'file')}<span class="grow ellipsis">${esc(String(r.name || r.path).split('/').pop())}</span><span class="ip-sub">${esc(r.kindTitle || '')}</span></a>`).join(''));
    }
    box.innerHTML = html;
    box.querySelectorAll('.ip-h').forEach(b => {
      b.onclick = () => { const sec = b.parentElement; sec.classList.toggle('closed'); save('ip-' + sec.dataset.key, sec.classList.contains('closed') ? '0' : ''); };
    });
    box.querySelectorAll('[data-art]').forEach(a => { a.onclick = e => { e.preventDefault(); openArtifactById(+a.dataset.art); }; });
  }
  async function openArtifactById(aid) {
    try { const a = await api('GET', '/api/artifacts/' + aid); showPanel({ id: a.id, title: a.title, language: a.language, content: a.content, version: a.version, versions: a.versions || [] }); }
    catch (e) { toast(e.message); }
  }
  // «С чем работать» (как на телефоне): проект или репозиторий GitHub с веткой для чата «Кода»
  function placeProject(opts) {
    const pid = opts.chatId ? ((S.chats.find(c => c.id === opts.chatId) || {}).projectId || null) : (opts.projectId || null);
    return pid ? S.projects.find(p => p.id === pid) || null : null;
  }
  function placeLabel(p) {
    const text = !p ? 'Общая папка · выбрать проект'
      : p.repo && p.path ? `${p.name} · ${p.path}`
      : p.repo ? `${p.repo} · ${p.branch || 'main'}` : p.name;
    return icon(p && p.repo ? 'branch' : 'folder') + `<span class="t">${esc(text)}</span>` + icon('down');
  }
  /** Выбран проект: в чате с другим проектом — новый чат в нём (как в приложении), на главной — проект поля ввода */
  function choosePlace(opts, wrap, projectId) {
    const cur = placeProject(opts);
    if ((cur ? cur.id : null) === projectId) return;
    S.homeProject = projectId;
    if (opts.chatId) {
      toast('Новый чат: ' + (projectId ? (S.projects.find(p => p.id === projectId) || {}).name || 'проект' : 'общая папка'));
      goHome();
    } else {
      opts.projectId = projectId;
      wrap._update && wrap._update();
    }
  }
  function repoPicker(opts, wrap) {
    const cur = placeProject(opts);
    modal(`<h3>С чем работать</h3>
      <div class="rp-sec">Проекты</div><div class="rp-list" data-projects></div>
      <div class="rp-sec">Репозитории GitHub</div>
      <input class="field" data-q placeholder="Поиск репозитория" style="margin-bottom:8px">
      <div class="rp-list rp-repos" data-repos><div class="rp-dim">Загружаю репозитории…</div></div>
      <div class="btns"><button class="btn" data-x>Закрыть</button></div>`, async (bg, close) => {
      bg.querySelector('.modal').classList.add('rp-modal');
      bg.querySelector('[data-x]').onclick = close;
      const row = (title, sub, selected) => `<button class="rp-row${selected ? ' on' : ''}"><span class="grow"><span class="rp-t">${esc(title)}</span><span class="rp-s">${esc(sub)}</span></span>${selected ? icon('check') : ''}</button>`;
      const pbox = bg.querySelector('[data-projects]');
      const plist = [{ id: null, name: 'Общая папка', sub: 'без репозитория' }].concat(S.projects.map(p => ({
        id: p.id, name: p.name, sub: !p.repo ? 'без репозитория' : p.path ? `${p.repo}/${p.path} · ${p.branch}` : `${p.repo} · ${p.branch || 'main'}`
      })));
      pbox.innerHTML = plist.map(p => row(p.name, p.sub, (cur ? cur.id : null) === p.id)).join('');
      [...pbox.children].forEach((b, i) => { b.onclick = () => { close(); choosePlace(opts, wrap, plist[i].id); }; });
      const rbox = bg.querySelector('[data-repos]');
      let data;
      try { data = await api('GET', '/api/chatx/repos'); } catch (e) { rbox.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      if (!data.login) {
        bg.querySelector('[data-q]').classList.add('hidden');
        rbox.innerHTML = `<div class="rp-dim">Войдите в GitHub, чтобы выбрать репозиторий — Claude получит к нему полный доступ: файлы, ветки, коммиты, pull request и GitHub Actions.</div>
          <button class="btn accent" data-login style="margin-top:8px">Войти через GitHub</button>`;
        rbox.querySelector('[data-login]').onclick = () => { close(); location.hash = '#/settings/GITHUB'; };
        return;
      }
      let chosen = null, branches = [], branch = '';
      const draw = () => {
        const q = bg.querySelector('[data-q]').value.trim().toLowerCase();
        const list = data.repos.filter(r => !q || r.fullName.toLowerCase().includes(q));
        rbox.innerHTML = list.length ? '' : '<div class="rp-dim">Ничего не найдено</div>';
        list.slice(0, 200).forEach(r => {
          const el = h(row(r.fullName, r.description || (r.private ? 'приватный' : 'публичный'), chosen === r));
          el.onclick = async () => {
            chosen = chosen === r ? null : r; branches = []; branch = r.defaultBranch; draw();
            if (!chosen) return;
            try { branches = (await api('GET', '/api/chatx/branches?repo=' + encodeURIComponent(r.fullName))).branches || []; } catch (e) { toast(e.message); }
            if (chosen === r) draw();
          };
          rbox.appendChild(el);
          if (chosen === r) {
            const box = h(`<div class="rp-branch"><div class="rp-t" style="margin-bottom:4px">Ветка</div><div data-bl></div><button class="btn primary" data-go style="margin-top:8px">Подключить</button></div>`);
            const bl = box.querySelector('[data-bl]');
            (branches.length ? branches : [r.defaultBranch]).forEach(name => {
              const b = h(`<label class="rp-radio"><input type="radio" name="rp-b" ${name === branch ? 'checked' : ''}> ${esc(name)}${name === r.defaultBranch ? ' <span class="rp-s">(основная)</span>' : ''}</label>`);
              b.querySelector('input').onchange = () => { branch = name; };
              bl.appendChild(b);
            });
            box.querySelector('[data-go]').onclick = async () => {
              close();
              S.linking = `Подключаю ${r.fullName} (${branch})…`;
              renderComposerState();
              try {
                const res = await api('POST', '/api/chatx/connect', { repo: r.fullName, branch });
                S.settings.codeMode = true;
                toast(`Репозиторий ${r.fullName} (${branch}) подключён`);
                const st = await api('GET', '/api/chats').catch(() => null);
                if (st) onChats(st);
                S.linking = null;
                choosePlace(opts, wrap, res.projectId);
              } catch (e) { toast('Не удалось подключить репозиторий: ' + e.message); }
              S.linking = null;
              renderComposerState();
            };
            rbox.appendChild(box);
          }
        });
      };
      bg.querySelector('[data-q]').oninput = draw;
      draw();
    });
  }

  // «Режим» (как в Claude Code): Авто, Принимать правки, План; ниже — Спрашивать и До конца сам.
  // План — отдельная настройка planMode: режим разрешений при этом не меняется.
  const MODE_TEXT = {
    AUTO: 'Claude принимает решения о разрешениях', ACCEPT_EDITS: 'Автоматически принимать все правки файлов',
    PLAN: 'Составление плана перед внесением изменений', ASK: 'Окно «Разрешить?» перед каждой правкой и командой', BYPASS: 'Всё без вопросов'
  };
  function modeTitle() {
    if (S.settings.planMode) return 'План';
    const pm = (S.info.permissionModes || []).find(m => m.id === S.settings.permissionMode);
    return pm ? pm.title : 'Режим';
  }
  function setMode(id) {
    if (id === 'PLAN') setSetting({ planMode: true });
    else setSetting({ permissionMode: id, planMode: false });
  }
  function modeMenu(anchor) {
    const titles = {};
    (S.info.permissionModes || []).forEach(m => { titles[m.id] = m.title; });
    const cur = S.settings.planMode ? 'PLAN' : S.settings.permissionMode;
    const item = (id, key, extra) => Object.assign({ label: id === 'PLAN' ? 'План' : titles[id] || id, sub: MODE_TEXT[id], checked: cur === id, key, onClick: () => setMode(id) }, extra || {});
    const items = [{ header: 'Режим' }];
    if (titles.AUTO) items.push(item('AUTO', '1', { badge: 'Рекомендуется' }));
    items.push(item('ACCEPT_EDITS', '2'), item('PLAN', '3'), { sep: true }, item('ASK', '4'), item('BYPASS', '5'));
    menu(anchor, items, { above: true });
  }
  function cyclePermission() {
    // Shift+Tab — по кругу основные режимы: Авто → Принимать правки → План
    const order = ['AUTO', 'ACCEPT_EDITS', 'PLAN'];
    const cur = S.settings.planMode ? 'PLAN' : S.settings.permissionMode;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setMode(next);
    toast('Режим: ' + (next === 'PLAN' ? 'План' : ((S.info.permissionModes || []).find(m => m.id === next) || {}).title || next));
  }

  // ------------------------------------------------------------ модули (mod-*.js)
  // Разделы, которых нет в основе (настройки, расширения, код, задачи…), подключаются отдельными файлами
  // через window.CW: страница (#/имя/…), пункт в боковой панели и добавки в меню, поле ввода и сообщения.
  const PAGES = {};
  const NAV = [];
  const HOOKS = { chatMenu: [], settingsMenu: [], composerTools: [], composer: [], userMessage: [], assistantMessage: [], topbar: [], live: [], hello: [] };
  function renderNavExtra() {
    const box = $('#nav-extra');
    if (!box) return;
    const groups = [];
    const main = new Set([...document.querySelectorAll('.sb-nav > [data-nav]')].map(a => a.dataset.nav));
    NAV.filter(n => !main.has(n.page)).sort((a, b) => (a.order || 50) - (b.order || 50)).forEach(n => {
      let g = groups.find(x => x.name === (n.group || ''));
      if (!g) { g = { name: n.group || '', items: [] }; groups.push(g); }
      g.items.push(n);
    });
    const open = load('navOpen') === '1';
    box.innerHTML = NAV.length ? `<button class="sb-link sb-more" data-more>${icon(open ? 'down' : 'chev')}Ещё</button>` : '';
    if (!open) { box.querySelector('[data-more]') && (box.querySelector('[data-more]').onclick = () => { save('navOpen', '1'); renderNavExtra(); }); return; }
    box.querySelector('[data-more]').onclick = () => { save('navOpen', ''); renderNavExtra(); };
    groups.forEach(g => {
      if (g.name) box.appendChild(h(`<div class="sb-group">${esc(g.name)}</div>`));
      g.items.forEach(n => box.appendChild(h(`<a class="sb-link${S.route.name === n.page ? ' active' : ''}" href="#/${esc(n.page)}">${icon(n.icon || 'chev')}${esc(n.label)}</a>`)));
    });
  }
  window.CW = {
    S, api, h, esc, icon, toast, copy, menu, modal, confirmBox, pageShell, markdown, enhance, fileUrl, size, when, ago,
    setSetting, stopChat, closeMenus, showPanel, closePanel, download, lightbox, isRunning, reloadChat, renderView, renderSidebar,
    renderComposerState, LOGO,
    haptic, focusSoft,
    get base() { return BASE; },
    load, save,
    /** Страница #/name/<id>: render(id) → элемент; title — заголовок в верхней строке */
    page(name, def) { PAGES[name] = def; },
    /** Пункт в боковой панели («Ещё»): { page, label, icon, group, order } */
    nav(item) { NAV.push(item); },
    on(hook, fn) { HOOKS[hook].push(fn); },
    go(path) { location.hash = '#/' + path; },
    current() { return S.route; },
    rerender() { if (PAGES[S.route.name]) renderView(); }
  };

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
  // Модули (mod-*.js) подключаются после app.js — запуск, когда все они зарегистрировались
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
