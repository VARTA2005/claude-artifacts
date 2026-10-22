/*
 * Раздел «Работа» браузерной версии (API — data/remote/web/WebWorkApi.kt, адреса /api/work/…):
 * #/parallel — параллельные задачи, фоновые команды, слежение за pull request (как «Параллельные задачи»);
 * #/tasks — планы задач чатов; #/generate — изображения и видео отдельными моделями генерации (не моделью чата);
 * #/artifacts — все артефакты с действиями; #/artifact/<id> — артефакт целиком: правка, версии, откат,
 * «Изменить с Claude», публикация ссылкой, удаление; #/project-settings/<id> — подробности проекта.
 */
(function () {
  'use strict';
  const CW = window.CW;
  if (!CW) return;
  const { S, api, h, esc, icon, toast, menu, modal, confirmBox, pageShell, markdown, enhance, fileUrl, size, ago } = CW;

  // ------------------------------------------------------------ значки и оформление
  const ICONS = {
    layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15M20 20v-5h-5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    pr: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2v7.6M18 15.8V9a3 3 0 0 0-3-3h-4M13 4l-2 2 2 2"/>',
    wand: '<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
    diff: '<path d="M12 3v8M8 7h8M8 17h8"/><rect x="3" y="3" width="18" height="18" rx="2.5"/>'
  };
  (function injectIcons() {
    const defs = document.querySelector('svg defs');
    if (!defs) return;
    defs.insertAdjacentHTML('beforeend', Object.entries(ICONS).map(([n, p]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${p}</symbol>`).join(''));
  })();

  document.head.appendChild(h(`<style id="mod-work-css">
    .wk-intro { color: var(--muted); font-size: 14px; margin: -6px 0 6px; }
    .wk-head { display: flex; align-items: center; gap: 8px; margin: 26px 0 8px; }
    .wk-head h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
    .wk-head .btn { padding: 5px 12px; font-size: 13px; }
    .wk-empty { color: var(--muted); font-size: 13.5px; padding: 12px 16px; }
    .wk-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--border); }
    .wk-row:first-child { border-top: 0; }
    .wk-row.link { cursor: pointer; }
    .wk-row.link:hover { background: var(--bg-hover); }
    .wk-row .grow { flex: 1; min-width: 0; }
    .wk-row .t { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wk-row .s { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .wk-row .pv { font-size: 13px; color: var(--text-2); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--serif); }
    .wk-row .mono { font-family: var(--mono); font-size: 12.5px; }
    .wk-st { width: 22px; height: 22px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--ok); }
    .wk-st.bad { color: var(--danger); }
    .wk-st.idle { color: var(--muted); }
    .wk-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--accent-soft); border-top-color: var(--accent); animation: spin .8s linear infinite; flex: none; }
    .wk-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
    .wk-chip { border: 1px solid var(--border); border-radius: 999px; padding: 4px 12px; font-size: 13px; color: var(--text-2); background: var(--bg); }
    .wk-chip:hover { background: var(--bg-hover); }
    .wk-chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
    .wk-select { border: 1px solid var(--border); border-radius: 9px; padding: 5px 8px; background: var(--bg-input); font-size: 13px; max-width: 100%; }
    .wk-plans { display: flex; flex-direction: column; gap: 12px; }
    .wk-plan { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); padding: 14px 16px; cursor: pointer; }
    .wk-plan:hover { border-color: var(--border-strong); }
    .wk-plan.live { border-color: var(--accent); }
    .wk-plan .top { display: flex; align-items: center; gap: 8px; }
    .wk-plan .top .n { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wk-plan .top .c { font-size: 12.5px; color: var(--muted); white-space: nowrap; }
    .wk-plan .top .c.done { color: var(--accent); }
    .wk-bar { height: 4px; border-radius: 2px; background: var(--border); margin: 10px 0 8px; overflow: hidden; }
    .wk-bar > i { display: block; height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s; }
    .wk-todo { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; padding: 2px 0; }
    .wk-todo .ic { width: 16px; height: 16px; flex: none; margin-top: 2px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); }
    .wk-todo.s2 { color: var(--muted); text-decoration: line-through; }
    .wk-todo.s2 .ic { color: var(--accent); }
    .wk-todo.s1 { font-weight: 600; }
    .wk-more { font-size: 12.5px; color: var(--accent); margin-top: 4px; }
    .wk-gen { border: 1px solid var(--border); border-radius: 18px; background: var(--bg-input); box-shadow: var(--shadow); padding: 14px 16px; }
    .wk-gen textarea { width: 100%; border: 0; outline: none; resize: vertical; background: transparent; font-size: 16px; min-height: 76px; display: block; }
    .wk-gen .opts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
    .wk-gen .opts label { font-size: 12.5px; color: var(--muted); display: inline-flex; align-items: center; gap: 6px; }
    .wk-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .wk-media { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--bg-elev); display: flex; flex-direction: column; }
    .wk-media .pic { aspect-ratio: 1 / 1; background: var(--bg-code); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--muted); font-size: 13px; text-align: center; padding: 0; }
    .wk-media .pic img, .wk-media .pic video { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }
    .wk-media .pic video { cursor: default; background: #000; object-fit: contain; }
    .wk-media .meta { padding: 10px 12px 4px; font-size: 13px; }
    .wk-media .meta .p { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .wk-media .meta .m { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .wk-media .acts { display: flex; gap: 2px; padding: 4px 6px 8px; flex-wrap: wrap; }
    .wk-media .err { color: var(--danger); font-size: 12.5px; padding: 12px; white-space: pre-wrap; }
    .wk-art { display: flex; flex-direction: column; min-height: 0; flex: 1; }
    .wk-art-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 14px 20px 10px; border-bottom: 1px solid var(--border); }
    .wk-art-head .ttl { flex: 1 1 260px; min-width: 0; }
    .wk-art-head .ttl input { width: 100%; font-family: var(--serif); font-size: 22px; border: 1px solid transparent; border-radius: 8px; padding: 2px 6px; margin-left: -7px; background: transparent; outline: none; }
    .wk-art-head .ttl input:hover { border-color: var(--border); }
    .wk-art-head .ttl input:focus { border-color: var(--accent); background: var(--bg-input); }
    .wk-art-head .sub { font-size: 12.5px; color: var(--muted); }
    .wk-art-head .sub a { color: var(--muted); }
    .wk-tools { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .wk-tools .btn { padding: 6px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
    .wk-tools .btn svg { width: 15px; height: 15px; }
    .wk-art-body { flex: 1; min-height: 0; display: flex; }
    .wk-art-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
    .wk-art-view { flex: 1; min-height: 0; overflow: auto; }
    .wk-art-view iframe { width: 100%; height: 100%; border: 0; background: #fff; display: block; }
    .wk-art-view .md { padding: 22px 28px; font-family: var(--serif); font-size: 16px; max-width: 860px; }
    .wk-art-view > .codeblock { margin: 16px; }
    .wk-art-view pre.plain { margin: 0; padding: 16px; font: 13px/1.55 var(--mono); white-space: pre; }
    .wk-edit { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .wk-edit textarea { flex: 1; min-height: 300px; border: 0; outline: none; resize: none; padding: 16px; font: 13px/1.55 var(--mono); background: var(--bg-code); tab-size: 2; white-space: pre; }
    .wk-edit .bar { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); align-items: center; flex-wrap: wrap; }
    .wk-edit .bar input { flex: 1 1 200px; }
    .wk-vers { width: 270px; flex: none; border-left: 1px solid var(--border); overflow-y: auto; background: var(--bg-sidebar); }
    .wk-vers h4 { margin: 0; padding: 12px 14px 6px; font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); }
    .wk-ver { padding: 8px 14px; cursor: pointer; border-left: 3px solid transparent; }
    .wk-ver:hover { background: var(--bg-hover); }
    .wk-ver.on { border-left-color: var(--accent); background: var(--bg-active); }
    .wk-ver .v { font-size: 13.5px; font-weight: 500; }
    .wk-ver .d { font-size: 12px; color: var(--muted); }
    .wk-note { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 14px; background: var(--accent-soft); color: var(--text); font-size: 13.5px; border-bottom: 1px solid var(--border); }
    .wk-note .grow { flex: 1; min-width: 160px; }
    .wk-note .btn { padding: 4px 12px; font-size: 13px; }
    .wk-diff { font: 12.5px/1.5 var(--mono); padding: 10px 0; }
    .wk-diff div { padding: 0 14px; white-space: pre-wrap; word-break: break-word; }
    .wk-diff .add { background: rgba(63,125,78,.14); }
    .wk-diff .del { background: var(--danger-soft); text-decoration: line-through; text-decoration-color: rgba(181,59,44,.4); }
    .wk-diff .gap { color: var(--muted); font-style: italic; }
    .wk-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .wk-acts .btn { padding: 5px 10px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; }
    .wk-acts .btn svg { width: 14px; height: 14px; }
    .wk-card-art { cursor: default; }
    .wk-card-art .n { cursor: pointer; }
    .wk-card-art .n:hover { color: var(--accent); }
    .wk-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .wk-save { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 8px; }
    .wk-save .ok { color: var(--accent); font-size: 13px; }
    .wk-journal { font-size: 13px; color: var(--text-2); max-height: 320px; overflow-y: auto; padding: 4px 0; }
    .wk-journal div { padding: 3px 0; border-top: 1px solid var(--border); }
    .wk-journal div:first-child { border-top: 0; }
    .wk-danger { border: 1px solid var(--danger); border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .wk-danger .grow { flex: 1; min-width: 200px; }
    .wk-url { font-family: var(--mono); font-size: 13px; word-break: break-all; background: var(--bg-code); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; }
    .wk-out { max-height: 55vh; min-height: 120px; }
    .modal.wide { max-width: 720px; }
    .wk-check { display: flex; gap: 8px; align-items: center; font-size: 14px; margin: 4px 0 8px; }
    @media (max-width: 860px) {
      .wk-art-body { flex-direction: column; }
      .wk-vers { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 34vh; }
      .wk-art-head { padding: 12px 14px 8px; }
      .wk-field-row { grid-template-columns: 1fr; }
      .wk-gallery { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    }
  </style>`));

  // ------------------------------------------------------------ помощники
  const enc = encodeURIComponent;
  function elapsed(start, end) {
    const s = Math.max(0, Math.round(((end || Date.now()) - start) / 1000));
    if (s < 60) return s + ' с';
    if (s < 3600) return Math.floor(s / 60) + ' мин';
    return Math.floor(s / 3600) + ' ч ' + Math.floor(s % 3600 / 60) + ' мин';
  }
  function dateTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function button(label, cls, onClick, ic, title) {
    const b = h(`<button class="btn${cls ? ' ' + cls : ''}"${title ? ` title="${esc(title)}"` : ''}>${ic ? icon(ic) : ''}${label ? `<span>${esc(label)}</span>` : ''}</button>`);
    if (onClick) b.onclick = e => { e.stopPropagation(); onClick(b, e); };
    return b;
  }
  function iconButton(ic, title, onClick) {
    const b = h(`<button class="icon-btn" title="${esc(title)}">${icon(ic)}</button>`);
    b.onclick = e => { e.stopPropagation(); onClick(b, e); };
    return b;
  }
  function switchEl(on, onChange) {
    const b = h(`<button class="cw-switch${on ? ' on' : ''}" role="switch" aria-checked="${on}"></button>`);
    b.onclick = e => { e.stopPropagation(); const next = !b.classList.contains('on'); b.classList.toggle('on', next); onChange(next); };
    return b;
  }
  /** Кнопка занята, пока идёт запрос */
  async function busy(btn, fn) {
    if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
    try { return await fn(); } catch (e) { toast(e.message); return undefined; } finally { if (btn) { btn.disabled = false; btn.style.opacity = ''; } }
  }
  /** Обновление страницы раз в [ms], пока она открыта */
  function every(el, ms, fn) {
    const route = CW.current();
    const timer = setInterval(() => {
      if (CW.current() !== route || !document.body.contains(el)) { clearInterval(timer); return; }
      if (!document.hidden && !document.querySelector('.modal-bg:not(.leaving)')) fn();
    }, ms);
  }
  function chatTitle(id) { const c = S.chats.find(x => x.id === id); return c ? (c.title || 'Без названия') : ''; }
  function openChat(id) { location.hash = '#/chat/' + enc(id); }
  function projectOptions(selected, withNone) {
    return (withNone !== false ? `<option value="">Без проекта</option>` : '') +
      S.projects.map(p => `<option value="${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  }
  function section(title, actions) {
    const el = h(`<div class="wk-head"><h2>${esc(title)}</h2></div>`);
    (actions || []).filter(Boolean).forEach(a => el.appendChild(a));
    return el;
  }
  /** Текст в поле ввода чата после перехода в чат (поле появляется не сразу) */
  function prefillChat(chatId, text) {
    location.hash = '#/chat/' + enc(chatId);
    let tries = 0;
    const t = setInterval(() => {
      const w = document.querySelector('#composer-box .composer-wrap');
      if (w && w._setText && CW.current().id === chatId) { clearInterval(t); w._setText(text); }
      else if (++tries > 80) clearInterval(t);
    }, 60);
  }

  // ------------------------------------------------------------ параллельные задачи
  function newTaskModal(opts) {
    opts = opts || {};
    modal(`<h3>Новая задача в фоне</h3>
      <p style="font-size:14px">Claude работает над ней в отдельном чате, пока вы заняты другим. Готовность и вопросы Claude появятся здесь и на телефоне.</p>
      <textarea class="field" placeholder="Что сделать? Например: напиши тесты для …" style="min-height:120px">${esc(opts.prompt || '')}</textarea>
      <label style="font-size:13px;color:var(--muted)">Проект</label>
      <select class="field">${projectOptions(opts.projectId || '')}</select>
      <div style="font-size:12.5px;color:var(--muted)">Работает с текущими настройками (режим «Код», разрешения, среда по умолчанию).</div>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Запустить</button></div>`, (bg, close) => {
      const ta = bg.querySelector('textarea'), sel = bg.querySelector('select'), ok = bg.querySelector('[data-ok]');
      bg.querySelector('[data-x]').onclick = close;
      const go = () => busy(ok, async () => {
        const prompt = ta.value.trim();
        if (!prompt) { CW.focusSoft(ta); return; }
        const res = await api('POST', '/api/work/tasks', { prompt, projectId: sel.value });
        close();
        toast('Задача запущена в фоне');
        if (opts.onStarted) opts.onStarted(res.id);
        else if (CW.current().name === 'parallel') CW.rerender();
      });
      ok.onclick = go;
      ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); };
    });
  }

  function watchPrModal(opts) {
    opts = opts || {};
    const chats = S.chats.slice(0, 80);
    const chat = opts.chatId && S.chats.find(c => c.id === opts.chatId);
    const project = chat && chat.projectId && S.projects.find(p => p.id === chat.projectId);
    modal(`<h3>Следить за pull request</h3>
      <p style="font-size:14px">Claude проверяет сборку и комментарии и сам исправляет упавшую сборку. Нужен вход в GitHub на телефоне.</p>
      <div class="wk-field-row"><input class="field" data-repo placeholder="владелец/репозиторий" value="${esc((project && project.repo) || '')}"><input class="field" data-num placeholder="Номер PR, например 12" inputmode="numeric"></div>
      <label style="font-size:13px;color:var(--muted)">Чат, куда приходят события и где Claude исправляет</label>
      <select class="field" data-chat><option value="">Новый чат</option>${chats.map(c => `<option value="${esc(c.id)}"${c.id === opts.chatId ? ' selected' : ''}>${esc(c.title || 'Без названия')}</option>`).join('')}</select>
      <label class="wk-check"><input type="checkbox" checked data-fix> Исправлять самому</label>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Следить</button></div>`, (bg, close) => {
      bg.querySelector('[data-x]').onclick = close;
      const ok = bg.querySelector('[data-ok]');
      ok.onclick = () => busy(ok, async () => {
        let repo = bg.querySelector('[data-repo]').value.trim();
        let num = bg.querySelector('[data-num]').value.trim();
        // Можно вставить ссылку на PR целиком
        const m = repo.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
        if (m) { repo = m[1]; num = num || m[2]; }
        await api('POST', '/api/work/prs/watch', { repo, number: parseInt(num.replace('#', ''), 10) || 0, chatId: bg.querySelector('[data-chat]').value, autofix: bg.querySelector('[data-fix]').checked });
        close();
        toast('Слежение включено');
        if (CW.current().name === 'parallel') CW.rerender();
      });
    });
  }

  function jobOutputModal(job) {
    modal(`<h3 style="display:flex;gap:8px;align-items:center">Фоновая команда #${esc(job.id)}<span class="cw-badge" data-st></span></h3>
      <div class="cw-mono" style="font-size:12.5px;color:var(--muted);margin-bottom:8px;word-break:break-all">${esc(job.command)}</div>
      <div class="cw-term wk-out" data-out>Загружаю…</div>
      <div class="btns"><button class="btn" data-stop>Остановить</button><button class="btn" data-copy>Копировать</button><button class="btn" data-ref>Обновить</button><button class="btn primary" data-x>Закрыть</button></div>`, (bg, close) => {
      bg.querySelector('.modal').classList.add('wide');
      const out = bg.querySelector('[data-out]'), st = bg.querySelector('[data-st]'), stop = bg.querySelector('[data-stop]');
      let text = '', timer = null;
      const load = async () => {
        let res;
        try { res = await api('GET', `/api/work/jobs/${enc(job.id)}/output?lines=400`); } catch (e) { out.textContent = e.message; return; }
        const atEnd = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
        text = res.output || '';
        out.textContent = text || '(пока нет вывода)';
        if (atEnd) out.scrollTop = out.scrollHeight;
        const j = res.job || job;
        st.textContent = j.statusTitle + (j.exitCode != null ? ' · код ' + j.exitCode : '');
        st.className = 'cw-badge ' + (j.status === 'RUNNING' ? 'accent' : j.status === 'DONE' ? 'ok' : 'bad');
        stop.classList.toggle('hidden', j.status !== 'RUNNING');
        if (j.status !== 'RUNNING' && timer) { clearInterval(timer); timer = null; }
      };
      const done = () => { if (timer) clearInterval(timer); close(); };
      bg.querySelector('[data-x]').onclick = done;
      bg.addEventListener('mousedown', e => { if (e.target === bg && timer) clearInterval(timer); });
      bg.querySelector('[data-ref]').onclick = load;
      bg.querySelector('[data-copy]').onclick = () => CW.copy(text);
      stop.onclick = () => busy(stop, async () => { await api('POST', `/api/work/jobs/${enc(job.id)}/stop`); toast('Команда остановлена'); load(); });
      load();
      timer = setInterval(() => { if (!document.body.contains(bg)) { clearInterval(timer); return; } load(); }, 2000);
    });
  }

  function statusIcon(running, failed) {
    if (running) return '<span class="wk-st"><span class="wk-spin"></span></span>';
    return failed ? `<span class="wk-st bad">${icon('x')}</span>` : `<span class="wk-st">${icon('check')}</span>`;
  }

  function parallelPage() {
    const add = button('Новая задача', 'primary', () => newTaskModal(), 'plus');
    const el = pageShell('Параллельные задачи', add);
    const body = el.querySelector('.page-body');
    body.appendChild(h(`<div class="wk-intro">Claude может работать над несколькими задачами сразу: каждая — отдельный чат в фоне. Готовность и вопросы Claude приходят сюда и на телефон. Новая задача — «Новая задача» или «⋯» у чата → «Запустить параллельно».</div>`));
    const box = h('<div><div class="empty">Загружаю…</div></div>');
    body.appendChild(box);
    let data = null, checking = false, lastKey = '';
    const load = async () => {
      let next;
      try { next = await api('GET', '/api/work/tasks'); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; lastKey = ''; return; }
      // Перерисовка — только если что-то изменилось (или идёт работа: растёт время)
      const key = JSON.stringify(next);
      const busyNow = (next.tasks || []).some(t => t.running) || (next.jobs || []).some(j => j.status === 'RUNNING');
      data = next;
      if (key !== lastKey || busyNow) { lastKey = key; draw(); }
    };
    const draw = () => {
      if (!data) return;
      box.innerHTML = '';
      // Задачи
      const tasks = data.tasks || [];
      box.appendChild(section('Задачи', [
        tasks.some(t => !t.running) && button('Убрать завершённые', '', b => busy(b, async () => { await api('POST', '/api/work/tasks/clear'); load(); }))
      ]));
      const tl = h('<div class="cw-list"></div>');
      if (!tasks.length) tl.appendChild(h('<div class="wk-empty">Фоновых задач нет</div>'));
      tasks.forEach(t => {
        const sub = [t.status, t.steps ? 'шагов ' + t.steps : '', t.queued ? 'в очереди ' + t.queued : '', elapsed(t.startedAt, !t.running && t.finishedAt ? t.finishedAt : 0)].filter(Boolean).join(' · ');
        const row = h(`<div class="wk-row link">${statusIcon(t.running, t.failed)}<div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(sub)}</div>${t.preview && t.running ? `<div class="pv">${esc(t.preview.replace(/\s+/g, ' ').slice(-160))}</div>` : ''}</div></div>`);
        row.onclick = () => openChat(t.chatId);
        row.appendChild(t.running
          ? iconButton('stop', 'Остановить', b => busy(b, async () => { await api('POST', `/api/work/tasks/${enc(t.chatId)}/stop`); toast('Остановлено'); load(); }))
          : iconButton('x', 'Убрать из списка', b => busy(b, async () => { await api('POST', `/api/work/tasks/${enc(t.chatId)}/dismiss`); load(); })));
        tl.appendChild(row);
      });
      box.appendChild(tl);

      // Фоновые команды
      const jobs = data.jobs || [];
      box.appendChild(section('Фоновые команды', [
        jobs.some(j => j.status !== 'RUNNING') && button('Убрать завершённые', '', b => busy(b, async () => { await api('POST', '/api/work/jobs/clear'); load(); }))
      ]));
      const jl = h('<div class="cw-list"></div>');
      if (!jobs.length) jl.appendChild(h(`<div class="wk-empty">Нет. Claude запускает долгие сборки и тесты в фоне сам (до ${esc(data.maxJobs || 5)} сразу) и продолжает работу, когда они закончатся.</div>`));
      jobs.forEach(j => {
        const running = j.status === 'RUNNING';
        const sub = [(j.cloud ? 'облако' : 'телефон'), j.statusTitle, j.exitCode != null ? 'код ' + j.exitCode : '', elapsed(j.startedAt, j.finishedAt || 0), j.chatTitle ? 'чат «' + j.chatTitle + '»' : ''].filter(Boolean).join(' · ');
        const row = h(`<div class="wk-row link">${running ? '<span class="wk-st"><span class="wk-spin"></span></span>' : `<span class="wk-st${j.status === 'DONE' ? '' : ' bad'}">${icon('terminal')}</span>`}
          <div class="grow"><div class="t mono">#${esc(j.id)} ${esc(j.command)}</div><div class="s">${esc(sub)}</div></div></div>`);
        row.onclick = () => jobOutputModal(j);
        if (j.url) { const a = h(`<a class="icon-btn" href="${esc(j.url)}" target="_blank" rel="noopener" title="Открыть на GitHub">${icon('open')}</a>`); a.onclick = e => e.stopPropagation(); row.appendChild(a); }
        if (j.chatId) row.appendChild(iconButton('chat', 'Открыть чат', () => openChat(j.chatId)));
        if (running) row.appendChild(iconButton('stop', 'Остановить', b => busy(b, async () => { await api('POST', `/api/work/jobs/${enc(j.id)}/stop`); load(); })));
        jl.appendChild(row);
      });
      box.appendChild(jl);

      // Pull request
      const watches = data.watches || [];
      const check = button(checking ? 'Проверяю…' : 'Проверить сейчас', '', b => {
        if (checking) return;
        checking = true; b.textContent = 'Проверяю…';
        api('POST', '/api/work/prs/check').then(r => toast(r.finished ? 'Проверено' : 'Проверка продолжается на телефоне')).catch(e => toast(e.message))
          .finally(() => { checking = false; load(); });
      }, 'refresh');
      box.appendChild(section('Слежение за pull request', [watches.length && check, button('Следить за PR…', '', () => watchPrModal(), 'pr')]));
      const pl = h('<div class="cw-list"></div>');
      if (!watches.length) pl.appendChild(h(`<div class="wk-empty">Нет. Нажмите «Следить за PR…» или попросите Claude: «следи за pull request #N» — он будет проверять сборку и комментарии и сам исправлять упавшую сборку (до ${esc(data.maxFixAttempts || 3)} попыток).${data.github ? '' : ' Нужен вход в GitHub на телефоне.'}</div>`));
      watches.forEach(w => {
        const open = w.state === 'open';
        const sub = [w.repo, w.status, w.checkedAt ? 'проверено ' + ago(w.checkedAt) : '', w.chatTitle ? 'чат «' + w.chatTitle + '»' : ''].filter(Boolean).join(' · ');
        const row = h(`<div class="wk-row link"><span class="wk-st${open ? '' : ' idle'}">${icon('pr')}</span>
          <div class="grow"><div class="t">#${esc(w.number)} ${esc(w.title || w.repo)}</div><div class="s">${esc(sub)}</div></div></div>`);
        row.onclick = () => openChat(w.chatId);
        if (open) {
          const lab = h(`<span class="cw-sub" style="white-space:nowrap" title="Исправлять упавшую сборку и отвечать на замечания самому">Исправлять самому</span>`);
          row.appendChild(lab);
          row.appendChild(switchEl(w.autofix, on => api('POST', '/api/work/prs/autofix', { key: w.key, on }).catch(e => toast(e.message))));
        }
        const gh = h(`<a class="icon-btn" href="https://github.com/${esc(w.repo)}/pull/${esc(w.number)}" target="_blank" rel="noopener" title="Открыть на GitHub">${icon('open')}</a>`);
        gh.onclick = e => e.stopPropagation();
        row.appendChild(gh);
        row.appendChild(iconButton('x', 'Не следить', b => busy(b, async () => { await api('POST', '/api/work/prs/unwatch', { repo: w.repo, number: w.number }); load(); })));
        pl.appendChild(row);
      });
      box.appendChild(pl);
    };
    load();
    every(el, 3000, load);
    S.pageRedraw = load;
    return el;
  }

  // ------------------------------------------------------------ планы задач
  function plansPage() {
    const el = pageShell('Планы задач');
    const body = el.querySelector('.page-body');
    body.appendChild(h(`<div class="wk-intro">Когда Claude работает над задачей из нескольких шагов, он составляет план. Здесь — последние планы чатов: что выполняется сейчас, что не доделано и что уже готово.</div>`));
    const filters = h('<div class="wk-chips"></div>');
    body.appendChild(filters);
    const list = h('<div class="wk-plans"><div class="empty">Загружаю…</div></div>');
    body.appendChild(list);
    let data = null;
    let showDone = CW.load('wkPlansDone') !== '0';
    let project = CW.load('wkPlansProject') || '*';
    const expanded = new Set();
    const drawFilters = () => {
      filters.innerHTML = '';
      [['0', 'Не завершены'], ['1', 'Все']].forEach(([v, label]) => {
        const b = h(`<button class="wk-chip${(showDone ? '1' : '0') === v ? ' on' : ''}">${label}</button>`);
        b.onclick = () => { showDone = v === '1'; CW.save('wkPlansDone', showDone ? '' : '0'); drawFilters(); draw(); };
        filters.appendChild(b);
      });
      const sel = h(`<select class="wk-select" title="Проект"><option value="*">Все чаты</option><option value="">Чаты без проекта</option>${S.projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>`);
      sel.value = project;
      if (sel.value !== project) { project = '*'; sel.value = '*'; }
      sel.onchange = () => { project = sel.value; CW.save('wkPlansProject', project === '*' ? '' : project); draw(); };
      filters.appendChild(sel);
    };
    const draw = () => {
      if (!data) return;
      let plans = (data.plans || []).map(p => Object.assign(p, { done: p.items.filter(i => i.status === 2).length }));
      plans.forEach(p => { p.finished = p.done === p.items.length; });
      if (project !== '*') plans = plans.filter(p => (p.projectId || '') === project);
      if (!showDone) plans = plans.filter(p => !p.finished);
      plans.sort((a, b) => (a.finished - b.finished) || (b.live - a.live) || (b.updatedAt - a.updatedAt));
      list.innerHTML = '';
      if (!plans.length) {
        list.appendChild(h(`<div class="empty">${icon('checklist', 'style="width:40px;height:40px;color:var(--accent)"')}<div style="margin-top:10px;font-weight:500;color:var(--text)">Задач пока нет</div><div style="font-size:14px;margin-top:4px">Когда Claude работает над задачей из нескольких шагов, он составляет план — он появится здесь.</div></div>`));
        return;
      }
      plans.forEach(p => {
        const state = p.finished ? 'готово' : p.live ? 'в работе' : 'остановлено';
        const card = h(`<div class="wk-plan${p.live && !p.finished ? ' live' : ''}"><div class="top">${p.live && !p.finished ? '<span class="wk-spin"></span>' : ''}<span class="n">${esc(p.title || 'Без названия')}</span>
          <span class="c${p.finished ? ' done' : ''}">${p.done}/${p.items.length} · ${state}</span></div>
          <div class="wk-bar"><i style="width:${p.items.length ? Math.round(p.done * 100 / p.items.length) : 0}%"></i></div><div class="items"></div></div>`);
        const items = card.querySelector('.items');
        const open = expanded.has(p.chatId);
        (open ? p.items : p.items.slice(0, 6)).forEach(i => {
          const ic = i.status === 2 ? icon('check', 'style="width:15px;height:15px"') : i.status === 1 ? '<span class="wk-spin" style="width:12px;height:12px"></span>' : '<svg class="i" style="width:14px;height:14px"><circle cx="12" cy="12" r="8"/></svg>';
          items.appendChild(h(`<div class="wk-todo s${i.status}"><span class="ic">${ic}</span><span>${esc(i.text)}</span></div>`));
        });
        if (p.items.length > 6) {
          const more = h(`<button class="wk-more">${open ? 'Свернуть' : 'Ещё ' + (p.items.length - 6)}</button>`);
          more.onclick = e => { e.stopPropagation(); if (open) expanded.delete(p.chatId); else expanded.add(p.chatId); draw(); };
          items.appendChild(more);
        }
        card.onclick = () => openChat(p.chatId);
        list.appendChild(card);
      });
    };
    const load = async () => {
      try { data = await api('GET', '/api/work/plans'); } catch (e) { list.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      draw();
    };
    drawFilters();
    load();
    every(el, 4000, load);
    S.pageRedraw = () => { drawFilters(); load(); };
    return el;
  }

  // ------------------------------------------------------------ генерация изображений и видео
  const IMAGE_SIZES = [['', 'Размер: авто'], ['1024x1024', 'Квадрат 1024×1024'], ['1536x1024', 'Горизонтально 1536×1024'], ['1024x1536', 'Вертикально 1024×1536'], ['1792x1024', 'Широко 1792×1024'], ['1024x1792', 'Высоко 1024×1792']];
  const QUALITY = [['', 'Качество: авто'], ['low', 'Черновик'], ['medium', 'Среднее'], ['high', 'Высокое']];
  const VIDEO_SIZES = [['', 'Размер: авто'], ['1280x720', 'Горизонтально 1280×720'], ['720x1280', 'Вертикально 720×1280'], ['1792x1024', 'Широко 1792×1024'], ['1024x1792', 'Высоко 1024×1792']];
  const SECONDS = [['', 'Длина: авто'], ['4', '4 секунды'], ['8', '8 секунд'], ['12', '12 секунд']];
  const options = (list, v) => list.map(([id, label]) => `<option value="${esc(id)}"${id === v ? ' selected' : ''}>${esc(label)}</option>`).join('');

  function generatePage(arg) {
    const el = pageShell('Генерация');
    const body = el.querySelector('.page-body');
    body.appendChild(h(`<div class="wk-intro">Изображения и видео создают отдельные модели генерации из настроек телефона («Настройки» → «Генерация изображений и видео»), а не модель чата. Результаты сохраняются на телефоне.</div>`));
    const warn = h('<div></div>');
    body.appendChild(warn);
    let kind = CW.load('wkGenKind') === 'video' ? 'video' : 'image';
    const prefill = S.workPrompt || (arg ? decodeURIComponent(arg) : '');
    S.workPrompt = '';
    const form = h(`<div class="wk-gen">
      <div class="wk-chips" style="margin-bottom:8px"><button class="wk-chip" data-k="image">${icon('image', 'style="width:14px;height:14px;vertical-align:-2px"')} Изображение</button><button class="wk-chip" data-k="video">${icon('video', 'style="width:14px;height:14px;vertical-align:-2px"')} Видео</button></div>
      <textarea placeholder="Опишите, что создать: сюжет, стиль, цвета, ракурс…"></textarea>
      <div class="opts"><span data-o style="display:contents"></span><select class="wk-select" data-model title="Модель генерации"></select><button class="btn" data-models title="Загрузить список моделей сервиса" style="padding:4px 10px;font-size:12.5px">${icon('refresh', 'style="width:14px;height:14px;vertical-align:-2px"')}</button><span style="flex:1"></span><button class="btn accent" data-go>${icon('wand', 'style="width:15px;height:15px;vertical-align:-3px"')} Создать</button></div>
    </div>`);
    body.appendChild(form);
    const ta = form.querySelector('textarea'), go = form.querySelector('[data-go]'), optsBox = form.querySelector('[data-o]'), modelSel = form.querySelector('[data-model]');
    ta.value = prefill;
    let models = null, info = null, choice = { image: { size: '', quality: '', model: '' }, video: { size: '', seconds: '', model: '' } };
    const drawOpts = () => {
      form.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      const c = choice[kind];
      optsBox.innerHTML = kind === 'image'
        ? `<select class="wk-select" data-size>${options(IMAGE_SIZES, c.size)}</select><select class="wk-select" data-q>${options(QUALITY, c.quality)}</select>`
        : `<select class="wk-select" data-size>${options(VIDEO_SIZES, c.size)}</select><select class="wk-select" data-sec>${options(SECONDS, c.seconds)}</select>`;
      optsBox.querySelector('[data-size]').onchange = e => { c.size = e.target.value; };
      const q = optsBox.querySelector('[data-q]'); if (q) q.onchange = e => { c.quality = e.target.value; };
      const s = optsBox.querySelector('[data-sec]'); if (s) s.onchange = e => { c.seconds = e.target.value; };
      const set = info ? (kind === 'image' ? info.imageModel : info.videoModel) : '';
      const def = !set || set === (info && info.auto) ? 'Авто — лучшая у сервиса' : set;
      const list = models ? models[kind] || [] : [];
      modelSel.innerHTML = `<option value="">Модель из настроек (${esc(def)})</option>` + list.map(m => `<option value="${esc(m.id)}"${m.id === c.model ? ' selected' : ''}>${esc(m.name || m.id)}</option>`).join('') +
        (c.model && !list.some(m => m.id === c.model) ? `<option value="${esc(c.model)}" selected>${esc(c.model)}</option>` : '');
      modelSel.onchange = () => { c.model = modelSel.value; };
      ta.placeholder = kind === 'image' ? 'Опишите изображение: сюжет, стиль, цвета, ракурс…' : 'Опишите видео: что происходит, камера, свет, настроение…';
    };
    form.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { kind = b.dataset.k; CW.save('wkGenKind', kind === 'video' ? 'video' : ''); drawOpts(); }; });
    form.querySelector('[data-models]').onclick = e => busy(e.currentTarget, async () => {
      models = await api('GET', '/api/work/media/models');
      drawOpts();
      toast(`Моделей: картинки — ${models.image.length}, видео — ${models.video.length}`);
    });
    const submit = () => busy(go, async () => {
      const prompt = ta.value.trim();
      if (!prompt) { CW.focusSoft(ta); return; }
      const c = choice[kind];
      await api('POST', '/api/work/media', { kind, prompt, size: c.size, quality: c.quality || '', seconds: c.seconds ? parseInt(c.seconds, 10) : undefined, model: c.model });
      toast(kind === 'video' ? 'Видео создаётся — это может занять несколько минут' : 'Рисую…');
      load();
    });
    go.onclick = submit;
    ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); };

    const galleryHead = section('Результаты');
    body.appendChild(galleryHead);
    const gallery = h('<div class="wk-gallery"></div>');
    body.appendChild(gallery);
    let lastKey = '', infoShown = false;
    const load = async () => {
      try { info = await api('GET', '/api/work/media'); } catch (e) { gallery.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      warn.innerHTML = info.configured ? '' : `<div class="err-box" style="margin-bottom:14px">Генерация не настроена. На телефоне: «Настройки» → «Генерация изображений и видео» — укажите адрес OpenAI-совместимого сервиса и ключ.</div>`;
      go.disabled = !info.configured;
      if (!infoShown) { infoShown = true; drawOpts(); }
      const items = info.items || [];
      const key = JSON.stringify(items.map(i => [i.id, i.status, i.progress]));
      if (key === lastKey) return;
      lastKey = key;
      gallery.innerHTML = '';
      if (!items.length) { gallery.appendChild(h('<div class="wk-empty" style="grid-column:1/-1">Здесь появятся созданные изображения и видео.</div>')); return; }
      items.forEach(m => gallery.appendChild(mediaCard(m, load, (p, k) => { kind = k; ta.value = p; drawOpts(); CW.focusSoft(ta); window.scrollTo(0, 0); el.scrollTop = 0; })));
    };
    drawOpts();
    load();
    every(el, 3000, load);
    setTimeout(() => CW.focusSoft(ta), 0);
    return el;
  }

  function mediaCard(m, reload, repeat) {
    const card = h(`<div class="wk-media"><div class="pic"></div><div class="meta"><div class="p">${esc(m.prompt)}</div><div class="m">${esc([m.kind === 'video' ? 'Видео' : 'Изображение', m.model, m.size, dateTime(m.createdAt)].filter(Boolean).join(' · '))}</div></div><div class="acts"></div></div>`);
    const pic = card.querySelector('.pic'), acts = card.querySelector('.acts');
    if (m.status === 'running') {
      pic.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px">${CW.LOGO.replace('<svg', '<svg class="spark"')}<span>${esc(m.progress || 'Создаю…')}</span></div>`;
    } else if (m.status === 'failed') {
      pic.innerHTML = `<div class="err">${esc(m.error || 'Не получилось')}</div>`;
    } else if (!m.exists) {
      pic.innerHTML = '<span>Файла нет на телефоне</span>';
    } else if (m.kind === 'video') {
      pic.innerHTML = `<video controls preload="metadata" src="${esc(fileUrl(m.path))}"></video>`;
    } else {
      const img = h(`<img loading="lazy" alt="${esc(m.prompt)}" src="${esc(fileUrl(m.path))}">`);
      img.onclick = () => CW.lightbox(fileUrl(m.path));
      pic.appendChild(img);
    }
    const small = (label, ic, fn, title) => { const b = button(label, '', fn, ic, title); b.style.cssText = 'padding:4px 8px;font-size:12.5px;display:inline-flex;gap:4px;align-items:center;border:0'; b.querySelector('svg') && (b.querySelector('svg').style.cssText = 'width:14px;height:14px'); return b; };
    if (m.status === 'done' && m.exists) {
      const dl = h(`<a class="btn" style="padding:4px 8px;font-size:12.5px;display:inline-flex;gap:4px;align-items:center;border:0;text-decoration:none;color:inherit" href="${esc(fileUrl(m.path, true))}" title="Скачать ${esc(m.name)} (${esc(size(m.bytes))})">${icon('download', 'style="width:14px;height:14px"')}Скачать</a>`);
      acts.appendChild(dl);
      acts.appendChild(small('В чат', 'chat', () => mediaToChat(m), 'Новый чат с этим файлом'));
    }
    if (m.status !== 'running') {
      acts.appendChild(small('', 'refresh', () => repeat(m.prompt, m.kind), 'Повторить с этим описанием'));
      acts.appendChild(small('', 'trash', () => confirmBox('Удалить результат?', 'Файл будет удалён с телефона.', 'Удалить',
        () => api('POST', `/api/work/media/${enc(m.id)}/delete`).then(reload).catch(e => toast(e.message))), 'Удалить'));
    }
    return card;
  }

  function mediaToChat(m) {
    modal(`<h3>Новый чат с ${m.kind === 'video' ? 'видео' : 'изображением'}</h3>
      <textarea class="field" style="min-height:90px">${esc(m.kind === 'video' ? 'Вот видео. ' : 'Вот изображение: ' + m.prompt + '\n\n')}</textarea>
      <select class="field">${projectOptions('')}</select>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Начать чат</button></div>`, (bg, close) => {
      bg.querySelector('[data-x]').onclick = close;
      const ok = bg.querySelector('[data-ok]');
      ok.onclick = () => busy(ok, async () => {
        const res = await api('POST', '/api/chats', { text: bg.querySelector('textarea').value.trim(), files: [m.path], projectId: bg.querySelector('select').value });
        close();
        openChat(res.id);
      });
    });
  }

  // ------------------------------------------------------------ артефакты: список
  function previewable(lang, content) {
    lang = (lang || '').toLowerCase();
    if (['html', 'htm', 'svg', 'markdown', 'md'].includes(lang)) return true;
    if (lang === 'xml') return /^\s*<svg/i.test(content || '');
    return /^\s*(<!doctype html|<html|<svg)/i.test(content || '');
  }

  function editWithClaude(a) {
    const chat = S.chats.find(c => c.id === a.chatId);
    const text = `Измени артефакт «${a.title}» (id ${a.id}): `;
    if (chat) { prefillChat(a.chatId, text); return; }
    toast('Чат этого артефакта удалён — изменения через Claude недоступны. Можно править вручную в редакторе.');
  }

  function artifactsPage() {
    const el = pageShell('Артефакты');
    const body = el.querySelector('.page-body');
    body.innerHTML = '<div class="empty">Загружаю…</div>';
    api('GET', '/api/artifacts').then(res => {
      const list = res.artifacts || [];
      body.innerHTML = '';
      if (!list.length) {
        body.appendChild(h(`<div class="empty">${icon('artifact', 'style="width:40px;height:40px;color:var(--accent)"')}<div style="margin-top:10px;font-weight:500;color:var(--text)">Артефактов пока нет</div><div style="font-size:14px;margin-top:4px">Сюда попадают веб-страницы, SVG, документы и программы, которые создаёт Claude. Каждое изменение сохраняется новой версией — к любой можно вернуться.</div></div>`));
        return;
      }
      const tools = h(`<div class="wk-chips"><div class="search-box" style="margin:0;flex:1 1 260px">${icon('search')}<input placeholder="Поиск артефактов…"></div><select class="wk-select" title="Вид"></select></div>`);
      body.appendChild(tools);
      const langs = [...new Set(list.map(a => (a.language || 'text').toLowerCase()))].sort();
      const sel = tools.querySelector('select');
      sel.innerHTML = '<option value="">Все виды</option>' + langs.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
      const grid = h('<div class="grid"></div>');
      body.appendChild(grid);
      const input = tools.querySelector('input');
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        const lang = sel.value;
        grid.innerHTML = '';
        const shown = list.filter(a => (!q || a.title.toLowerCase().includes(q) || chatTitle(a.chatId).toLowerCase().includes(q)) && (!lang || (a.language || 'text').toLowerCase() === lang));
        if (!shown.length) grid.appendChild(h('<div class="wk-empty">Ничего не найдено</div>'));
        shown.forEach(a => {
          const card = h(`<div class="card wk-card-art"><div class="n">${esc(a.title)}</div><div class="d">${esc(chatTitle(a.chatId) || 'Чат удалён')}</div>
            <div class="s">${icon('code', 'style="width:13px;height:13px"')} ${esc(a.language)}${a.version > 1 ? ' · версия ' + a.version : ''} · ${esc(size(a.size))} · ${esc(ago(a.updatedAt))}</div><div class="wk-acts"></div></div>`);
          card.querySelector('.n').onclick = () => CW.go('artifact/' + a.id);
          const acts = card.querySelector('.wk-acts');
          const small = (label, ic, fn) => acts.appendChild(button(label, '', fn, ic));
          small('Открыть', 'open', () => CW.go('artifact/' + a.id));
          small('Изменить с Claude', 'edit', () => editWithClaude(a));
          if (a.version > 1) small('История версий', 'history', () => CW.go('artifact/' + a.id + '/history'));
          small('', 'artifact', async () => {
            try { const full = await api('GET', '/api/artifacts/' + enc(a.id)); CW.showPanel(Object.assign({ id: a.id }, full)); } catch (e) { toast(e.message); }
          }).title = 'Просмотр сбоку';
          grid.appendChild(card);
        });
      };
      input.oninput = draw;
      sel.onchange = draw;
      draw();
      S.pageRedraw = draw;
    }).catch(e => { body.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; });
    return el;
  }

  // ------------------------------------------------------------ артефакт целиком
  /** Построчное сравнение (наибольшая общая подпоследовательность), показ изменений с окрестностью */
  function diffLines(a, b) {
    const A = a.split('\n'), B = b.split('\n');
    if (A.length * B.length > 4000000) return null;
    const n = A.length, m = B.length;
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push([' ', A[i]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', A[i++]]);
      else out.push(['+', B[j++]]);
    }
    while (i < n) out.push(['-', A[i++]]);
    while (j < m) out.push(['+', B[j++]]);
    return out;
  }

  function diffView(from, to) {
    const d = diffLines(from, to);
    const box = h('<div class="wk-diff"></div>');
    if (!d) { box.appendChild(h('<div class="gap">Слишком большой файл для сравнения в браузере</div>')); return box; }
    const near = new Uint8Array(d.length);
    d.forEach((x, k) => { if (x[0] !== ' ') for (let q = Math.max(0, k - 3); q <= Math.min(d.length - 1, k + 3); q++) near[q] = 1; });
    let skipped = 0, changes = 0;
    const flush = () => { if (skipped) { box.appendChild(h(`<div class="gap">… без изменений: ${skipped} строк</div>`)); skipped = 0; } };
    d.forEach((x, k) => {
      if (!near[k]) { skipped++; return; }
      flush();
      if (x[0] !== ' ') changes++;
      box.appendChild(h(`<div class="${x[0] === '+' ? 'add' : x[0] === '-' ? 'del' : ''}">${esc(x[0] + ' ' + x[1]) || ' '}</div>`));
    });
    flush();
    if (!changes) box.innerHTML = '<div class="gap">Версии совпадают</div>';
    return box;
  }

  function codeView(content, lang) {
    // Подсветка и кнопки — через разбор Markdown основы; код с собственными ограждениями — простым текстом
    if (/(^|\n)\s*(```|~~~)/.test(content) || content.length > 200000) return h(`<pre class="plain">${esc(content)}</pre>`);
    const wrap = h('<div></div>');
    wrap.innerHTML = markdown('```' + (lang || '') + '\n' + content + '\n```');
    enhance(wrap);
    return wrap.firstElementChild || h(`<pre class="plain">${esc(content)}</pre>`);
  }

  function previewView(content, lang) {
    lang = (lang || '').toLowerCase();
    if (lang === 'markdown' || lang === 'md') {
      const md = h('<div class="md"></div>');
      md.innerHTML = markdown(content);
      enhance(md);
      return md;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
    frame.srcdoc = /^\s*<svg/i.test(content) && !/<html/i.test(content)
      ? `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${content}</body></html>`
      : content;
    return frame;
  }

  function publishModal(a, onChange) {
    let url = a.published || '';
    modal(`<h3 data-h></h3><div data-b></div><div class="err-box hidden" data-e style="margin-top:8px"></div><div class="btns" data-btns></div>`, (bg, close) => {
      const draw = (busyText) => {
        bg.querySelector('[data-h]').textContent = url ? 'Артефакт опубликован' : 'Опубликовать ссылкой?';
        const b = bg.querySelector('[data-b]');
        if (!a.github) {
          b.innerHTML = '<p>Чтобы публиковать, войдите в GitHub на телефоне («Настройки» → «Войти через GitHub»).</p>';
        } else if (!url) {
          b.innerHTML = '<p>Страница появится в открытом репозитории claude-artifacts вашего GitHub и откроется по ссылке у любого, кому вы её отправите (через GitHub Pages). Не публикуйте личные данные. Повторная публикация обновит ту же ссылку.</p>';
        } else {
          b.innerHTML = `<div class="wk-url">${esc(url)}</div><p style="font-size:13px;color:var(--muted)">Первое открытие — через 1–2 минуты после публикации. После изменений артефакта нажмите «Обновить».</p>`;
        }
        if (busyText) b.appendChild(h(`<div class="live-status">${CW.LOGO.replace('<svg', '<svg class="spark"')}${esc(busyText)}</div>`));
        const btns = bg.querySelector('[data-btns]');
        btns.innerHTML = '';
        if (url) {
          btns.appendChild(button('Снять с публикации', 'danger', () => run('Снимаю…', async () => { await api('POST', `/api/work/artifacts/${a.id}/unpublish`); url = ''; })));
          btns.appendChild(button('Копировать', '', () => CW.copy(url)));
          btns.appendChild(button('Открыть', '', () => window.open(url, '_blank', 'noopener')));
        }
        btns.appendChild(button('Закрыть', '', close));
        if (a.github) btns.appendChild(button(url ? 'Обновить' : 'Опубликовать', 'primary', () => run('Публикую…', async () => { url = (await api('POST', `/api/work/artifacts/${a.id}/publish`)).url; })));
        btns.querySelectorAll('button').forEach(x => { x.disabled = !!busyText; });
      };
      const run = async (text, fn) => {
        const e = bg.querySelector('[data-e]');
        e.classList.add('hidden');
        draw(text);
        try { await fn(); onChange && onChange(url); } catch (err) { e.textContent = err.message; e.classList.remove('hidden'); }
        draw();
      };
      draw();
    });
  }

  function artifactPage(arg) {
    const [idText, mode] = String(arg || '').split('/');
    if (!idText) return artifactsPage();
    const id = parseInt(idText, 10);
    const view = h(`<div class="wk-art"><div class="empty">Загружаю…</div></div>`);
    let a = null, tab = 'preview', shown = null, dirty = false, showHistory = mode === 'history' || CW.load('wkArtHistory') === '1', compare = false;
    let draft = null, note = '';
    const load = async (keepTab) => {
      try { a = await api('GET', `/api/work/artifacts/${id}`); } catch (e) { view.innerHTML = `<div class="scroll"><div class="column page"><div class="err-box">${esc(e.message)}</div><p><a href="#/artifacts">← Все артефакты</a></p></div></div>`; return; }
      if (!keepTab) tab = previewable(a.language, a.content) ? 'preview' : 'code';
      if (shown === a.version) shown = null;
      draw();
    };
    const content = () => shown == null ? a.content : ((a.versions.find(v => v.version === shown) || {}).content || '');
    const save = async (btn) => {
      const title = view.querySelector('[data-title]').value.trim() || a.title;
      await busy(btn, async () => {
        const res = await api('POST', `/api/work/artifacts/${id}/save`, { content: draft != null ? draft : a.content, title, note });
        const changed = res.version !== a.version;
        a = res; draft = null; note = ''; dirty = false; shown = null;
        if (tab === 'edit') tab = previewable(a.language, a.content) ? 'preview' : 'code';
        toast(changed ? 'Сохранено: версия ' + a.version : 'Сохранено');
        draw();
      });
    };
    const draw = () => {
      CW.S.pageRedraw = null;
      const versions = (a.versions || []).slice().sort((x, y) => y.version - x.version);
      const cur = content();
      const canPreview = previewable(a.language, cur);
      if (tab === 'preview' && !canPreview) tab = 'code';
      const chatLink = a.chatExists ? `<a href="#/chat/${enc(a.chatId)}">${esc(a.chatTitle || 'Чат')}</a>` : 'чат удалён';
      view.innerHTML = `
        <div class="wk-art-head">
          <div class="ttl"><input data-title value="${esc(a.title)}" maxlength="200" title="Название — изменить">
            <div class="sub">${esc(a.language)} · версия ${a.version}${versions.length > 1 ? ' из ' + versions.length : ''} · ${esc(ago(a.updatedAt || a.createdAt))} · ${chatLink}${a.published ? ' · <a href="' + esc(a.published) + '" target="_blank" rel="noopener">опубликован</a>' : ''}</div></div>
          <div class="tabs">${canPreview ? '<button data-tab="preview">Просмотр</button>' : ''}<button data-tab="code">Код</button><button data-tab="edit">Правка</button></div>
          <div class="wk-tools" data-tools></div>
        </div>
        <div class="wk-art-body"><div class="wk-art-main"><div data-note></div><div class="wk-art-view" data-view></div></div>${showHistory ? '<div class="wk-vers" data-vers></div>' : ''}</div>`;
      const titleInput = view.querySelector('[data-title]');
      titleInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); titleInput.blur(); } if (e.key === 'Escape') { titleInput.value = a.title; titleInput.blur(); } };
      titleInput.onchange = () => { if (titleInput.value.trim() && titleInput.value.trim() !== a.title && tab !== 'edit') save(null); };
      view.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('on', b.dataset.tab === tab);
        b.onclick = () => { if (tab === 'edit' && dirty && b.dataset.tab !== 'edit') { confirmBox('Не сохранять правку?', 'Изменения в редакторе пропадут.', 'Не сохранять', () => { draft = null; dirty = false; tab = b.dataset.tab; draw(); }); return; } tab = b.dataset.tab; compare = false; draw(); };
      });
      const tools = view.querySelector('[data-tools]');
      tools.appendChild(button('', '', () => CW.copy(cur), 'copy', 'Копировать'));
      tools.appendChild(button('', '', () => CW.download(a.title, a.language, cur), 'download', 'Скачать'));
      tools.appendChild(button(versions.length > 1 ? 'Версии (' + versions.length + ')' : 'Версии', showHistory ? 'on' : '', () => { showHistory = !showHistory; CW.save('wkArtHistory', showHistory ? '1' : ''); draw(); }, 'history'));
      if (a.chatExists) tools.appendChild(button('Изменить с Claude', '', () => editWithClaude(a), 'edit'));
      tools.appendChild(button(a.published ? 'Ссылка' : 'Опубликовать', '', () => publishModal(a, url => { a.published = url || null; draw(); }), 'globe'));
      tools.appendChild(button('', '', (b) => menu(b, [
        { label: 'Просмотр сбоку', sub: 'Открыть рядом с чатом', onClick: () => CW.showPanel({ id: a.id, title: a.title, language: a.language, content: a.content, versions: a.versions, version: a.version }) },
        a.chatExists ? { label: 'Открыть чат артефакта', onClick: () => openChat(a.chatId) } : null,
        { label: 'Все артефакты', onClick: () => CW.go('artifacts') },
        { sep: true },
        { label: 'Удалить артефакт', danger: true, onClick: () => confirmBox('Удалить артефакт?', `«${a.title}» и все его версии будут удалены. Сообщение в чате останется.`, 'Удалить',
          () => api('POST', `/api/work/artifacts/${id}/delete`).then(() => { toast('Артефакт удалён'); CW.go('artifacts'); }).catch(e => toast(e.message))) }
      ].filter(Boolean), { alignRight: true }), 'dots', 'Ещё'));

      const noteBox = view.querySelector('[data-note]');
      if (shown != null && tab !== 'edit') {
        const v = a.versions.find(x => x.version === shown) || {};
        const bar = h(`<div class="wk-note"><span class="grow">Вы смотрите версию ${shown} из ${a.version}${v.note ? ' — ' + esc(v.note) : ''} · ${esc(dateTime(v.createdAt))}</span></div>`);
        bar.appendChild(button(compare ? 'Скрыть сравнение' : 'Сравнить с текущей', '', () => { compare = !compare; draw(); }, 'diff'));
        bar.appendChild(button('Вернуть эту версию', 'primary', b => busy(b, async () => {
          a = await api('POST', `/api/work/artifacts/${id}/restore`, { version: shown });
          shown = null; compare = false; toast('Возвращена версия — сохранена как версия ' + a.version); draw();
        })));
        bar.appendChild(button('К текущей', '', () => { shown = null; compare = false; draw(); }));
        noteBox.appendChild(bar);
      }
      const box = view.querySelector('[data-view]');
      if (tab === 'edit') {
        box.style.display = 'flex';
        const ed = h(`<div class="wk-edit"><textarea spellcheck="false"></textarea><div class="bar"><input class="cw-field" placeholder="Что изменено (необязательно)" maxlength="120"><span class="cw-sub" data-st></span></div></div>`);
        const t = ed.querySelector('textarea'), n = ed.querySelector('input'), st = ed.querySelector('[data-st]');
        t.value = draft != null ? draft : cur;
        n.value = note;
        if (shown != null) st.textContent = 'Правка на основе версии ' + shown;
        t.oninput = () => { draft = t.value; dirty = draft !== a.content; st.textContent = dirty ? 'Есть несохранённые изменения' : ''; };
        n.oninput = () => { note = n.value; };
        t.onkeydown = e => {
          if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); t.oninput(); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(saveBtn); }
        };
        const bar = ed.querySelector('.bar');
        bar.appendChild(button('Отмена', '', () => { draft = null; dirty = false; note = ''; tab = previewable(a.language, a.content) ? 'preview' : 'code'; draw(); }));
        const saveBtn = button('Сохранить версию', 'primary', b => save(b), 'save', 'Ctrl+S');
        bar.appendChild(saveBtn);
        if (shown != null && draft == null) { draft = cur; dirty = cur !== a.content; }
        box.appendChild(ed);
        setTimeout(() => CW.focusSoft(t), 0);
      } else if (compare && shown != null) {
        box.appendChild(diffView(cur, a.content));
      } else if (tab === 'preview') {
        box.appendChild(previewView(cur, a.language));
      } else {
        box.appendChild(codeView(cur, (a.language || '').toLowerCase()));
      }

      const vers = view.querySelector('[data-vers]');
      if (vers) {
        vers.appendChild(h('<h4>История версий</h4>'));
        if (!versions.length) vers.appendChild(h('<div class="wk-empty">Одна версия</div>'));
        versions.forEach(v => {
          const isCur = v.version === a.version;
          const on = shown == null ? isCur : v.version === shown;
          const row = h(`<div class="wk-ver${on ? ' on' : ''}"><div class="v">Версия ${v.version}${isCur ? ' (текущая)' : ''}</div><div class="d">${esc(v.note || 'Изменён')} · ${esc(dateTime(v.createdAt))}</div></div>`);
          row.onclick = () => {
            if (tab === 'edit' && dirty) { toast('Сначала сохраните или отмените правку'); return; }
            shown = isCur ? null : v.version;
            if (tab === 'edit') tab = 'code';
            draw();
          };
          vers.appendChild(row);
        });
      }
    };
    load();
    // Claude мог изменить артефакт — обновляем, если пользователь ничего не правит
    every(view, 5000, async () => {
      if (!a || tab === 'edit' || dirty || shown != null) return;
      let next;
      try { next = await api('GET', `/api/work/artifacts/${id}`); } catch (e) { return; }
      if (next.version !== a.version || next.title !== a.title || next.published !== a.published) { a = next; draw(); }
    });
    return view;
  }

  // ------------------------------------------------------------ проекты
  function projectsRepoModal() {
    modal(`<h3>Репозиторий проектов</h3><div data-b><div class="empty" style="padding:16px 0">Загружаю…</div></div>`, async (bg, close) => {
      let info;
      const b = bg.querySelector('[data-b]');
      try { info = await api('GET', '/api/work/projects/repo'); } catch (e) { b.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      const draw = () => {
        b.innerHTML = `<p style="font-size:14px">Каждый проект — отдельная папка в этом репозитории: у проекта свои чаты и своя память, другие проекты он не видит. Пустой репозиторий — новые проекты только на телефоне.</p>
          <input class="field" data-repo placeholder="владелец/имя" value="${esc(info.repo)}"><input class="field" data-branch placeholder="Ветка" value="${esc(info.branch)}">
          ${info.repo && !info.github ? '<div class="err-box" style="margin-bottom:10px">Войдите в GitHub на телефоне («Код» → «GitHub» → «Войти через GitHub»), чтобы проекты загружались и отправлялись.</div>' : ''}
          <div data-folders></div>
          <div class="btns"><button class="btn" data-x>Закрыть</button><button class="btn primary" data-ok>Сохранить</button></div>`;
        const f = b.querySelector('[data-folders]');
        if (info.error) f.appendChild(h(`<div class="err-box" style="margin-bottom:10px">${esc(info.error)}</div>`));
        if ((info.folders || []).length) {
          f.appendChild(h(`<div style="font-size:13px;font-weight:600;margin:4px 0 6px">Папки в ${esc(info.repo)} без проекта</div>`));
          const list = h('<div class="cw-list" style="max-height:30vh;overflow-y:auto;margin-bottom:8px"></div>');
          info.folders.forEach(name => {
            const row = h(`<div class="wk-row"><span class="wk-st idle">${icon('folder')}</span><div class="grow mono">${esc(name)}</div></div>`);
            row.appendChild(button('Добавить', '', btn => busy(btn, async () => {
              const res = await api('POST', '/api/work/projects/new', { name, folder: name });
              if (res.note) toast(res.note);
              close();
              location.hash = '#/project/' + enc(res.id);
            })));
            list.appendChild(row);
          });
          f.appendChild(list);
        }
        b.querySelector('[data-x]').onclick = close;
        const ok = b.querySelector('[data-ok]');
        ok.onclick = () => busy(ok, async () => {
          info = await api('POST', '/api/work/projects/repo', { repo: b.querySelector('[data-repo]').value.trim(), branch: b.querySelector('[data-branch]').value.trim() });
          toast('Сохранено');
          draw();
        });
      };
      draw();
    });
  }

  function newFolderProjectModal() {
    modal(`<h3>Новый проект</h3><div data-b><div class="empty" style="padding:16px 0">Загружаю…</div></div>`, async (bg, close) => {
      const b = bg.querySelector('[data-b]');
      let info = { repo: '' };
      try { info = await api('GET', '/api/work/projects/repo'); } catch (e) { /* без репозитория */ }
      b.innerHTML = `<input class="field" data-name placeholder="Название" maxlength="80"><textarea class="field" data-desc placeholder="Описание (необязательно)"></textarea>
        ${info.repo ? `<input class="field" data-folder placeholder="Папка в ${esc(info.repo)} (пусто — только на телефоне)"><div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">Если такая папка уже есть — её файлы загрузятся; если нет — она будет создана (с README.md).</div>` : ''}
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`;
      const name = b.querySelector('[data-name]'), folder = b.querySelector('[data-folder]');
      CW.focusSoft(name);
      if (folder) name.oninput = () => { if (!folder.dataset.touched) folder.value = name.value.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, ''); };
      if (folder) folder.oninput = () => { folder.dataset.touched = '1'; };
      b.querySelector('[data-x]').onclick = close;
      const ok = b.querySelector('[data-ok]');
      ok.onclick = () => busy(ok, async () => {
        if (!name.value.trim()) { CW.focusSoft(name); return; }
        const res = await api('POST', '/api/work/projects/new', { name: name.value.trim(), description: b.querySelector('[data-desc]').value.trim(), folder: folder ? folder.value.trim() : '' });
        if (res.note) toast(res.note);
        close();
        location.hash = '#/project/' + enc(res.id);
      });
    });
  }

  function projectSettingsPage(id) {
    const el = pageShell('Проект');
    const body = el.querySelector('.page-body');
    body.innerHTML = '<div class="empty">Загружаю…</div>';
    let p = null;
    const saveState = {};
    const load = async () => {
      try { p = await api('GET', `/api/work/projects/${enc(id)}`); } catch (e) { body.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      draw();
    };
    const savedMark = (key, box) => { saveState[key] = true; const s = box.querySelector('.ok'); if (s) s.textContent = 'Сохранено'; };
    const draw = () => {
      el.querySelector('.page-head h1').textContent = p.name;
      document.querySelector('#crumb').innerHTML = `<a href="#/projects" style="color:inherit;text-decoration:none">Проекты</a> / <a href="#/project/${enc(p.id)}" style="color:inherit;text-decoration:none">${esc(p.name)}</a> /`;
      document.querySelector('#title').textContent = 'Настройки';
      body.innerHTML = '';
      const top = h(`<div class="wk-chips"></div>`);
      top.appendChild(button('Чаты проекта (' + p.chats + ')', '', () => { location.hash = '#/project/' + enc(p.id); }, 'chat'));
      top.appendChild(button('Новая задача в фоне', '', () => newTaskModal({ projectId: p.id }), 'layers'));
      body.appendChild(top);

      // Основное
      body.appendChild(h('<div class="cw-section">Основное</div>'));
      const main = h(`<div class="cw-form"><label>Название<input class="cw-field" data-name maxlength="80"></label><label>Описание<textarea class="cw-field" data-desc style="min-height:70px"></textarea></label><div class="wk-save"><span class="ok"></span></div></div>`);
      main.querySelector('[data-name]').value = p.name;
      main.querySelector('[data-desc]').value = p.description;
      main.querySelector('.wk-save').appendChild(button('Сохранить', 'primary', b => busy(b, async () => {
        p = await api('POST', `/api/work/projects/${enc(id)}/save`, { name: main.querySelector('[data-name]').value, description: main.querySelector('[data-desc]').value });
        draw(); toast('Сохранено');
      })));
      body.appendChild(main);

      // Инструкции
      body.appendChild(h('<div class="cw-section">Инструкции проекта</div>'));
      body.appendChild(h('<div class="cw-sub" style="margin-bottom:6px">Добавляются ко всем чатам проекта.</div>'));
      const ins = h(`<div><textarea class="cw-field" style="min-height:130px" placeholder="Например: отвечай кратко, пиши код на Kotlin…"></textarea><div class="wk-save"><span class="ok"></span></div></div>`);
      const insTa = ins.querySelector('textarea');
      insTa.value = p.instructions;
      insTa.oninput = () => { ins.querySelector('.ok').textContent = ''; };
      ins.querySelector('.wk-save').appendChild(button('Сохранить', 'primary', b => busy(b, async () => {
        p = await api('POST', `/api/work/projects/${enc(id)}/save`, { instructions: insTa.value });
        savedMark('ins', ins);
      })));
      body.appendChild(ins);

      // Память и журнал
      body.appendChild(h('<div class="cw-section">Память проекта</div>'));
      body.appendChild(h('<div class="cw-sub" style="margin-bottom:6px">Claude видит её в каждом чате проекта — и в обычном, и в «Коде» — и дополняет сам. Журнал работы ведётся автоматически после каждого ответа.</div>'));
      const mem = h(`<div><textarea class="cw-field" style="min-height:130px" placeholder="Пока пусто: стек, структура, решения и пожелания по проекту"></textarea><div class="wk-save"><span class="ok"></span></div></div>`);
      const memTa = mem.querySelector('textarea');
      memTa.value = p.memory;
      memTa.oninput = () => { mem.querySelector('.ok').textContent = ''; };
      mem.querySelector('.wk-save').appendChild(button('Сохранить', 'primary', b => busy(b, async () => {
        p = await api('POST', `/api/work/projects/${enc(id)}/memory`, { text: memTa.value });
        savedMark('mem', mem);
      })));
      body.appendChild(mem);
      const journal = p.journal || [];
      const fold = h(`<details class="fold" style="margin-top:10px"><summary>${icon('chev', 'class="i chev" style="width:14px;height:14px"')}Журнал работы (${journal.length})</summary><div class="fold-body"><div class="wk-journal"></div></div></details>`);
      const jl = fold.querySelector('.wk-journal');
      if (!journal.length) jl.appendChild(h('<div>Журнал пуст</div>'));
      journal.forEach(line => jl.appendChild(h(`<div>• ${esc(line)}</div>`)));
      if (journal.length) {
        const clear = button('Очистить журнал', '', () => confirmBox('Очистить журнал?', 'Claude перестанет видеть историю работы над проектом. Память проекта останется.', 'Очистить',
          () => api('POST', `/api/work/projects/${enc(id)}/journal-clear`).then(r => { p = r; draw(); }).catch(e => toast(e.message))));
        clear.style.marginTop = '8px';
        fold.querySelector('.fold-body').appendChild(clear);
      }
      body.appendChild(fold);

      // GitHub и текущий проект
      body.appendChild(h('<div class="cw-section">GitHub и «Код»</div>'));
      const gh = h('<div class="cw-list"></div>');
      const repoRow = h(`<div class="cw-item"><div class="grow"><div class="cw-label">${p.repo ? esc(p.repo + (p.path ? '/' + p.path : '')) : 'Репозиторий не подключён'}</div>
        <div class="cw-sub">${p.repo ? 'ветка ' + esc(p.branch) + ' · синхронизация — в разделе «Код» (выберите этот проект)' : 'Проект хранится только на телефоне. Подключить репозиторий — в разделе «Код» → «GitHub».'}</div></div></div>`);
      if (p.repo) repoRow.appendChild(button('Отключить', '', () => confirmBox('Отключить репозиторий?', 'Файлы на телефоне останутся, отправка на GitHub прекратится.', 'Отключить',
        () => api('POST', `/api/work/projects/${enc(id)}/unlink`).then(r => { p = r; draw(); }).catch(e => toast(e.message)))));
      gh.appendChild(repoRow);
      const act = h(`<div class="cw-item"><div class="grow"><div class="cw-label">Текущий проект</div><div class="cw-sub">С ним работают «Код», «Планы задач» на телефоне и новые фоновые задачи по умолчанию</div></div></div>`);
      act.appendChild(switchEl(p.active, on => api('POST', `/api/work/projects/${enc(id)}/activate`, { on }).then(r => { p = r; }).catch(e => toast(e.message))));
      gh.appendChild(act);
      gh.appendChild(h(`<div class="cw-item"><div class="grow"><div class="cw-label">Содержимое</div><div class="cw-sub">Чатов: ${p.chats} · артефактов: ${p.artifacts} · создан ${esc(dateTime(p.createdAt))}</div></div></div>`));
      body.appendChild(gh);

      // Удаление
      body.appendChild(h('<div class="cw-section" style="color:var(--danger)">Удаление</div>'));
      const danger = h(`<div class="wk-danger"><div class="grow"><div class="cw-label">Удалить проект</div><div class="cw-sub">Чаты проекта останутся в общем списке, инструкции и память будут удалены.</div></div></div>`);
      danger.appendChild(button('Удалить проект', 'danger', () => confirmBox('Удалить проект?', `«${p.name}»: чаты останутся в общем списке, инструкции будут удалены.`, 'Удалить',
        () => api('POST', `/api/work/projects/${enc(id)}/delete`).then(() => { toast('Проект удалён'); CW.go('projects'); }).catch(e => toast(e.message)))));
      body.appendChild(danger);
    };
    load();
    return el;
  }

  // ------------------------------------------------------------ фоновые задачи чата (как в Claude Code)
  // Над полем ввода в чате — строка «⟳ 2 фоновые задачи»: команды, которые Claude запустил с background=true.
  // Нажатие — окно со списком: ход работы, время, живой вывод, «Остановить», «Убрать завершённые».
  let bgJobs = [], bgTimer = null, bgSheet = null;
  const bgChat = () => (S.route.name === 'chat' ? S.route.id : null);
  const bgMine = () => { const id = bgChat(); return id ? bgJobs.filter(j => j.chatId === id) : []; };
  const tasksWord = n => {
    const m10 = n % 10, m100 = n % 100;
    return n + (m10 === 1 && m100 !== 11 ? ' фоновая задача' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ' фоновые задачи' : ' фоновых задач');
  };
  const dur = (a, b) => {
    const s = Math.max(0, Math.round(((b || Date.now()) - a) / 1000));
    return s < 60 ? s + ' с' : s < 3600 ? Math.floor(s / 60) + ' мин ' + (s % 60) + ' с' : Math.floor(s / 3600) + ' ч ' + Math.floor(s % 3600 / 60) + ' мин';
  };
  async function bgRefresh() {
    if (document.hidden || (!document.querySelector('.cw-jobs-bar') && !bgSheet)) return;
    try { bgJobs = (await api('GET', '/api/work/tasks')).jobs || []; } catch (e) { return; }
    document.querySelectorAll('.cw-jobs-bar').forEach(bgDrawBar);
    if (bgSheet) bgDrawSheet();
  }
  function bgDrawBar(bar) {
    const list = bgMine(), running = list.filter(j => j.status === 'RUNNING').length;
    bar.classList.toggle('hidden', !list.length);
    if (!list.length) return;
    bar.innerHTML = (running ? '<span class="cw-spin"></span>' : icon('check')) +
      `<span>${esc(tasksWord(running || list.length))} · ${running ? 'выполняется' : 'готово'}</span>${icon('chev', 'style="transform:rotate(-90deg);width:14px;height:14px"')}`;
  }
  function bgOpen() {
    bgSheet = { open: {}, out: {} };
    const close = modal(`<div class="cw-jobs"><div class="jh"><h3>Фоновые задачи</h3><button class="btn" data-clear>Убрать завершённые</button><button class="icon-btn" data-x title="Закрыть">${icon('x')}</button></div>
      <p class="jsub">Команды, которые Claude запустил в фоне. Когда команда закончится, Claude сам продолжит работу в этом чате.</p><div data-list></div></div>`, (bg, done) => {
      bgSheet.el = bg;
      bg.querySelector('[data-x]').onclick = done;
      bg.querySelector('[data-clear]').onclick = () => api('POST', '/api/work/jobs/clear').then(bgRefresh).catch(e => toast(e.message));
      bg.querySelector('.modal').classList.add('cw-jobs-modal');
    });
    // Окно закрыли (крестик, Esc, нажатие мимо) — перестаём обновлять
    const watch = setInterval(() => { if (!bgSheet || !bgSheet.el || bgSheet.el.classList.contains('leaving') || !bgSheet.el.isConnected) { clearInterval(watch); bgSheet = null; } }, 300);
    bgSheet.close = close;
    bgDrawSheet();
  }
  function bgDrawSheet() {
    const list = bgMine(), box = bgSheet.el && bgSheet.el.querySelector('[data-list]');
    if (!box) return;
    if (!list.length) { bgSheet.close(); return; }
    box.innerHTML = '';
    list.forEach(j => {
      const run = j.status === 'RUNNING', open = bgSheet.open[j.id] !== undefined ? bgSheet.open[j.id] : run;
      const st = run ? '<span class="cw-spin"></span>' : j.status === 'DONE' ? `<span class="ok">${icon('check')}</span>` : `<span class="bad">${icon('x')}</span>`;
      const row = h(`<div class="jrow${open ? ' open' : ''}"><div class="jtop">${st}<div class="jmain"><div class="jcmd">${esc(j.command)}</div>
        <div class="jmeta">${j.cloud ? 'облако' : 'телефон'} · ${esc(j.statusTitle)}${j.exitCode != null ? ' · код ' + esc(j.exitCode) : ''} · ${dur(j.startedAt, j.finishedAt || 0)}</div></div>
        ${run ? '<button class="btn danger" data-stop>Остановить</button>' : ''}${j.url ? `<a class="icon-btn" href="${esc(j.url)}" target="_blank" rel="noopener" title="Открыть на GitHub">${icon('open')}</a>` : ''}</div>
        ${open ? `<pre class="jout">${esc(bgSheet.out[j.id] || 'Загружаю вывод…')}</pre>` : ''}</div>`);
      row.querySelector('.jtop').onclick = e => {
        if (e.target.closest('[data-stop], a')) return;
        bgSheet.open[j.id] = !open; bgDrawSheet();
      };
      const stop = row.querySelector('[data-stop]');
      if (stop) stop.onclick = () => api('POST', `/api/work/jobs/${encodeURIComponent(j.id)}/stop`).then(() => { toast('Команда остановлена'); bgRefresh(); }).catch(e => toast(e.message));
      box.appendChild(row);
      if (open) {
        const pre = row.querySelector('.jout');
        api('GET', `/api/work/jobs/${encodeURIComponent(j.id)}/output?lines=200`).then(r => {
          bgSheet && (bgSheet.out[j.id] = r.output || (run ? '(пока нет вывода)' : '(вывода нет)'));
          if (pre.isConnected) { const end = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8; pre.textContent = bgSheet.out[j.id]; if (end) pre.scrollTop = pre.scrollHeight; }
        }).catch(() => {});
      }
    });
  }
  CW.on('composer', wrap => {
    const bar = h('<button class="cw-jobs-bar hidden" title="Фоновые задачи этого чата"></button>');
    bar.onclick = bgOpen;
    wrap.insertBefore(bar, wrap.firstChild);
    bgDrawBar(bar);
    if (!bgTimer) bgTimer = setInterval(bgRefresh, 3000);
    setTimeout(bgRefresh, 0);
  });

  // ------------------------------------------------------------ подключение к основе
  CW.page('parallel', { title: 'Параллельные задачи', render: parallelPage });
  CW.page('tasks', { title: 'Планы задач', render: plansPage });
  CW.page('generate', { title: 'Генерация', render: generatePage });
  CW.page('artifacts', { title: 'Артефакты', render: artifactsPage });
  CW.page('artifact', { title: 'Артефакт', render: artifactPage });
  CW.page('project-settings', { title: 'Проект', render: projectSettingsPage });

  CW.nav({ page: 'parallel', label: 'Параллельные задачи', icon: 'layers', group: 'Работа', order: 20 });
  CW.nav({ page: 'tasks', label: 'Планы задач', icon: 'checklist', group: 'Работа', order: 21 });
  CW.nav({ page: 'generate', label: 'Генерация', icon: 'image', group: 'Работа', order: 22 });

  CW.on('chatMenu', c => [
    { label: 'Запустить параллельно…', sub: 'Новая задача в фоне, в том же проекте', onClick: () => newTaskModal({ projectId: c.projectId || '' }) },
    { label: 'Следить за pull request…', onClick: () => watchPrModal({ chatId: c.id }) }
  ]);

  CW.on('composerTools', (opts, wrap) => {
    const text = () => { const t = wrap && wrap.querySelector('textarea'); return t ? t.value.trim() : ''; };
    const items = [{ sep: true }, { header: 'Ещё' },
      { label: 'Создать изображение или видео', sub: 'Отдельной моделью генерации', onClick: () => { S.workPrompt = text(); CW.go('generate'); } }];
    if (!opts || !opts.chatId) {
      items.push({ label: 'Запустить в фоне', sub: 'Параллельная задача: отдельный чат, ответ придёт сам', onClick: () => newTaskModal({ prompt: text(), projectId: (opts && opts.projectId) || '' }) });
    }
    return items;
  });

  CW.on('topbar', route => {
    if (route.name === 'project' && route.id) {
      const b = h(`<button class="icon-btn" title="Настройки проекта: инструкции, память, GitHub, удаление">${icon('gear')}</button>`);
      b.onclick = () => CW.go('project-settings/' + enc(route.id));
      return b;
    }
    if (route.name === 'projects') {
      const box = h('<span style="display:flex;gap:4px"></span>');
      box.appendChild(button('Репозиторий проектов', '', () => projectsRepoModal(), 'globe'));
      box.appendChild(button('Проект-папка', '', () => newFolderProjectModal(), 'folder', 'Новый проект — папка в репозитории проектов'));
      box.querySelectorAll('.btn').forEach(x => { x.style.cssText = 'padding:5px 10px;font-size:13px;display:inline-flex;gap:6px;align-items:center'; x.querySelector('svg').style.cssText = 'width:15px;height:15px'; });
      return box;
    }
    if (route.name === 'parallel') {
      const b = h(`<button class="icon-btn" title="Планы задач">${icon('checklist')}</button>`);
      b.onclick = () => CW.go('tasks');
      return b;
    }
    return null;
  });

  // Панель артефакта (основа): кнопки «Редактор» — артефакт целиком с правкой и версиями
  (function panelButtons() {
    const panel = document.querySelector('#panel');
    if (!panel || !window.MutationObserver) return;
    new MutationObserver(() => {
      const doc = S.panel;
      const ph = panel.querySelector('.ph');
      if (!doc || doc.id == null || !ph || ph.querySelector('[data-wk]')) return;
      const b = h(`<button class="icon-btn" data-wk title="Открыть в редакторе: правка, версии, публикация">${icon('edit')}</button>`);
      b.onclick = () => { const id = doc.id; CW.closePanel(); CW.go('artifact/' + id); };
      ph.insertBefore(b, ph.querySelector('[data-copy]'));
    }).observe(panel, { childList: true });
  })();
})();
