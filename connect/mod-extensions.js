/* Раздел mod-extensions.js — «Расширения» (коннекторы MCP, навыки, плагины, команды «/», агенты), «Хуки» и «Среды».
   Как экраны телефона ExtensionsScreen, HooksScreen и EnvironmentsScreen; API — /api/ext/… (WebExtensionsApi.kt).
   Секреты (значения сетевых секретов, заголовков коннекторов, токены входа) телефон в браузер не отдаёт: «••••••». */
(() => {
  'use strict';
  const CW = window.CW;
  if (!CW) return;
  const { api, h, esc, icon, toast, menu, modal, confirmBox, pageShell, markdown } = CW;
  const MASK = '••••••';

  // ------------------------------------------------------------ значки и стили раздела
  const SYMBOLS = {
    'ext-plug': '<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0z"/><path d="M12 16v5"/>',
    'ext-puzzle': '<path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z"/>',
    'ext-bolt': '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    'ext-cloud': '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>',
    'ext-key': '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3M14 9l2 2"/>',
    'ext-bot': '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/>',
    'ext-book': '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    'ext-slash': '<path d="m15 4-6 16"/>'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
  svg.innerHTML = Object.entries(SYMBOLS).map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${d}</symbol>`).join('');
  document.body.appendChild(svg);

  const style = document.createElement('style');
  style.textContent = `
.cx-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--border); margin: -6px 0 18px; }
.cx-tabs a { padding: 8px 12px; font-size: 14px; color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; display: inline-flex; align-items: center; gap: 6px; }
.cx-tabs a:hover { color: var(--text); }
.cx-tabs a.on { color: var(--text); border-bottom-color: var(--accent); font-weight: 500; }
.cx-tabs a .cw-badge { font-size: 11px; }
.cx-hint { color: var(--muted); font-size: 13.5px; margin: 0 0 14px; }
.cx-hint.small { font-size: 12.5px; margin: 4px 0 0; }
.cx-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 0 0 14px; }
.cx-bar .grow { flex: 1; }
.cx-bar .search-box { margin: 0; flex: 1; min-width: 180px; padding: 6px 10px; }
.cx-item .cw-label { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 500; }
.cx-item .cw-sub { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
.cx-item .ico { width: 34px; height: 34px; border-radius: 9px; background: var(--bg-hover); color: var(--muted); display: flex; align-items: center; justify-content: center; flex: none; }
.cx-item .ico.on { background: var(--accent-soft); color: var(--accent); }
.cx-item .acts { display: flex; align-items: center; gap: 2px; flex: none; }
.cx-item.off .cw-label, .cx-item.off .cw-sub { opacity: .6; }
.cx-mono { font-family: var(--mono); font-size: 12.5px; color: var(--muted); white-space: pre-wrap; word-break: break-all; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.cx-catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.cx-card { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.cx-card .n { font-weight: 600; }
.cx-card .d { color: var(--muted); font-size: 13px; flex: 1; }
.cx-card .btn { align-self: flex-start; padding: 5px 12px; font-size: 13px; }
.modal.cx-wide { max-width: 720px; max-height: calc(100vh - 40px); overflow: auto; }
.modal.cx-mid { max-width: 560px; max-height: calc(100vh - 40px); overflow: auto; }
.modal .cw-form label { margin: 0; }
.modal .cw-form { margin-bottom: 6px; }
.cx-err { color: var(--danger); font-size: 13.5px; white-space: pre-wrap; }
.cx-ok { color: var(--ok, #3f7d4e); font-size: 13.5px; white-space: pre-wrap; }
.cx-check { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
.cx-check.row { flex-direction: row !important; }
.cx-md { border: 1px solid var(--border); border-radius: 12px; padding: 4px 16px; max-height: 50vh; overflow: auto; background: var(--bg); font-size: 14.5px; }
.cx-pre { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; max-height: 50vh; overflow: auto; background: var(--bg-code); font: 12.5px/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; margin: 0; }
.cx-files { display: flex; flex-direction: column; gap: 2px; margin: 6px 0 12px; }
.cx-files button { text-align: left; padding: 5px 8px; border-radius: 7px; font: 13px var(--mono); display: flex; gap: 8px; }
.cx-files button:hover, .cx-files button.on { background: var(--bg-hover); }
.cx-files button span { color: var(--muted); margin-left: auto; font-family: var(--sans); font-size: 12px; }
.cx-seg { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.cx-seg button { border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: 13px; background: var(--bg-elev); color: var(--text-2); }
.cx-seg button.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.cx-radio { display: flex; flex-direction: column; gap: 6px; }
.cx-radio button { text-align: left; border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; background: var(--bg-elev); display: flex; gap: 10px; align-items: flex-start; }
.cx-radio button.on { border-color: var(--accent); background: var(--accent-soft); }
.cx-radio .dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border-strong); flex: none; margin-top: 2px; }
.cx-radio button.on .dot { border-color: var(--accent); background: radial-gradient(var(--accent) 45%, transparent 50%); }
.cx-radio .t { font-weight: 500; font-size: 14.5px; }
.cx-radio .s { color: var(--muted); font-size: 13px; }
.cx-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; margin-bottom: 4px; }
.cx-presets button { text-align: left; border: 1px dashed var(--border-strong); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; background: var(--bg); display: flex; gap: 8px; align-items: flex-start; }
.cx-presets button:hover { border-color: var(--accent); color: var(--accent); }
.cx-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; position: sticky; bottom: 0; padding: 12px 0; background: var(--bg); border-top: 1px solid var(--border); }
.cx-steps { margin: 0 0 12px; padding-left: 20px; color: var(--text-2); font-size: 14px; }
.cx-steps li { margin: 4px 0; }
.cx-tool { padding: 8px 0; border-top: 1px solid var(--border); }
.cx-tool:first-child { border-top: 0; }
.cx-tool .n { font: 500 13px var(--mono); }
.cx-tool .d { color: var(--muted); font-size: 13px; white-space: pre-wrap; }
@media (max-width: 600px) {
  .cx-item { flex-wrap: wrap; }
  .cx-item .grow { flex-basis: calc(100% - 50px); }
  .cx-item .acts { margin-left: auto; }
  .cx-tabs a { padding: 7px 9px; }
}`;
  document.head.appendChild(style);

  // ------------------------------------------------------------ общие помощники
  const SUM = { connectors: [], skills: [], commands: [], hooks: 0, loaded: false };
  async function refreshSummary() {
    try { Object.assign(SUM, await api('GET', '/api/ext/summary'), { loaded: true }); } catch (e) {}
  }

  function sw(on, title) { return `<button class="cw-switch${on ? ' on' : ''}" data-sw title="${esc(title || (on ? 'Выключить' : 'Включить'))}"></button>`; }
  function btnIcon(name, attr, title) { return `<button class="icon-btn sm" ${attr} title="${esc(title)}">${icon(name)}</button>`; }
  function plusBtn(label) { return `<button class="btn">${icon('plus', 'style="width:15px;height:15px;vertical-align:-3px"')} ${esc(label)}</button>`; }

  /** Модальное окно с формой: onSave(bg) → Promise; ошибка показывается в окне. */
  function formModal(title, body, saveText, onSave, size) {
    let box;
    modal(`<h3>${esc(title)}</h3><div class="cw-form">${body}</div><div class="cx-err" data-err></div>
      <div class="btns"><button class="btn" data-x>Отмена</button>${saveText ? `<button class="btn primary" data-ok>${esc(saveText)}</button>` : ''}</div>`, (bg, close) => {
      box = bg;
      bg._close = close;
      bg.querySelector('.modal').classList.add(size || 'cx-mid');
      bg.querySelector('[data-x]').onclick = close;
      const ok = bg.querySelector('[data-ok]');
      if (ok) ok.onclick = async () => {
        const err = bg.querySelector('[data-err]');
        err.textContent = '';
        ok.disabled = true;
        try { if ((await onSave(bg, close)) !== false) close(); } catch (e) { err.textContent = e.message; }
        ok.disabled = false;
      };
    });
    return box;
  }
  const val = (bg, name) => { const el = bg.querySelector(`[name="${name}"]`); return el ? el.value : ''; };

  async function post(path, body, okText) {
    try {
      const r = await api('POST', path, body || {});
      if (okText || (r && r.text)) toast(okText || r.text);
      refreshSummary();
      return r;
    } catch (e) { toast(e.message); throw e; }
  }

  function loading(box) { box.innerHTML = '<div class="empty">Загрузка…</div>'; }
  function failed(box, e, retry) {
    box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`;
    if (retry) { const b = h('<button class="btn" style="margin-top:10px">Повторить</button>'); b.onclick = retry; box.appendChild(b); }
  }

  /** Строка списка: { icon, on, title, badges[], sub, mono, toggle, actions:[{icon,title,fn}], menu:[…], onClick } */
  function row(o) {
    const el = h(`<div class="cw-item cx-item${o.onClick ? ' link' : ''}${o.toggle && !o.on ? ' off' : ''}">
      ${o.icon ? `<div class="ico${o.on ? ' on' : ''}">${icon(o.icon)}</div>` : ''}
      <div class="grow"><div class="cw-label">${esc(o.title)}${(o.badges || []).filter(Boolean).map(b => `<span class="cw-badge ${b[1] || ''}">${esc(b[0])}</span>`).join('')}</div>
        ${o.sub ? `<div class="cw-sub">${esc(o.sub)}</div>` : ''}${o.mono ? `<div class="cx-mono">${esc(o.mono)}</div>` : ''}</div>
      <div class="acts"></div></div>`);
    const acts = el.querySelector('.acts');
    (o.actions || []).forEach(a => {
      const b = h(btnIcon(a.icon, '', a.title));
      b.onclick = e => { e.stopPropagation(); a.fn(b); };
      acts.appendChild(b);
    });
    if (o.menu) {
      const b = h(btnIcon('dots', '', 'Ещё'));
      b.onclick = e => { e.stopPropagation(); menu(b, o.menu(), { alignRight: true }); };
      acts.appendChild(b);
    }
    if (o.toggle) {
      const s = h(sw(o.on));
      s.onclick = async e => {
        e.stopPropagation();
        s.disabled = true;
        try { await o.toggle(!o.on); } catch (err) {} finally { s.disabled = false; }
      };
      acts.appendChild(s);
    }
    if (o.onClick) el.onclick = () => o.onClick();
    return el;
  }

  function searchBar(placeholder, onInput) {
    const box = h(`<div class="search-box">${icon('search')}<input placeholder="${esc(placeholder)}"></div>`);
    box.querySelector('input').oninput = e => onInput(e.target.value.trim().toLowerCase());
    return box;
  }

  // ------------------------------------------------------------ «Расширения»
  const TABS = [
    ['connectors', 'Коннекторы (MCP)', 'ext-plug'],
    ['skills', 'Навыки', 'ext-book'],
    ['plugins', 'Плагины', 'ext-puzzle'],
    ['commands', 'Команды /', 'ext-slash'],
    ['agents', 'Агенты', 'ext-bot']
  ];

  function extensionsPage(id) {
    const tab = TABS.some(t => t[0] === id) ? id : 'connectors';
    const el = pageShell('Расширения');
    const body = el.querySelector('.page-body');
    const tabs = h(`<nav class="cx-tabs">${TABS.map(([k, label, ic]) => `<a href="#/extensions/${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 'style="width:16px;height:16px"')}${esc(label)}</a>`).join('')}</nav>`);
    body.appendChild(tabs);
    const box = h('<div></div>');
    body.appendChild(box);
    ({ connectors: connectorsTab, skills: skillsTab, plugins: pluginsTab, commands: commandsTab, agents: agentsTab })[tab](box);
    return el;
  }

  // ---------------------------------------------- коннекторы
  const AUTH_LABEL = { NONE: 'без входа', OAUTH: 'вход через браузер', GITHUB: 'вход GitHub' };

  function connectorsTab(box) {
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/connectors'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Коннекторы (MCP-серверы) дают Claude новые инструменты: документацию, задачи, заметки, сервисы.
        Поддерживаются удалённые серверы по HTTP (Streamable HTTP и SSE). Готовые — в каталоге ниже; свой — кнопка «Свой коннектор».
        Если сервису нужен вход — нажмите «Войти»: войти можно на телефоне или прямо на этом компьютере.</p>`));
      const bar = h(`<div class="cx-bar"><div class="grow"></div></div>`);
      const add = h(plusBtn('Свой коннектор'));
      add.onclick = () => serverEditor(null, draw);
      bar.appendChild(add);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      if (!data.servers.length) list.appendChild(h('<div class="cw-item"><div class="cw-sub">Коннекторов пока нет — добавьте из каталога ниже.</div></div>'));
      data.servers.forEach(s => {
        const badges = [];
        if (s.plugin) badges.push(['плагин «' + s.plugin + '»']);
        if (s.oauth) badges.push(s.loggedIn ? ['вход выполнен', 'ok'] : ['нужен вход', 'bad']);
        list.appendChild(row({
          icon: 'ext-plug', on: s.enabled, title: s.name, badges, sub: s.url,
          toggle: async on => { await post('/api/ext/connectors/toggle', { id: s.id, enabled: on }); draw(); },
          onClick: () => serverEditor(s, draw),
          menu: () => [
            { label: 'Изменить', onClick: () => serverEditor(s, draw) },
            { label: 'Инструменты коннектора', sub: 'Что Claude сможет делать', onClick: () => toolsView(s) },
            ...(s.oauth ? [s.loggedIn
              ? { label: 'Выйти', sub: 'Удалить токены входа с телефона', onClick: async () => { await post('/api/ext/connectors/logout', { id: s.id }); draw(); } }
              : { label: 'Войти', onClick: () => loginFlow(s, draw) }] : []),
            { sep: true },
            { label: 'Удалить', danger: true, onClick: () => confirmBox(`Удалить сервер «${s.name}»?`, 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/connectors/delete', { id: s.id }); draw(); }) }
          ]
        }));
        if (s.oauth && !s.loggedIn) {
          const b = h('<button class="btn" style="padding:4px 12px;font-size:13px">Войти</button>');
          b.onclick = e => { e.stopPropagation(); loginFlow(s, draw); };
          list.lastChild.querySelector('.acts').prepend(b);
        }
      });
      box.appendChild(list);
      if (data.catalog.length) {
        box.appendChild(h('<div class="cw-section">Каталог коннекторов</div>'));
        const grid = h('<div class="cx-catalog"></div>');
        data.catalog.forEach(c => {
          const card = h(`<div class="cx-card"><div class="n">${esc(c.name)}</div><div class="d">${esc(c.description)}</div>
            <div class="cw-sub">${esc(AUTH_LABEL[c.auth] || '')}</div><button class="btn">Добавить</button></div>`);
          card.querySelector('button').onclick = async e => {
            e.target.disabled = true;
            try {
              const r = await post('/api/ext/connectors/add', { url: c.url });
              await draw();
              if (r.oauth) loginFlow({ id: r.id, name: c.name }, draw);
            } catch (err) { e.target.disabled = false; }
          };
          grid.appendChild(card);
        });
        box.appendChild(grid);
      }
    };
    draw();
  }

  function serverEditor(s, done) {
    const isNew = !s;
    s = s || { id: '', name: '', url: '', headers: '', oauth: false };
    const bg = formModal(isNew ? 'Новый MCP-сервер' : 'MCP-сервер', `
      <label>Название<input class="cw-field" name="name" value="${esc(s.name)}" placeholder="Мой сервер"></label>
      <label>Адрес<input class="cw-field" name="url" value="${esc(s.url)}" placeholder="https://…/mcp"></label>
      <label>Токен доступа (необязательно)<input class="cw-field" name="token" type="password" autocomplete="new-password" placeholder="Если сервис выдал ключ API — вставьте его сюда">
        <span class="cx-hint small">Станет заголовком «Authorization: Bearer …». Хранится только на телефоне.</span></label>
      <label>Заголовки (необязательно)<textarea class="cw-field mono" name="headers" placeholder="Authorization: Bearer …" style="min-height:70px">${esc(s.headers)}</textarea>
        <span class="cx-hint small">По одному «Имя: значение» в строке. ${esc(MASK)} — сохранённое значение (телефон его не показывает); оставьте как есть или замените.</span></label>
      <div class="cw-row" style="justify-content:space-between"><div><div class="cw-label">Вход через браузер (OAuth)</div><div class="cw-sub">После сохранения у коннектора появится кнопка «Войти»</div></div>${sw(s.oauth)}</div>
      <div class="cw-row"><button class="btn" data-check type="button">Проверить подключение</button><span data-res class="cw-sub"></span></div>`,
    'Сохранить', async bg => {
      const r = await api('POST', '/api/ext/connectors/save', form(bg));
      toast('Сохранено');
      refreshSummary();
      done && done();
      if (bg._oauth && isNew) loginFlow({ id: r.id, name: val(bg, 'name') }, done);
    });
    bg._oauth = !!s.oauth;
    const swEl = bg.querySelector('[data-sw]');
    swEl.onclick = () => { bg._oauth = !bg._oauth; swEl.classList.toggle('on', bg._oauth); };
    function form(b) {
      let headers = val(b, 'headers').split('\n').map(x => x.trim()).filter(Boolean);
      const token = val(b, 'token').trim();
      if (token) headers = headers.filter(x => !/^authorization\s*:/i.test(x)).concat('Authorization: ' + (/^(bearer|basic|token)\s/i.test(token) ? token : 'Bearer ' + token));
      return { id: s.id, name: val(b, 'name'), url: val(b, 'url'), headers: headers.join('\n'), oauth: !!b._oauth };
    }
    bg.querySelector('[data-check]').onclick = async e => {
      const res = bg.querySelector('[data-res]');
      res.className = 'cw-sub'; res.textContent = 'Проверяю…';
      e.target.disabled = true;
      try { const r = await api('POST', '/api/ext/connectors/check', form(bg)); res.className = 'cx-ok'; res.textContent = r.text; }
      catch (err) { res.className = 'cx-err'; res.textContent = 'Ошибка: ' + err.message; }
      e.target.disabled = false;
    };
  }

  async function toolsView(s, fresh) {
    const bg = formModal(`Инструменты «${s.name}»`, '<div data-tools><div class="empty" style="padding:20px 0">Подключаюсь…</div></div>', '', null, 'cx-mid');
    const boxEl = bg.querySelector('[data-tools]');
    const ref = h('<button class="btn">Обновить</button>');
    ref.onclick = () => { bg._close(); toolsView(s, true); };
    bg.querySelector('.btns').prepend(ref);
    bg.querySelector('[data-x]').textContent = 'Закрыть';
    try {
      const r = await api('GET', `/api/ext/connectors/tools?id=${encodeURIComponent(s.id)}${fresh ? '&fresh=1' : ''}`);
      boxEl.innerHTML = r.tools.length ? '' : '<div class="cw-sub">Сервер не сообщил ни одного инструмента.</div>';
      if (r.tools.length) boxEl.appendChild(h(`<div class="cw-sub" style="margin-bottom:6px">Инструментов: ${r.tools.length}</div>`));
      r.tools.forEach(t => boxEl.appendChild(h(`<div class="cx-tool"><div class="n">${esc(t.name)}</div>${t.description ? `<div class="d">${esc(t.description)}</div>` : ''}</div>`)));
    } catch (e) { boxEl.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
  }

  /**
   * Вход в коннектор по OAuth. Сервер входа возвращает браузер на http://127.0.0.1:порт/callback — этот адрес есть
   * только на телефоне. Поэтому: «Войти на телефоне» (страница входа открывается там) или вход здесь с переносом
   * адреса из строки браузера после входа.
   */
  function loginFlow(s, done) {
    let stop = false;
    modal(`<h3>Вход в «${esc(s.name)}»</h3>
      <p>Коннектору нужен вход в ваш аккаунт сервиса. Токены сохранятся только на телефоне.</p>
      <div class="cx-radio" data-pick>
        <button data-mode="phone"><span class="dot"></span><span><div class="t">Войти на телефоне</div><div class="s">На телефоне откроется страница входа (или придёт уведомление «Вход в ${esc(s.name)}»). Проще всего.</div></span></button>
        <button data-mode="pc"><span class="dot"></span><span><div class="t">Войти на этом компьютере</div><div class="s">Страница входа откроется здесь; после входа нужно будет скопировать адрес из строки браузера.</div></span></button>
      </div>
      <div data-step style="margin-top:14px"></div>
      <div class="btns"><button class="btn" data-x>Отмена</button></div>`, (bg, close) => {
      bg.querySelector('.modal').classList.add('cx-mid');
      const step = bg.querySelector('[data-step]');
      const finish = () => { stop = true; close(); };
      bg.querySelector('[data-x]').onclick = async () => {
        stop = true; close();
        try { await api('POST', '/api/ext/connectors/cancel', { id: s.id }); } catch (e) {}
      };
      const poll = async () => {
        while (!stop && document.body.contains(bg)) {
          await new Promise(r => setTimeout(r, 2000));
          if (stop || !document.body.contains(bg)) return;
          let st;
          try { st = await api('GET', `/api/ext/connectors/login?id=${encodeURIComponent(s.id)}`); } catch (e) { continue; }
          if (show(st)) return;
        }
      };
      const show = st => {
        if (st.status === 'done') { toast(st.message || 'Вход выполнен'); finish(); refreshSummary(); done && done(); return true; }
        if (st.status === 'error') { step.innerHTML = `<div class="err-box">${esc(st.message)}</div>`; return true; }
        return false;
      };
      bg.querySelectorAll('[data-mode]').forEach(b => {
        b.onclick = async () => {
          bg.querySelectorAll('[data-mode]').forEach(x => { x.classList.toggle('on', x === b); x.disabled = true; });
          step.innerHTML = '<div class="cw-sub">Готовлю вход…</div>';
          let st;
          try { st = await api('POST', '/api/ext/connectors/login', { id: s.id, mode: b.dataset.mode }); }
          catch (e) { step.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; bg.querySelectorAll('[data-mode]').forEach(x => { x.disabled = false; }); return; }
          if (show(st)) return;
          if (b.dataset.mode === 'phone') {
            step.innerHTML = `<ol class="cx-steps"><li>Возьмите телефон: открылась страница входа или пришло уведомление «Вход в ${esc(s.name)}» — нажмите его.</li>
              <li>Войдите в аккаунт и разрешите доступ.</li><li>Это окно закроется само, когда вход завершится (до 5 минут).</li></ol>
              <p class="cx-hint small">Не открылось? В приложении на телефоне: «Расширения» → «Коннекторы» → «Войти».</p>`;
          } else {
            step.innerHTML = `<ol class="cx-steps">
              <li><a href="${esc(st.url)}" target="_blank" rel="noopener">Открыть страницу входа</a> и войти в аккаунт.</li>
              <li>После входа браузер откроет адрес <code>http://127.0.0.1:${esc(st.port)}/callback?…</code> — страница не загрузится, это нормально.</li>
              <li>Скопируйте этот адрес из строки браузера целиком и вставьте сюда:</li></ol>
              <input class="cw-field" data-cb placeholder="http://127.0.0.1:${esc(st.port)}/callback?code=…">
              <div class="cw-row" style="margin-top:10px"><button class="btn primary" data-done>Завершить вход</button><span class="cx-err" data-cerr></span></div>`;
            try { window.open(st.url, '_blank', 'noopener'); } catch (e) {}
            step.querySelector('[data-done]').onclick = async e => {
              const err = step.querySelector('[data-cerr]');
              err.textContent = '';
              e.target.disabled = true;
              try { const r = await api('POST', '/api/ext/connectors/callback', { id: s.id, url: step.querySelector('[data-cb]').value }); if (!show(r)) err.textContent = 'Вход ещё не завершён — проверьте адрес'; }
              catch (x) { err.textContent = x.message; }
              e.target.disabled = false;
            };
          }
          poll();
        };
      });
    });
  }

  // ---------------------------------------------- навыки
  function skillsTab(box) {
    let q = '';
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/skills'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Навыки — инструкции для определённых задач. Claude видит их названия и загружает нужный сам,
        когда задача подходит. Можно создать навык или установить SKILL.md во вкладке «Плагины». Набор «Навыки Claude» встроен
        в приложение; Claude может и сам сохранить новый навык по вашей просьбе.</p>`));
      const bar = h('<div class="cx-bar"></div>');
      const search = searchBar('Поиск навыков…', v => { q = v; fill(); });
      search.querySelector('input').value = q;
      bar.appendChild(search);
      if (data.claudePackMissing) {
        const r = h('<button class="btn">Вернуть навыки Claude</button>');
        r.onclick = async () => { r.disabled = true; try { await post('/api/ext/skills/restore'); draw(); } catch (e) { r.disabled = false; } };
        bar.appendChild(r);
      }
      const add = h(plusBtn('Новый навык'));
      add.onclick = () => skillEditor(null, draw);
      bar.appendChild(add);
      box.appendChild(bar);
      const count = h('<div class="cw-sub" style="margin:-4px 0 8px"></div>');
      box.appendChild(count);
      const list = h('<div class="cw-list"></div>');
      box.appendChild(list);
      const fill = () => {
        const items = data.skills.filter(s => !q || (s.name + ' ' + s.description).toLowerCase().includes(q));
        count.textContent = `Навыков: ${items.length}` + (q ? ` из ${data.skills.length}` : '') + ` · включено: ${data.skills.filter(s => s.enabled).length}`;
        list.innerHTML = '';
        if (!items.length) list.appendChild(h(`<div class="cw-item"><div class="cw-sub">${q ? 'Ничего не найдено' : 'Навыков пока нет'}</div></div>`));
        items.forEach(s => list.appendChild(row({
          icon: 'ext-book', on: s.enabled, title: s.name,
          badges: [s.plugin && ['плагин «' + s.plugin + '»'], s.hasFiles && ['есть файлы']],
          sub: s.description,
          toggle: async on => { await post('/api/ext/skills/toggle', { id: s.id, enabled: on }); s.enabled = on; fill(); },
          onClick: () => skillView(s.id, draw),
          menu: () => [
            { label: 'Открыть', onClick: () => skillView(s.id, draw) },
            { label: 'Изменить', onClick: async () => { try { skillEditor(await api('GET', `/api/ext/skills/get?id=${encodeURIComponent(s.id)}`), draw); } catch (e) { toast(e.message); } } },
            { sep: true },
            { label: 'Удалить', danger: true, onClick: () => confirmBox(`Удалить навык «${s.name}»?`, 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/skills/delete', { id: s.id }); draw(); }) }
          ]
        })));
      };
      fill();
    };
    draw();
  }

  async function skillView(id, done) {
    let s;
    try { s = await api('GET', `/api/ext/skills/get?id=${encodeURIComponent(id)}`); } catch (e) { toast(e.message); return; }
    modal(`<h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}${s.plugin ? ` <span class="cw-badge">плагин «${esc(s.plugin)}»</span>` : ''}</p>
      ${s.files.length ? `<div class="cw-sub">Файлы навыка (${s.files.length}):</div><div class="cx-files" data-files></div>` : ''}
      <div class="cx-bar" style="margin:6px 0 8px"><span class="cw-sub grow" data-what>SKILL.md</span><div class="tabs"><button class="on" data-v="md">Просмотр</button><button data-v="raw">Текст</button></div></div>
      <div data-view></div>
      <div class="btns"><button class="btn" data-del style="margin-right:auto;color:var(--danger)">Удалить</button><button class="btn" data-x>Закрыть</button><button class="btn primary" data-edit>Изменить</button></div>`, (bg, close) => {
      bg.querySelector('.modal').classList.add('cx-wide');
      const view = bg.querySelector('[data-view]');
      let current = { text: s.content, md: true, name: 'SKILL.md' };
      let mode = 'md';
      const render = () => {
        bg.querySelector('[data-what]').textContent = current.name;
        if (current.binary) { view.innerHTML = '<div class="cw-sub">Двоичный файл — просмотр недоступен.</div>'; return; }
        if (mode === 'md' && current.md) { view.innerHTML = `<div class="cx-md md">${markdown(current.text)}</div>`; if (CW.enhance) try { CW.enhance(view); } catch (e) {} }
        else view.innerHTML = `<pre class="cx-pre">${esc(current.text)}</pre>`;
        if (current.truncated) view.appendChild(h('<div class="cw-sub">Показано начало файла (200 КБ).</div>'));
      };
      bg.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => { mode = b.dataset.v; bg.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); render(); }; });
      const files = bg.querySelector('[data-files]');
      if (files) {
        const main = h(`<button class="on">SKILL.md (инструкции)</button>`);
        main.onclick = () => { current = { text: s.content, md: true, name: 'SKILL.md' }; files.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === main)); render(); };
        files.appendChild(main);
        s.files.filter(f => f.path !== 'SKILL.md').forEach(f => {
          const b = h(`<button>${esc(f.path)}<span>${esc(CW.size(f.size))}</span></button>`);
          b.onclick = async () => {
            files.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            view.innerHTML = '<div class="cw-sub">Загрузка…</div>';
            try {
              const r = await api('GET', `/api/ext/skills/file?id=${encodeURIComponent(s.id)}&path=${encodeURIComponent(f.path)}`);
              current = { text: r.text || '', binary: r.binary, truncated: r.truncated, md: /\.(md|markdown)$/i.test(f.path), name: f.path };
              render();
            } catch (e) { view.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
          };
          files.appendChild(b);
        });
      }
      render();
      bg.querySelector('[data-x]').onclick = close;
      bg.querySelector('[data-edit]').onclick = () => { close(); skillEditor(s, done); };
      bg.querySelector('[data-del]').onclick = () => { close(); confirmBox(`Удалить навык «${s.name}»?`, 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/skills/delete', { id: s.id }); done && done(); }); };
    });
  }

  function skillEditor(s, done) {
    s = s || { id: '', name: '', description: '', content: '' };
    formModal(s.id ? 'Навык' : 'Новый навык', `
      <label>Имя (латиница, например code-review)<input class="cw-field" name="name" value="${esc(s.name)}" placeholder="code-review"></label>
      <label>Когда использовать (описание)<textarea class="cw-field" name="description" style="min-height:60px" placeholder="Когда пользователь просит проверить код…">${esc(s.description)}</textarea>
        <span class="cx-hint small">По этому описанию Claude решает, нужен ли навык.</span></label>
      <label>Инструкции навыка (Markdown)<textarea class="cw-field mono" name="content" style="min-height:260px">${esc(s.content)}</textarea></label>`,
    'Сохранить', async bg => {
      if (!val(bg, 'name').trim() || !val(bg, 'content').trim()) throw new Error('Нужны имя и инструкции');
      await post('/api/ext/skills/save', { id: s.id, name: val(bg, 'name'), description: val(bg, 'description'), content: val(bg, 'content') }, 'Навык сохранён');
      done && done();
    }, 'cx-wide');
  }

  // ---------------------------------------------- плагины
  function pluginsTab(box) {
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/plugins'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Плагин — набор навыков, команд, хуков и MCP-серверов. Установите из файла (.zip в формате
        плагина Claude Code, .json-манифест или SKILL.md) или по ссылке. Удаление убирает всё, что пришло с плагином.</p>`));
      const bar = h('<div class="cx-bar"></div>');
      const fileBtn = h(`<button class="btn">${icon('clip', 'style="width:15px;height:15px;vertical-align:-3px"')} Из файла</button>`);
      const input = h('<input type="file" accept=".zip,.json,.md" style="display:none">');
      fileBtn.onclick = () => input.click();
      input.onchange = async () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) { toast('Файл больше 20 МБ'); return; }
        toast('Устанавливаю «' + f.name + '»…');
        // Тело запроса — сам файл
        try {
          const r = await api('POST', `/api/ext/plugins/install?name=${encodeURIComponent(f.name)}`, undefined, f);
          toast(r.text || 'Установлено');
          refreshSummary();
        } catch (e) { toast(e.message); return; }
        draw();
      };
      const urlBtn = h(`<button class="btn">${icon('globe', 'style="width:15px;height:15px;vertical-align:-3px"')} По ссылке</button>`);
      urlBtn.onclick = () => formModal('Установить по ссылке', `<label>Ссылка<input class="cw-field" name="url" placeholder="https://… (.zip, .json или SKILL.md)"></label>`, 'Установить', async bg => {
        const r = await api('POST', '/api/ext/plugins/install-url', { url: val(bg, 'url') });
        toast(r.text || 'Установлено'); refreshSummary(); draw();
      });
      bar.appendChild(fileBtn); bar.appendChild(urlBtn); bar.appendChild(input);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      if (!data.plugins.length) list.appendChild(h('<div class="cw-item"><div class="cw-sub">Плагинов пока нет.</div></div>'));
      data.plugins.forEach(p => {
        const counts = `навыков ${p.skills}, команд ${p.commands}, MCP ${p.servers}` + (p.hooks ? ', есть хуки' : '');
        list.appendChild(row({
          icon: 'ext-puzzle', on: p.enabled, title: p.name, badges: [p.version && [p.version]],
          sub: [p.description, counts, p.source].filter(Boolean).join(' · '),
          toggle: async on => { await post('/api/ext/plugins/toggle', { id: p.id, enabled: on }); draw(); },
          actions: [{ icon: 'trash', title: 'Удалить', fn: () => confirmBox(`Удалить плагин «${p.name}»?`, 'Вместе с ним удалятся все его навыки, команды, хуки и серверы. Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/plugins/delete', { id: p.id }); draw(); }) }]
        }));
      });
      box.appendChild(list);
    };
    draw();
  }

  // ---------------------------------------------- команды «/»
  function commandsTab(box) {
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/commands'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Команды вызываются в поле ввода: «/имя текст». Текст после имени подставляется вместо
        $ARGUMENTS в шаблоне (или добавляется в конец). Встроенные /clear, /compact, /init, /review есть всегда.</p>`));
      const bar = h('<div class="cx-bar"><div class="grow"></div></div>');
      const add = h(plusBtn('Новая команда'));
      add.onclick = () => commandEditor(null, draw);
      bar.appendChild(add);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      if (!data.commands.length) list.appendChild(h('<div class="cw-item"><div class="cw-sub">Своих команд пока нет.</div></div>'));
      data.commands.forEach(c => list.appendChild(row({
        icon: 'ext-slash', on: c.enabled, title: '/' + c.name, badges: [c.plugin && ['плагин «' + c.plugin + '»']],
        sub: c.description || c.prompt.slice(0, 120),
        toggle: async on => { await post('/api/ext/commands/toggle', { id: c.id, enabled: on }); draw(); },
        onClick: () => commandEditor(c, draw),
        actions: [
          { icon: 'edit', title: 'Изменить', fn: () => commandEditor(c, draw) },
          { icon: 'trash', title: 'Удалить', fn: () => confirmBox(`Удалить команду /${c.name}?`, 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/commands/delete', { id: c.id }); draw(); }) }
        ]
      })));
      box.appendChild(list);
    };
    draw();
  }

  function commandEditor(c, done) {
    c = c || { id: '', name: '', description: '', prompt: '' };
    formModal(c.id ? 'Команда' : 'Новая команда', `
      <label>Имя (без «/»)<input class="cw-field" name="name" value="${esc(c.name)}" placeholder="translate"></label>
      <label>Описание<input class="cw-field" name="description" value="${esc(c.description)}" placeholder="Перевести текст на английский"></label>
      <label>Шаблон запроса<textarea class="cw-field mono" name="prompt" style="min-height:180px" placeholder="Переведи на английский: $ARGUMENTS">${esc(c.prompt)}</textarea>
        <span class="cx-hint small">$ARGUMENTS — текст после команды.</span></label>`,
    'Сохранить', async bg => {
      if (!val(bg, 'name').trim() || !val(bg, 'prompt').trim()) throw new Error('Нужны имя и шаблон запроса');
      await post('/api/ext/commands/save', { id: c.id, name: val(bg, 'name'), description: val(bg, 'description'), prompt: val(bg, 'prompt') }, 'Команда сохранена');
      done && done();
    });
  }

  // ---------------------------------------------- агенты
  const MODEL_LABEL = { strong: 'сильная модель', opus: 'сильная модель', fast: 'быстрая модель', haiku: 'быстрая модель', inherit: 'модель чата', sonnet: 'модель чата' };

  function agentsTab(box) {
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/agents'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Агенты — помощники с ролью, своими инструкциями и разрешёнными инструментами (как субагенты
        Claude Code). Claude поручает им части работы сам (run_agent с agent) или по вашей просьбе: «поручи reviewer проверить …».
        Свои агенты можно создать здесь, агенты проекта — файлы .claude/agents/имя.md в папке активного проекта.</p>`));
      const bar = h('<div class="cx-bar"><div class="grow"></div></div>');
      const add = h(plusBtn('Свой агент'));
      add.onclick = () => agentEditor(null, draw);
      bar.appendChild(add);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      data.agents.forEach(a => list.appendChild(row({
        icon: 'ext-bot', on: a.editable, title: a.name,
        badges: [[a.sourceTitle, a.editable ? 'accent' : ''], a.model && [MODEL_LABEL[a.model.toLowerCase()] || a.model]],
        sub: a.description, mono: 'Инструменты: ' + (a.tools.length ? a.tools.join(', ') : 'все'),
        onClick: () => a.editable ? agentEditor(a, draw) : agentView(a, draw),
        actions: a.editable ? [
          { icon: 'edit', title: 'Изменить', fn: () => agentEditor(a, draw) },
          { icon: 'trash', title: 'Удалить', fn: () => confirmBox(`Удалить агента «${a.name}»?`, 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/agents/delete', { name: a.name }); draw(); }) }
        ] : []
      })));
      box.appendChild(list);
    };
    draw();
  }

  function agentView(a, done) {
    modal(`<h3>${esc(a.name)} <span class="cw-badge">${esc(a.sourceTitle)}</span></h3>
      <p>${esc(a.description)}</p>
      <div class="cw-sub">Инструменты: ${esc(a.tools.length ? a.tools.join(', ') : 'все')}${a.model ? ' · модель: ' + esc(MODEL_LABEL[a.model.toLowerCase()] || a.model) : ''}${a.file ? ' · файл ' + esc(a.file) : ''}</div>
      <div class="cw-section" style="margin-top:14px">Инструкции</div><pre class="cx-pre">${esc(a.instructions)}</pre>
      <p class="cx-hint small" style="margin-top:8px">${a.source === 'PROJECT' ? 'Агент проекта меняется в его файле (раздел «Код»).' : 'Встроенного агента изменить нельзя — можно создать своего на его основе (свой с тем же именем заменит встроенного).'}</p>
      <div class="btns"><button class="btn" data-x>Закрыть</button><button class="btn primary" data-copy>Создать своего на основе</button></div>`, (bg, close) => {
      bg.querySelector('.modal').classList.add('cx-wide');
      bg.querySelector('[data-x]').onclick = close;
      bg.querySelector('[data-copy]').onclick = () => { close(); agentEditor(Object.assign({}, a, { editable: true, copy: true }), done); };
    });
  }

  function agentEditor(a, done) {
    const isNew = !a || a.copy;
    a = a || { name: '', description: '', tools: [], instructions: '', model: '' };
    formModal(isNew ? 'Новый агент' : 'Агент ' + a.name, `
      <label>Имя (латиница)<input class="cw-field" name="name" value="${esc(a.name)}" placeholder="translator"></label>
      <label>Когда его звать<textarea class="cw-field" name="description" style="min-height:60px" placeholder="Перевести тексты интерфейса на английский">${esc(a.description)}</textarea>
        <span class="cx-hint small">По этому описанию Claude выбирает агента.</span></label>
      <label>Инструменты<input class="cw-field" name="tools" value="${esc(a.tools.join(', '))}" placeholder="files, web — пусто: все">
        <span class="cx-hint small">Группы: files, shell, web, browser, git, actions, js, artifacts — или имена инструментов, через запятую.</span></label>
      <label>Модель<input class="cw-field" name="model" list="cx-models" value="${esc(a.model || '')}" placeholder="пусто — модель чата">
        <datalist id="cx-models"><option value="strong">сильная (роль «сильная» в моделях по ролям)</option><option value="fast">быстрая</option><option value="inherit">модель чата</option></datalist>
        <span class="cx-hint small">strong — сильная, fast — быстрая, пусто или inherit — модель чата, иначе — точный id модели.</span></label>
      <label>Инструкции<textarea class="cw-field mono" name="instructions" style="min-height:200px">${esc(a.instructions)}</textarea></label>`,
    'Сохранить', async bg => {
      const name = val(bg, 'name').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (!name) throw new Error('Укажите имя латиницей');
      if (!val(bg, 'description').trim()) throw new Error('Опишите, когда звать агента — по этому описанию его выбирает Claude');
      if (!val(bg, 'instructions').trim()) throw new Error('Напишите инструкции');
      await post('/api/ext/agents/save', {
        original: isNew ? '' : a.name, name, description: val(bg, 'description'),
        tools: val(bg, 'tools').split(/[,\s]+/).map(x => x.trim()).filter(Boolean),
        model: val(bg, 'model'), instructions: val(bg, 'instructions')
      }, 'Агент сохранён');
      done && done();
    }, 'cx-wide');
  }

  // ------------------------------------------------------------ «Хуки»
  function hooksPage(id) {
    const el = pageShell('Хуки');
    const box = el.querySelector('.page-body');
    let event = id || '';
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/hooks'); } catch (e) { failed(box, e, draw); return; }
      if (!data.events.some(e => e.key === event)) event = data.events[0].key;
      const ev = data.events.find(e => e.key === event);
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Хуки выполняются при событиях. Команда (sh на телефоне) получает JSON на вход (stdin),
        вывод добавляется к контексту или передаётся Claude, код выхода 2 — блокировка действия или продление работы (Stop).</p>`));
      box.appendChild(h('<div class="cw-section" style="margin-top:6px">Примеры</div>'));
      const presets = h('<div class="cx-presets"></div>');
      data.presets.forEach(p => {
        const b = h(`<button>${icon('plus', 'style="width:15px;height:15px;margin-top:2px"')}<span>${esc(p.title)}</span></button>`);
        b.onclick = () => hookEditor(Object.assign({}, p, { id: '' }), data.events, saved => { event = saved; draw(); });
        presets.appendChild(b);
      });
      box.appendChild(presets);
      box.appendChild(h('<div class="cw-section">Событие</div>'));
      const seg = h('<div class="cx-seg"></div>');
      data.events.forEach(e => {
        const n = data.hooks.filter(x => x.event === e.key).length + data.external.filter(x => x.event === e.key).length;
        const b = h(`<button class="${e.key === event ? 'on' : ''}">${esc(e.title)}${n ? ` · ${n}` : ''}</button>`);
        b.onclick = () => { event = e.key; history.replaceState(null, '', '#/hooks/' + e.key); draw(); };
        seg.appendChild(b);
      });
      box.appendChild(seg);
      box.appendChild(h(`<p class="cx-hint"><b>${esc(ev.title)}</b> (${esc(ev.key)}). ${esc(ev.description)}</p>`));
      const bar = h('<div class="cx-bar"><div class="grow"></div></div>');
      const add = h(plusBtn('Новый хук'));
      add.onclick = () => hookEditor({ id: '', event, matcher: '', command: '', timeout: 60, enabled: true }, data.events, saved => { event = saved; draw(); });
      bar.appendChild(add);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      const mine = data.hooks.filter(x => x.event === event);
      const ext = data.external.filter(x => x.event === event);
      if (!mine.length && !ext.length) list.appendChild(h('<div class="cw-item"><div class="cw-sub">Хуков для этого события нет.</div></div>'));
      mine.forEach(k => list.appendChild(row({
        icon: 'ext-bolt', on: k.enabled, title: ev.usesMatcher ? (k.matcher || 'все действия') : ev.title,
        badges: [['таймаут ' + k.timeout + ' с'], !k.enabled && ['отключён', 'bad']], mono: k.command,
        toggle: async on => { await post('/api/ext/hooks/toggle', { id: k.id, enabled: on }); draw(); },
        onClick: () => hookEditor(k, data.events, saved => { event = saved; draw(); }),
        actions: [
          { icon: 'edit', title: 'Изменить', fn: () => hookEditor(k, data.events, saved => { event = saved; draw(); }) },
          { icon: 'trash', title: 'Удалить', fn: () => confirmBox('Удалить хук?', 'Действие нельзя отменить.', 'Удалить', async () => { await post('/api/ext/hooks/delete', { id: k.id }); draw(); }) }
        ]
      })));
      ext.forEach(k => list.appendChild(row({
        icon: 'ext-bolt', on: true, title: ev.usesMatcher ? (k.matcher || 'все действия') : ev.title,
        badges: [k.fromProject ? ['проект', 'accent'] : ['плагин «' + k.plugin + '»', 'accent'], ['таймаут ' + k.timeout + ' с']], mono: k.command
      })));
      box.appendChild(list);
      box.appendChild(h(`<p class="cx-hint small" style="margin-top:14px">Хуки проекта читаются из файлов .claude/settings.json и
        .claude/settings.local.json в папке активного проекта — формат как в Claude Code, их можно создавать и править в «Коде».
        Хуки плагинов включаются и выключаются вместе с плагином («Расширения» → «Плагины»).</p>`));
    };
    draw();
    return el;
  }

  function hookEditor(k, events, done) {
    const isNew = !k.id;
    const evOf = key => events.find(e => e.key === key) || events[0];
    const bg = formModal(isNew ? 'Создать хук' : 'Изменить хук', `
      <label>Событие<select class="cw-field" name="event" ${isNew ? '' : 'disabled'}>${events.map(e => `<option value="${esc(e.key)}"${e.key === k.event ? ' selected' : ''}>${esc(e.title)} (${esc(e.key)})</option>`).join('')}</select>
        <span class="cx-hint small" data-evd></span></label>
      <label data-m>Действия (regex)<input class="cw-field mono" name="matcher" value="${esc(k.matcher)}" placeholder="Пусто — все действия, например write_file|edit_file или Edit|Write">
        <span class="cx-hint small">Имена инструментов приложения или Claude Code (Write, Edit, Bash, Read…).</span></label>
      <label>Команда sh<textarea class="cw-field mono" name="command" style="min-height:140px" placeholder="input=$(cat); echo …">${esc(k.command)}</textarea></label>
      <div class="cw-row"><label style="width:140px">Таймаут (с)<input class="cw-field" name="timeout" type="number" min="1" max="600" value="${esc(k.timeout || 60)}"></label>
        <label class="cx-check row" style="margin-top:20px"><input type="checkbox" name="enabled" ${k.enabled !== false ? 'checked' : ''}> Включён</label></div>`,
    'Сохранить', async bg => {
      const event = val(bg, 'event') || k.event;
      if (!val(bg, 'command').trim()) throw new Error('Напишите команду');
      await post('/api/ext/hooks/save', {
        id: k.id, event, matcher: val(bg, 'matcher'), command: val(bg, 'command'),
        timeout: Math.min(600, Math.max(1, parseInt(val(bg, 'timeout'), 10) || 60)),
        enabled: bg.querySelector('[name=enabled]').checked
      }, 'Хук сохранён');
      done && done(event);
    }, 'cx-wide');
    const sel = bg.querySelector('[name=event]');
    const upd = () => { const e = evOf(sel.value); bg.querySelector('[data-evd]').textContent = e.description; bg.querySelector('[data-m]').style.display = e.usesMatcher ? '' : 'none'; };
    sel.onchange = upd;
    upd();
  }

  // ------------------------------------------------------------ «Среды»
  function envSummary(e) {
    const parts = ['Сеть: ' + e.networkTitle.toLowerCase() + (e.network === 'LIMITED' ? ` (${e.allowedHosts.length} доменов)` : '')];
    if (e.secrets.length) parts.push('секретов: ' + e.secrets.length);
    if (e.variables) parts.push('переменных: ' + e.variables);
    if (e.setupScript && e.setupScript.trim()) parts.push('скрипт настройки');
    return parts.join(' · ');
  }

  function environmentsPage(id) {
    if (id) return environmentEditor(id);
    const el = pageShell('Среды');
    const box = el.querySelector('.page-body');
    const draw = async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/environments'); } catch (e) { failed(box, e, draw); return; }
      box.innerHTML = '';
      box.appendChild(h(`<p class="cx-hint">Среда задаёт, как работают инструменты Claude: доступ к интернету, ключи API (сетевые секреты),
        переменные и скрипт настройки, который выполняется в начале нового чата. Среду чата выбирают в чате: значок «Сессия»
        вверху → «Среда» (на телефоне).</p>`));
      const bar = h('<div class="cx-bar"><div class="grow"></div></div>');
      const add = h(plusBtn('Новая среда'));
      add.onclick = () => CW.go('environments/new');
      bar.appendChild(add);
      box.appendChild(bar);
      const list = h('<div class="cw-list"></div>');
      data.environments.forEach(e => list.appendChild(row({
        icon: 'ext-cloud', on: e.isDefault, title: e.name, badges: [e.isDefault && ['по умолчанию', 'accent']],
        sub: envSummary(e), onClick: () => CW.go('environments/' + encodeURIComponent(e.id)),
        menu: () => [
          { label: 'Изменить', onClick: () => CW.go('environments/' + encodeURIComponent(e.id)) },
          ...(e.isDefault ? [] : [{ label: 'Сделать средой по умолчанию', sub: 'Её получают новые чаты', onClick: async () => { await post('/api/ext/environments/default', { id: e.id }, 'Готово'); draw(); } }]),
          ...(data.environments.length > 1 ? [{ sep: true }, { label: 'Удалить', danger: true, onClick: () => confirmDeleteEnv(e, draw) }] : [])
        ]
      })));
      box.appendChild(list);
    };
    draw();
    return el;
  }

  function confirmDeleteEnv(e, done) {
    confirmBox(`Удалить среду «${e.name}»?`, 'Чаты этой среды перейдут на среду по умолчанию. Секреты среды будут удалены.', 'Удалить', async () => {
      await post('/api/ext/environments/delete', { id: e.id }, 'Среда удалена');
      done();
    });
  }

  function environmentEditor(id) {
    const isNew = id === 'new';
    const el = pageShell(isNew ? 'Новая среда' : 'Изменить среду');
    const box = el.querySelector('.page-body');
    const back = () => CW.go('environments');
    (async () => {
      loading(box);
      let data;
      try { data = await api('GET', '/api/ext/environments'); } catch (e) { failed(box, e); return; }
      const existing = data.environments.find(e => e.id === id);
      if (!isNew && !existing) { box.innerHTML = '<div class="err-box">Среда не найдена</div>'; return; }
      const st = existing ? JSON.parse(JSON.stringify(existing)) : { id: '', name: 'Новая среда', network: 'FULL', allowedHosts: [], secrets: [], setupScript: '', envVars: '', isDefault: false };
      st.secrets.forEach(s => { s.value = ''; });
      let makeDefault = !!st.isDefault;
      if (existing && data.environments.length > 1) {
        const del = h(`<button class="btn" style="color:var(--danger)">${icon('trash', 'style="width:15px;height:15px;vertical-align:-3px"')} Удалить</button>`);
        del.onclick = () => confirmDeleteEnv(existing, back);
        el.querySelector('.page-head').appendChild(del);
      }
      box.innerHTML = `<div class="cw-form">
        <label>Имя<input class="cw-field" name="name" value="${esc(st.name)}" maxlength="80"></label>
        <div class="cw-section" style="margin-top:8px">Доступ к сети</div>
        <div class="cx-radio" data-net>${data.networks.map(n => `<button type="button" data-n="${esc(n.id)}" class="${n.id === st.network ? 'on' : ''}"><span class="dot"></span><span><div class="t">${esc(n.title)}</div><div class="s">${esc(n.description)}</div></span></button>`).join('')}</div>
        <p class="cx-hint small">Правило действует на инструменты Claude: загрузку страниц, HTTP-запросы, поиск, браузер, JavaScript и Python.
          Вход в GitHub, коннекторы и сам Claude работают всегда. Команды оболочки (run_command) получают те же переменные, но сеть для
          них система телефона ограничить не даёт.</p>
        <label data-hosts>Разрешённые домены<textarea class="cw-field mono" name="hosts" style="min-height:120px" placeholder="api.example.com&#10;*.github.com">${esc(st.allowedHosts.join('\n'))}</textarea>
          <span class="cx-hint small">По одному в строке. *.example.com — домен и все его поддомены.</span>
          <span><button type="button" class="btn" data-common style="padding:4px 12px;font-size:13px;margin-top:4px">Добавить частые: GitHub, PyPI, npm, Android</button></span></label>
        <div class="cw-section">Сетевые секреты</div>
        <p class="cx-hint small" style="margin-top:-4px">Claude сможет вызывать API, не видя секретов: приложение само добавит заголовок к https-запросу
          на указанный домен. После сохранения значение нельзя посмотреть — только заменить (ни телефон, ни этот браузер его не показывают).</p>
        <div data-secrets></div>
        <span><button type="button" class="btn" data-addsecret>${icon('ext-key', 'style="width:15px;height:15px;vertical-align:-3px"')} Добавить секрет</button></span>
        <div class="cw-section">Скрипт настройки</div>
        <textarea class="cw-field mono" name="setupScript" style="min-height:160px" placeholder="#!/bin/sh&#10;mkdir -p data&#10;echo &quot;Готово&quot;">${esc(st.setupScript)}</textarea>
        <p class="cx-hint small" style="margin-top:-8px">Скрипт оболочки sh, который выполняется в рабочей папке проекта при начале нового чата, до первого
          ответа Claude (команды телефона: ls, mkdir, cp, sed, unzip …; не дольше 5 минут). Его вывод виден в ходе работы и передаётся Claude.</p>
        <div class="cw-section">Переменные среды</div>
        <textarea class="cw-field mono" name="envVars" style="min-height:110px" placeholder="NODE_ENV=production&#10;GIT_AUTHOR_NAME=Your Name">${esc(st.envVars)}</textarea>
        <p class="cx-hint small" style="margin-top:-8px">Формат .env: КЛЮЧ=значение по одному в строке. Переменные получают скрипт настройки, команды и Python.
          Claude видит их — ключи API храните в сетевых секретах.</p>
        <div class="cw-list"><div class="cw-item"><div class="grow"><div class="cw-label">Среда по умолчанию</div><div class="cw-sub">Её получают новые чаты</div></div>${sw(makeDefault)}</div></div>
        <div class="cx-err" data-err></div>
      </div>
      <div class="cx-foot"><button class="btn" data-cancel>Отмена</button><button class="btn primary" data-save>Сохранить изменения</button></div>`;
      const q = s => box.querySelector(s);
      const hostsLabel = q('[data-hosts]');
      const showHosts = () => { hostsLabel.style.display = st.network === 'LIMITED' ? '' : 'none'; };
      box.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => { st.network = b.dataset.n; box.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)); showHosts(); }; });
      showHosts();
      q('[data-common]').onclick = () => {
        const ta = q('[name=hosts]');
        const cur = ta.value.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
        ta.value = Array.from(new Set(cur.concat(data.commonHosts))).join('\n');
      };
      const swDef = box.querySelector('[data-sw]');
      if (existing && existing.isDefault) { swDef.disabled = true; swDef.title = 'Уже по умолчанию'; }
      swDef.onclick = () => { makeDefault = !makeDefault; swDef.classList.toggle('on', makeDefault); };
      const drawSecrets = () => {
        const sb = q('[data-secrets]');
        sb.innerHTML = '';
        if (!st.secrets.length) { sb.appendChild(h('<div class="cw-sub">Секретов пока нет.</div>')); return; }
        const list = h('<div class="cw-list"></div>');
        st.secrets.forEach((s, i) => list.appendChild(row({
          icon: 'ext-key', on: true, title: s.name, badges: [s.value && ['новое значение', 'accent']],
          sub: `${s.header}: ${MASK} · ${s.hosts}`,
          onClick: () => secretEditor(s, saved => { st.secrets[i] = saved; drawSecrets(); }),
          actions: [
            { icon: 'edit', title: 'Изменить', fn: () => secretEditor(s, saved => { st.secrets[i] = saved; drawSecrets(); }) },
            { icon: 'trash', title: 'Удалить секрет', fn: () => { st.secrets.splice(i, 1); drawSecrets(); } }
          ]
        })));
        sb.appendChild(list);
      };
      drawSecrets();
      q('[data-addsecret]').onclick = () => secretEditor(null, saved => { st.secrets.push(saved); drawSecrets(); });
      q('[data-cancel]').onclick = back;
      q('[data-save]').onclick = async e => {
        const err = q('[data-err]');
        err.textContent = '';
        const name = q('[name=name]').value.trim();
        if (!name) { err.textContent = 'Укажите имя среды'; return; }
        e.target.disabled = true;
        try {
          await api('POST', '/api/ext/environments/save', {
            id: st.id, name, network: st.network, hosts: q('[name=hosts]').value,
            secrets: st.secrets.map(s => ({ id: s.id || '', name: s.name, hosts: s.hosts, header: s.header, value: s.value || '' })),
            setupScript: q('[name=setupScript]').value, envVars: q('[name=envVars]').value, makeDefault
          });
          toast('Среда сохранена');
          back();
        } catch (x) { err.textContent = x.message; e.target.disabled = false; }
      };
    })();
    return el;
  }

  function secretEditor(s, done) {
    const fresh = !s;
    s = s || { id: '', name: '', hosts: '', header: 'Authorization', value: '' };
    // Значение уже есть: сохранено на телефоне (id) или введено в этом окне раньше
    const keeps = !!(s.id || s.value);
    formModal(fresh ? 'Новый секрет' : `Секрет «${s.name}»`, `
      <label>Имя<input class="cw-field" name="name" value="${esc(s.name)}" placeholder="OPENWEATHER_KEY"></label>
      <label>Домены<input class="cw-field" name="hosts" value="${esc(s.hosts)}" placeholder="api.openweathermap.org">
        <span class="cx-hint small">Через запятую; *.example.com — с поддоменами.</span></label>
      <label>Заголовок<input class="cw-field" name="header" value="${esc(s.header || 'Authorization')}" placeholder="Authorization"></label>
      <label>${keeps ? 'Новое значение' : 'Значение'}<input class="cw-field" name="value" type="password" autocomplete="new-password" placeholder="Bearer sk-…">
        <span class="cx-hint small">${keeps ? 'Пусто — оставить прежнее (его не видно ни здесь, ни на телефоне).' : 'Целиком, как в заголовке: например «Bearer ключ».'}</span></label>
      <p class="cx-hint small">Секрет сохранится на телефоне после «Сохранить изменения» внизу страницы.</p>`,
    'Готово', async bg => {
      const name = val(bg, 'name').trim().replace(/\s+/g, '_');
      const hosts = val(bg, 'hosts').split(/[\s,;]+/).map(x => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '')).filter(Boolean);
      const header = val(bg, 'header').trim();
      const value = val(bg, 'value').trim();
      if (!name) throw new Error('Укажите имя');
      if (!hosts.length) throw new Error('Укажите домен');
      if (!/^[A-Za-z0-9-]+$/.test(header)) throw new Error('Заголовок — латиница, цифры и «-»');
      if (!keeps && !value) throw new Error('Укажите значение');
      done({ id: s.id, name, hosts: Array.from(new Set(hosts)).join(', '), header, value: value || s.value || '' });
    });
  }

  // ------------------------------------------------------------ регистрация
  CW.page('extensions', { title: 'Расширения', render: extensionsPage });
  CW.page('hooks', { title: 'Хуки', render: hooksPage });
  CW.page('environments', { title: 'Среды', render: environmentsPage });
  CW.nav({ page: 'extensions', label: 'Расширения', icon: 'ext-puzzle', group: 'Claude Code', order: 30 });
  CW.nav({ page: 'hooks', label: 'Хуки', icon: 'ext-bolt', group: 'Claude Code', order: 31 });
  CW.nav({ page: 'environments', label: 'Среды', icon: 'ext-cloud', group: 'Claude Code', order: 32 });

  CW.on('hello', () => { refreshSummary(); });
  // Меню инструментов в поле ввода: что сейчас подключено (на телефоне это — «Расширения»)
  CW.on('composerTools', () => {
    if (!SUM.loaded) { refreshSummary(); return []; }
    const items = [{ sep: true }, { header: 'Расширения' }];
    const names = list => list.slice(0, 4).map(x => x.name).join(', ') + (list.length > 4 ? ` и ещё ${list.length - 4}` : '');
    items.push({ label: `Коннекторы: ${SUM.connectors.length}`, sub: SUM.connectors.length ? names(SUM.connectors) : 'Не подключены — открыть каталог', onClick: () => CW.go('extensions/connectors') });
    items.push({ label: `Навыки: ${SUM.skills.length}`, sub: SUM.skills.length ? 'Claude загружает нужный сам' : 'Нет включённых навыков', onClick: () => CW.go('extensions/skills') });
    if (SUM.commands.length) items.push({ label: `Команды /: ${SUM.commands.length}`, sub: names(SUM.commands.map(c => ({ name: '/' + c.name }))), onClick: () => CW.go('extensions/commands') });
    items.push({ label: 'Агенты, плагины, хуки, среды…', onClick: () => CW.go('extensions/agents') });
    return items;
  });
})();
