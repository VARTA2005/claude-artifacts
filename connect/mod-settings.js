/*
 * Раздел «Настройки» в браузере — как экран «Настройки» приложения (SettingsScreen.kt): оглавление с разделами
 * (#/settings) и страница каждого раздела (#/settings/<раздел>). Данные — /api/cfg/… (WebSettingsApi.kt).
 * Как в приложении: поля формы общие для всех разделов, «Сохранить» видна, когда что-то изменено, и требует
 * URL, API-ключ и модель; при уходе из раздела изменения сохраняются сами. Переключатели сохраняются сразу.
 * API-ключи в браузер не передаются: видна только маска «••••1234», новый ключ можно ввести взамен.
 */
(function () {
  'use strict';
  const CW = window.CW;
  if (!CW) return;
  const { h, esc, icon, api, toast, modal, confirmBox } = CW;
  // Внутренний экран складного телефона: страница работает на самом телефоне — системные окна, виджет и способы
  // доступа доступны через мост приложения (InnerBridge в InnerScreen.kt), а не «откройте на телефоне» (3.12.22)
  const V = window.ClaudeInner && window.ClaudeInner.setAccess ? window.ClaudeInner : null;
  function phoneState() {
    if (!V) return null;
    try { return JSON.parse(V.phoneState()); } catch (e) { return null; }
  }
  // Вернулись из системного окна Android — показать новое состояние (батарея, уведомления, доступ)
  window.addEventListener('inner-resume', () => {
    if (!ctx) return;
    if (ctx.id === 'webaccess') loadWeb().catch(() => {});
    else if (ctx.id === 'device' || ctx.id === 'widget') draw();
  });

  // ------------------------------------------------------------ оформление и значки раздела
  document.head.appendChild(h(`<style id="cfg-style">
.cfg-back { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 14px; margin: 0 0 6px -4px; padding: 2px 4px; border-radius: 6px; }
.cfg-back:hover { color: var(--text); background: var(--bg-hover); }
.cfg-back .i { width: 15px; height: 15px; transform: rotate(180deg); }
.cfg-page .cw-section:first-child { margin-top: 4px; }
.cfg-note { font-size: 13.5px; color: var(--muted); margin: 0 0 12px; }
.cfg-help { font-size: 12.5px; color: var(--muted); }
.cfg-ok { color: var(--ok); font-size: 13.5px; }
.cfg-err { color: var(--danger); font-size: 13.5px; }
.cfg-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.cfg-chips button { border: 1px solid var(--border); border-radius: 9px; padding: 6px 13px; font-size: 14px; background: var(--bg); color: var(--text-2); }
.cfg-chips button:hover { background: var(--bg-hover); }
.cfg-chips button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.cfg-radio { width: 100%; text-align: left; cursor: pointer; }
.cfg-radio .dot { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 2px solid var(--border-strong); position: relative; }
.cfg-radio.on .dot { border-color: var(--accent); }
.cfg-radio.on .dot::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent); }
.cfg-radio.on .cw-label { color: var(--accent); }
.cfg-item-chev { color: var(--muted); width: 16px; height: 16px; flex: none; }
.cfg-item.disabled { opacity: .55; cursor: default; }
.cfg-in { position: relative; display: flex; gap: 6px; align-items: center; }
.cfg-in .cw-field { flex: 1; min-width: 0; }
.cfg-in .icon-btn { flex: none; }
.cfg-savebar { position: sticky; bottom: 0; padding: 12px 0 4px; background: linear-gradient(to bottom, transparent, var(--bg) 30%); display: flex; flex-direction: column; gap: 6px; z-index: 2; }
.cfg-savebar .btn.accent { width: 100%; padding: 11px; font-size: 15px; }
.cfg-savebar .btn:disabled { opacity: .5; cursor: default; }
.cfg-savebar .row { display: flex; gap: 8px; align-items: center; }
.cfg-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.cfg-actions .btn:disabled { opacity: .5; cursor: default; }
.cfg-pick { max-height: 52vh; overflow: auto; margin: 6px -8px 0; }
.cfg-pick button { width: 100%; text-align: left; display: flex; gap: 10px; align-items: flex-start; padding: 7px 10px; border-radius: 8px; }
.cfg-pick button:hover { background: var(--bg-hover); }
.cfg-pick .ck { width: 16px; flex: none; color: var(--accent); }
.cfg-pick .id { font: 12px var(--mono); color: var(--muted); word-break: break-all; }
.cfg-pick .on > span > div:first-child { font-weight: 600; }
.cfg-code { font: 600 30px/1 var(--mono); letter-spacing: .08em; color: var(--accent); margin: 8px 0; }
details.cfg-rules { border: 1px solid var(--border); border-radius: 12px; background: var(--bg-elev); }
details.cfg-rules > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
details.cfg-rules > summary::-webkit-details-marker { display: none; }
details.cfg-rules > summary .i { color: var(--accent); }
details.cfg-rules[open] > summary .cfg-item-chev { transform: rotate(90deg); }
details.cfg-rules .in { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 8px; }
details.cfg-rules textarea { min-height: 220px; font-size: 13px; }
.cfg-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.cfg-stat { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); padding: 12px 14px; }
.cfg-stat .k { font-size: 12.5px; color: var(--muted); }
.cfg-stat .v { font-size: 22px; font-weight: 600; margin: 2px 0; }
.cfg-stat .s { font-size: 12.5px; color: var(--muted); }
.cfg-bars { display: flex; flex-direction: column; gap: 4px; }
.cfg-bar { display: grid; grid-template-columns: 74px 1fr 64px; gap: 10px; align-items: center; font-size: 13px; }
.cfg-bar .d { color: var(--muted); }
.cfg-bar .t { height: 10px; border-radius: 5px; background: var(--bg-hover); overflow: hidden; }
.cfg-bar .t > span { display: block; height: 100%; background: var(--accent); border-radius: 5px; }
.cfg-bar .n { text-align: right; font-variant-numeric: tabular-nums; }
.cfg-about { text-align: center; padding: 8px 0 4px; }
.cfg-about h2 { font-family: var(--serif); font-weight: 500; font-size: 26px; margin: 8px 0 4px; }
.cfg-about .logo svg { width: 44px; height: 44px; }
.cfg-footer { text-align: center; font-size: 12.5px; color: var(--muted); margin-top: 22px; }
.cfg-dev .i { width: 20px; height: 20px; flex: none; color: var(--muted); }
.cfg-dev.online .i { color: var(--accent); }
@media (max-width: 560px) { .cfg-bar { grid-template-columns: 58px 1fr 52px; } .cfg-stats { grid-template-columns: 1fr 1fr; } }
</style>`));
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-cfg-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-cfg-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>
<symbol id="i-cfg-computer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></symbol>
<symbol id="i-cfg-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></symbol>
</svg>`);

  // Страницы других разделов (расширения, хуки, среды) — для ссылок из оглавления. mod-settings.js подключается
  // первым из модулей, поэтому видит, какие страницы и пункты регистрируют остальные.
  const PAGES = new Set();
  const NAVS = [];
  const origPage = CW.page, origNav = CW.nav;
  CW.page = function (name, def) { PAGES.add(name); return origPage.call(CW, name, def); };
  CW.nav = function (item) { NAVS.push(item); return origNav.call(CW, item); };
  function findPage(names, label) {
    const byName = names.find(n => PAGES.has(n));
    if (byName) return byName;
    const nav = NAVS.find(n => n && n.label && label.test(n.label) && n.page !== 'settings');
    return nav ? nav.page : null;
  }

  // ------------------------------------------------------------ состояние формы
  const FORM = ['provider', 'baseUrl', 'useBearer', 'model', 'maxTokens', 'maxSteps', 'strongModel', 'fastModel', 'contextWindow',
    'promptCache', 'themeMode', 'systemPrompt', 'mediaBaseUrl', 'imageModel', 'videoModel', 'searchProvider', 'searchUrl', 'permissionMode'];
  const NUMBERS = { maxTokens: [8192, 256, 128000, 6], maxSteps: [500, 1, 5000, 4], contextWindow: [200000, 4000, 10000000, 8] };
  let D = null;          // /api/cfg/all: settings (без секретов), варианты, значения по умолчанию, телефон
  let O = {};            // сохранённые значения полей формы
  let F = {};            // поля формы
  let K = {};            // новые ключи: apiKey — '' = оставить; mediaApiKey/searchApiKey — null = не трогать, '' = удалить
  let chatModels = null; // список моделей чата (после «Проверить» или для «Моделей по ролям»)
  let mediaModels = null;
  let loading = null;
  let ctx = null;        // открытый раздел: { id, body }
  let status = null;     // { text, error } — «Проверить подключение»
  let ghTimer = null;

  function st() { return D.settings; }

  function resetForm() {
    O = {};
    FORM.forEach(k => { const v = st()[k]; O[k] = typeof v === 'number' ? String(v) : v; });
    F = Object.assign({}, O);
    K = { apiKey: '', mediaApiKey: null, searchApiKey: null };
    NUMBERS.maxSteps[0] = D.defaults.maxSteps;
    NUMBERS.maxSteps[2] = D.defaults.maxStepsLimit;
    NUMBERS.contextWindow[0] = D.defaults.contextWindow;
  }

  /** Значение как его сохранит приложение (formSettings): числа в пределах, строки без пробелов по краям. */
  function norm(k, v) {
    if (NUMBERS[k]) {
      const [def, min, max] = NUMBERS[k];
      const n = parseInt(String(v == null ? '' : v).trim(), 10);
      return Math.min(max, Math.max(min, isNaN(n) ? def : n));
    }
    if (typeof v === 'string') return k === 'systemPrompt' ? v : v.trim();
    return v;
  }

  function patch() {
    const p = {};
    FORM.forEach(k => { if (norm(k, F[k]) !== norm(k, O[k])) p[k] = F[k]; });
    if (K.apiKey.trim()) p.apiKey = K.apiKey.trim();
    if (K.mediaApiKey !== null && K.mediaApiKey.trim() !== '') p.mediaApiKey = K.mediaApiKey.trim();
    if (K.mediaApiKey === '' && st().mediaApiKeySet) p.mediaApiKey = '';
    if (K.searchApiKey !== null && K.searchApiKey.trim() !== '') p.searchApiKey = K.searchApiKey.trim();
    if (K.searchApiKey === '' && st().searchApiKeySet) p.searchApiKey = '';
    return p;
  }
  function dirty() { return D && Object.keys(patch()).length > 0; }
  function hasKey() { return !!K.apiKey.trim() || st().apiKeySet; }
  function canSave() { return D && String(F.baseUrl || '').trim() !== '' && hasKey() && String(F.model || '').trim() !== ''; }

  async function load() {
    if (!loading) loading = api('GET', '/api/cfg/all').finally(() => { loading = null; });
    const data = await loading;
    D = data;
    resetForm();
    return data;
  }

  /** Обновить данные с телефона, не затирая несохранённые поля формы. */
  function applyData(data) {
    const keep = dirty() ? { F: Object.assign({}, F), K: Object.assign({}, K) } : null;
    D = data;
    resetForm();
    if (keep) { F = keep.F; K = keep.K; }
    syncCore();
  }

  /** Строка состояния основы (поле ввода): модель, режим разрешений. */
  function syncCore() {
    const s = CW.S.settings;
    if (!s || !D) return;
    s.model = st().model;
    s.permissionMode = st().permissionMode;
    s.configured = st().configured;
    s.codeMode = st().codeMode;
    try { CW.renderComposerState(); } catch (e) {}
  }

  async function saveForm(silent) {
    const p = patch();
    if (!Object.keys(p).length) return true;
    try {
      const data = await api('POST', '/api/cfg/save', p);
      D = data;
      resetForm();
      syncCore();
      if (!silent) toast('Сохранено');
      return true;
    } catch (e) { toast(e.message); return false; }
  }

  /** Переключатели и свои экраны («Возможности», «Файлы памяти») — сохраняются сразу. */
  async function setNow(p, redraw) {
    Object.assign(st(), p);
    if (redraw !== false) draw();
    try {
      const data = await api('POST', '/api/cfg/save', p);
      applyData(data);
      if (redraw !== false) draw();
      return true;
    } catch (e) { toast(e.message); load().then(draw).catch(() => {}); return false; }
  }

  // ------------------------------------------------------------ разделы
  const SECTIONS = {
    model: { title: 'Модель и подключение', draw: drawModel },
    quality: { title: 'Качество работы ИИ', draw: drawQuality },
    media: { title: 'Генерация изображений и видео', draw: drawMedia },
    search: { title: 'Поиск в интернете', draw: drawSearch },
    wishes: { title: 'Пожелания к ответам', draw: drawWishes },
    capabilities: { title: 'Возможности', draw: drawCapabilities },
    memory: { title: 'Файлы памяти', draw: drawMemory, back: 'capabilities' },
    interface: { title: 'Оформление и интерфейс', draw: drawInterface },
    permissions: { title: 'Режим разрешений', draw: drawPermissions },
    github: { title: 'GitHub', draw: drawGitHub },
    webaccess: { title: 'Доступ с компьютера', draw: drawWebAccess },
    device: { title: 'Уведомления и работа в фоне', draw: drawDevice },
    widget: { title: 'Виджет на рабочем столе', draw: drawWidget },
    backup: { title: 'Резервная копия', draw: drawBackup },
    about: { title: 'О программе', draw: drawAbout },
    usage: { title: 'Использование токенов', draw: drawUsage }
  };

  function render(id) {
    const section = SECTIONS[id] ? id : '';
    // Уход из раздела: изменения сохраняются сами, если заполнено всё нужное (как в приложении)
    if (ctx && ctx.id !== section && D && dirty() && canSave()) saveForm(true).then(ok => { if (ok) toast('Изменения сохранены'); });
    if (ghTimer && section !== 'github') { clearInterval(ghTimer); ghTimer = null; }
    // Данные отдельных экранов — заново при каждом входе (могли измениться на телефоне)
    if (!ctx || ctx.id !== section) { mem = null; web = null; usage = null; backupMsg = null; updateMsg = null; }
    const title = section ? SECTIONS[section].title : 'Настройки';
    const el = CW.pageShell(title);
    el.querySelector('.page').classList.add('cfg-page');
    if (section) {
      const back = SECTIONS[section].back;
      const link = h(`<a class="cfg-back" href="#/settings${back ? '/' + back : ''}">${icon('chev')}${esc(back ? SECTIONS[back].title : 'Настройки')}</a>`);
      el.querySelector('.page').insertBefore(link, el.querySelector('.page-head'));
    }
    const body = el.querySelector('.page-body');
    ctx = { id: section, body };
    if (!D) {
      body.appendChild(h('<div class="empty">Загрузка настроек…</div>'));
      load().then(() => { if (ctx && ctx.body === body) draw(); })
        .catch(e => { body.innerHTML = ''; body.appendChild(h(`<div class="err-box">${esc(e.message)}</div>`)); });
    } else fill(body);
    return el;
  }

  function fill(body) {
    body.innerHTML = '';
    if (ctx.id) SECTIONS[ctx.id].draw(body); else drawRoot(body);
  }

  /** Перерисовать открытый раздел (без потери прокрутки). */
  function draw() {
    if (!ctx || !D || !document.body.contains(ctx.body)) return;
    const scroll = ctx.body.closest('.scroll');
    const y = scroll ? scroll.scrollTop : 0;
    fill(ctx.body);
    if (scroll) scroll.scrollTop = y;
  }

  // ------------------------------------------------------------ элементы
  const sectionTitle = text => h(`<div class="cw-section">${esc(text)}</div>`);
  const note = text => h(`<p class="cfg-note">${esc(text)}</p>`);
  const list = () => h('<div class="cw-list"></div>');

  function linkRow(title, sub, onClick, opts) {
    const o = opts || {};
    const el = h(`<div class="cw-item link cfg-item${o.disabled ? ' disabled' : ''}" role="button" tabindex="0">
      ${o.icon ? icon(o.icon, 'style="width:20px;height:20px;color:var(--muted);flex:none"') : ''}
      <div class="grow"><div class="cw-label">${esc(title)}${o.badge ? ` <span class="cw-badge${o.badgeClass ? ' ' + o.badgeClass : ''}">${esc(o.badge)}</span>` : ''}</div>
      ${sub ? `<div class="cw-sub">${esc(sub)}</div>` : ''}</div>
      ${o.disabled ? '' : icon('chev', 'class="i cfg-item-chev"')}</div>`);
    if (!o.disabled) {
      el.onclick = onClick;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
    }
    return el;
  }
  const go = section => () => CW.go('settings' + (section ? '/' + section : ''));

  function switchRow(title, sub, on, onChange, opts) {
    const o = opts || {};
    const el = h(`<div class="cw-item"><div class="grow"><div class="cw-label">${esc(title)}${o.badge ? ` <span class="cw-badge">${esc(o.badge)}</span>` : ''}</div>
      ${sub ? `<div class="cw-sub">${esc(sub)}</div>` : ''}</div>
      <button class="cw-switch${on ? ' on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(title)}"${o.disabled ? ' disabled' : ''}></button></div>`);
    const b = el.querySelector('button');
    b.onclick = e => { e.stopPropagation(); if (!b.disabled) onChange(!on); };
    // вся строка нажимается, как в приложении
    if (!o.disabled) { el.classList.add('link'); el.onclick = () => b.click(); }
    return el;
  }

  function radioRow(title, sub, on, onClick) {
    const el = h(`<button class="cw-item cfg-radio${on ? ' on' : ''}" role="radio" aria-checked="${on ? 'true' : 'false'}">
      <span class="dot"></span><div class="grow"><div class="cw-label">${esc(title)}</div>${sub ? `<div class="cw-sub">${esc(sub)}</div>` : ''}</div></button>`);
    el.onclick = onClick;
    return el;
  }

  function chips(options, value, onPick) {
    const el = h('<div class="cfg-chips" role="radiogroup"></div>');
    options.forEach(([id, label]) => {
      const b = h(`<button class="${value === id ? 'on' : ''}" role="radio" aria-checked="${value === id}">${esc(label)}</button>`);
      b.onclick = () => onPick(id);
      el.appendChild(b);
    });
    return el;
  }

  /** Текстовое поле формы: F[k], подсказка, только цифры для чисел. */
  function field(label, k, opts) {
    const o = opts || {};
    const area = !!o.area;
    const el = h(`<label><span>${esc(label)}</span>
      ${area ? `<textarea class="cw-field" rows="${o.rows || 4}" placeholder="${esc(o.placeholder || '')}"></textarea>`
        : `<div class="cfg-in"><input class="cw-field${o.mono ? ' cw-mono' : ''}" ${NUMBERS[k] ? 'inputmode="numeric"' : ''} type="${o.type || 'text'}" placeholder="${esc(o.placeholder || '')}" autocomplete="off" spellcheck="false"${o.list ? ` list="${esc(o.list)}"` : ''}></div>`}
      ${o.help ? `<span class="cfg-help">${esc(o.help)}</span>` : ''}</label>`);
    const input = el.querySelector(area ? 'textarea' : 'input');
    input.value = F[k] == null ? '' : F[k];
    input.oninput = () => {
      if (NUMBERS[k]) {
        const clean = input.value.replace(/\D/g, '').slice(0, NUMBERS[k][3]);
        if (clean !== input.value) input.value = clean;
      }
      F[k] = input.value;
      if (o.onInput) o.onInput(input.value);
      updateSave();
    };
    if (o.after) el.querySelector('.cfg-in').appendChild(o.after);
    return el;
  }

  /** Поле ключа: в браузер приходит только маска; новый ключ заменяет прежний при «Сохранить». */
  function keyField(label, k, opts) {
    const o = opts || {};
    const set = st()[k + 'Set'], maskText = st()[k + 'Mask'];
    const cleared = K[k] === '' && k !== 'apiKey';
    const ph = cleared ? 'Будет удалён при сохранении' : set ? `Сохранён: ${maskText} — введите новый, чтобы заменить` : (o.placeholder || 'Не задан');
    const el = h(`<label><span>${esc(label)}</span><div class="cfg-in">
        <input class="cw-field cw-mono" type="password" autocomplete="new-password" spellcheck="false" placeholder="${esc(ph)}">
        <button type="button" class="icon-btn" data-eye title="Показать">${icon('cfg-eye')}</button>
        ${o.clearable && set && !cleared ? `<button type="button" class="btn" data-clear>Удалить</button>` : ''}
        ${cleared ? `<button type="button" class="btn" data-undo>Вернуть</button>` : ''}
      </div><span class="cfg-help">${esc(o.help ? o.help + ' ' : '')}Ключ хранится только на телефоне и в браузер не передаётся.</span></label>`);
    const input = el.querySelector('input');
    input.value = K[k] || '';
    input.oninput = () => { K[k] = k === 'apiKey' ? input.value : (input.value === '' ? null : input.value); updateSave(); if (o.onInput) o.onInput(); };
    const eye = el.querySelector('[data-eye]');
    eye.onclick = e => {
      e.preventDefault();
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.innerHTML = icon(show ? 'cfg-eye-off' : 'cfg-eye');
      eye.title = show ? 'Скрыть' : 'Показать';
    };
    const clear = el.querySelector('[data-clear]');
    if (clear) clear.onclick = e => { e.preventDefault(); K[k] = ''; draw(); };
    const undo = el.querySelector('[data-undo]');
    if (undo) undo.onclick = e => { e.preventDefault(); K[k] = null; draw(); };
    return el;
  }

  /** «Сохранить» разделов с полями: видна, когда что-то изменено. */
  function saveBar() {
    const el = h('<div class="cfg-savebar"></div>');
    fillSave(el);
    return el;
  }
  function fillSave(el) {
    el.innerHTML = '';
    if (!dirty()) { el.style.display = 'none'; return; }
    el.style.display = '';
    const ok = canSave();
    const b = h(`<button class="btn accent"${ok ? '' : ' disabled'}>Сохранить</button>`);
    b.onclick = async () => { b.disabled = true; if (await saveForm()) draw(); else b.disabled = false; };
    el.appendChild(b);
    const row = h(`<div class="row"><span class="cfg-help" style="flex:1">${ok ? 'Есть несохранённые изменения.' : 'Для сохранения нужны URL, API-ключ и модель («Модель и подключение»).'}</span></div>`);
    const undo = h('<button class="btn">Отменить</button>');
    undo.onclick = () => { resetForm(); draw(); };
    row.appendChild(undo);
    el.appendChild(row);
  }
  function updateSave() {
    if (!ctx) return;
    ctx.body.querySelectorAll('.cfg-savebar').forEach(fillSave);
  }

  /**
   * Выбор модели — как список в поле приложения: «Авто» (пусто), подходящие модели (лучшие первыми) и
   * «Все модели», если нужной нет среди подходящих.
   */
  function pickModel(o) {
    let showAll = !o.options || !o.options.length;
    modal(`<h3>${esc(o.title)}</h3><input class="field" placeholder="Поиск модели…"><div class="cfg-pick"></div>
      <div class="btns"><button class="btn" data-x>Закрыть</button></div>`, (bg, close) => {
      const input = bg.querySelector('input'), box = bg.querySelector('.cfg-pick');
      bg.querySelector('[data-x]').onclick = close;
      const byId = {};
      (o.all || []).forEach(m => { byId[m.id] = m; });
      const drawList = () => {
        const q = input.value.trim().toLowerCase();
        box.innerHTML = '';
        const add = (label, sub, id, on) => {
          const b = h(`<button class="${on ? 'on' : ''}"><span class="ck">${on ? icon('check') : ''}</span><span style="flex:1;min-width:0"><div>${esc(label)}</div>${sub ? `<div class="id">${esc(sub)}</div>` : ''}</span></button>`);
          b.onclick = () => { close(); o.onPick(id); };
          box.appendChild(b);
        };
        if (o.autoLabel && !q) add(o.autoLabel, o.autoSub, '', !o.value);
        const ids = showAll ? (o.all || []).map(m => m.id) : o.options;
        const shown = ids.map(id => byId[id] || { id, name: id })
          .filter(m => !q || m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)).slice(0, 300);
        if (!shown.length) box.appendChild(h(`<div class="cfg-help" style="padding:8px 10px">${(o.all || []).length ? 'Ничего не найдено' : esc(o.emptyText || 'Список пуст — нажмите «Обновить список моделей»')}</div>`));
        shown.forEach(m => add(m.name || m.id, m.name && m.name !== m.id ? m.id : '', m.id, m.id === o.value));
        if (!showAll && (o.all || []).length > (o.options || []).length) {
          const more = h(`<button><span class="ck"></span><span>Все модели сервиса (${o.all.length})…</span></button>`);
          more.onclick = () => { showAll = true; drawList(); };
          box.appendChild(more);
        }
      };
      input.oninput = drawList;
      drawList();
    });
  }

  /** Поле модели с «Авто» (пусто) и выбором из списка: генерация и модели по ролям. */
  function modelField(label, k, o) {
    const value = String(F[k] || '').trim();
    const help = value ? 'Выбрано вручную. Очистите поле, чтобы вернуть «Авто»'
      : o.best ? 'Авто: ' + o.best
      : !(o.all || []).length ? `Авто: ${o.fallback} (список моделей не загружен)`
      : 'Авто: у сервиса нет подходящей модели — выберите из всех моделей';
    const pick = h(`<button type="button" class="icon-btn" title="Список моделей">${icon('down')}</button>`);
    const el = field(label, k, { placeholder: 'Авто — лучшая модель', help, mono: true, after: pick, onInput: () => {
      const v = String(F[k] || '').trim();
      el.querySelector('.cfg-help').textContent = v ? 'Выбрано вручную. Очистите поле, чтобы вернуть «Авто»' : (o.best ? 'Авто: ' + o.best : `Авто: ${o.fallback}`);
    } });
    pick.onclick = e => {
      e.preventDefault();
      pickModel({ title: label, all: o.all, options: o.options, value, autoLabel: 'Авто — лучшая модель', autoSub: o.best || o.fallback,
        onPick: id => { F[k] = id; draw(); } });
    };
    return el;
  }

  // ------------------------------------------------------------ оглавление
  function drawRoot(body) {
    const s = st();
    const provider = F.provider === 'ANTHROPIC' ? 'Anthropic API' : 'OpenAI-совместимый';
    const sp = D.searchProviders.find(x => x.id === F.searchProvider) || D.searchProviders[0];
    const pm = D.permissionModes.find(x => x.id === F.permissionMode) || D.permissionModes[0];
    const ext = findPage(['extensions', 'ext', 'plugins'], /расширени/i);
    const hooks = findPage(['hooks'], /хук/i);
    const envs = findPage(['environments', 'envs', 'env'], /сред/i);
    const other = name => name ? () => CW.go(name) : () => {};
    const phoneOnly = 'В браузере пока нет — откройте на телефоне';

    body.appendChild(sectionTitle('ИИ и модель'));
    let g = list();
    g.appendChild(linkRow('Модель и подключение', !String(F.model || '').trim() ? 'Сервер, API-ключ и модель не заданы' : provider + ' · ' + F.model, go('model')));
    g.appendChild(linkRow('Качество работы ИИ', 'Проверка перед «Готово», модели по ролям, автосжатие, карта проекта', go('quality')));
    g.appendChild(linkRow('Генерация изображений и видео', 'Сервис и модели для картинок и видео', go('media')));
    g.appendChild(linkRow('Поиск в интернете', sp.title + ' — ' + sp.description, go('search')));
    body.appendChild(g);

    body.appendChild(sectionTitle('Персонализация'));
    g = list();
    g.appendChild(linkRow('Пожелания к ответам', (String(F.systemPrompt || '').trim() || 'Как Claude отвечает: тон, длина, кто вы').slice(0, 80), go('wishes')));
    g.appendChild(linkRow('Возможности', 'Артефакты, визуализации, выполнение кода, память, доступ к инструментам', go('capabilities')));
    g.appendChild(linkRow('Память и инструкции для ИИ', 'Что помнит Claude и инструкции для чата, «Кода» и агентов', go('memory')));
    g.appendChild(linkRow('Оформление и интерфейс', 'Тема, подсказки ответа, тактильный отклик', go('interface')));
    body.appendChild(g);

    body.appendChild(sectionTitle('Claude Code'));
    g = list();
    g.appendChild(linkRow('Режим разрешений', pm.title + ' — ' + pm.description, go('permissions')));
    g.appendChild(linkRow('Расширения', ext ? 'Коннекторы (MCP), навыки, плагины и команды «/»' : phoneOnly, other(ext), { disabled: !ext }));
    g.appendChild(linkRow('Хуки', hooks ? 'Автоматические проверки и действия до и после действий Claude' : phoneOnly, other(hooks), { disabled: !hooks }));
    g.appendChild(linkRow('Среды', envs ? 'Доступ Claude к интернету, ключи API, переменные и скрипт настройки' : phoneOnly, other(envs), { disabled: !envs }));
    body.appendChild(g);

    body.appendChild(sectionTitle('Подключения'));
    g = list();
    g.appendChild(linkRow('GitHub', s.githubConnected
      ? 'Подключено' + (s.githubLogin ? ' как @' + s.githubLogin : '') + ' · синхронизация'
      : 'Не подключено — войти, синхронизация проектов', go('github')));
    g.appendChild(linkRow('Доступ с компьютера', 'Чаты Claude в браузере на компьютере (Chrome, Edge) — как claude.ai', go('webaccess')));
    body.appendChild(g);

    body.appendChild(sectionTitle('Телефон'));
    g = list();
    g.appendChild(linkRow('Уведомления и работа в фоне', '«Claude работает…», «Готово», ограничение батареи, автозапуск', go('device')));
    g.appendChild(linkRow('Виджет на рабочем столе', 'Прозрачность, тема, размер, что показывать; добавить виджет на экран', go('widget')));
    body.appendChild(g);

    body.appendChild(sectionTitle('Данные'));
    g = list();
    g.appendChild(linkRow('Резервная копия', 'Сохранить или восстановить все чаты, проекты и настройки', go('backup')));
    g.appendChild(linkRow('Использование токенов', 'Расход токенов по дням и чатам', go('usage')));
    g.appendChild(linkRow('О программе', `Версия ${D.app.version}, проверка и установка обновлений`, go('about'),
      D.app.update ? { badge: 'Сборка №' + D.app.update.build, badgeClass: 'accent' } : null));
    body.appendChild(g);

    if (dirty()) body.appendChild(saveBar());
    body.appendChild(h('<div class="cfg-footer">Разработано: Claude AI</div>'));
  }

  // ------------------------------------------------------------ Модель и подключение
  function drawModel(body) {
    const anthropic = F.provider === 'ANTHROPIC';
    const def = D.defaults;
    body.appendChild(sectionTitle('Сервер и ключ'));
    const form = h('<div class="cw-form"></div>');
    form.appendChild(chips([['ANTHROPIC', 'Anthropic API'], ['OPENAI', 'OpenAI-совместимый']], F.provider, id => {
      if (id === F.provider) return;
      const url = String(F.baseUrl || '').trim();
      if (id === 'ANTHROPIC' && (!url || url === def.openaiUrl)) F.baseUrl = def.anthropicUrl;
      if (id === 'OPENAI' && (!url || url === def.anthropicUrl)) F.baseUrl = def.openaiUrl;
      F.provider = id;
      chatModels = null;
      status = null;
      draw();
    }));
    form.appendChild(field('URL сервера', 'baseUrl', {
      placeholder: anthropic ? 'https://api.anthropic.com' : 'https://example.com/v1', mono: true, type: 'url',
      help: anthropic ? 'Запросы: {URL}/v1/messages и {URL}/v1/models' : 'Запросы: {URL}/chat/completions и {URL}/models (если URL оканчивается на /v1)',
      onInput: () => refreshTest()
    }));
    form.appendChild(keyField('API-ключ', 'apiKey', { onInput: () => refreshTest() }));
    body.appendChild(form);
    if (anthropic) {
      const g = list();
      g.appendChild(switchRow('Авторизация Bearer', 'Для прокси, которые ждут заголовок Authorization вместо x-api-key', !!F.useBearer,
        v => { F.useBearer = v; draw(); }));
      body.appendChild(h('<div style="height:12px"></div>'));
      body.appendChild(g);
    }

    body.appendChild(sectionTitle('Модель'));
    const mf = h('<div class="cw-form"></div>');
    const listBtn = h(`<button type="button" class="icon-btn" title="Список моделей">${icon('down')}</button>`);
    listBtn.style.display = chatModels && chatModels.models.length ? '' : 'none';
    listBtn.onclick = e => {
      e.preventDefault();
      pickModel({ title: 'Модель', all: chatModels.models, options: chatModels.models.map(m => m.id), value: String(F.model || '').trim(), onPick: id => { F.model = id; draw(); } });
    };
    mf.appendChild(field('Модель', 'model', { placeholder: 'Нажмите «Проверить» или введите ID модели', mono: true, after: listBtn }));
    const test = h(`<div class="cfg-actions"><button class="btn" data-test>Проверить подключение и загрузить модели</button></div>`);
    const testBtn = test.querySelector('[data-test]');
    testBtn.onclick = () => testConnection(testBtn);
    mf.appendChild(test);
    if (status) mf.appendChild(h(`<div class="${status.error ? 'cfg-err' : 'cfg-ok'}">${esc(status.text)}</div>`));
    body.appendChild(mf);
    refreshTest();

    body.appendChild(sectionTitle('Ответ и контекст'));
    const rf = h('<div class="cw-form"></div>');
    rf.appendChild(field('Максимум токенов в ответе', 'maxTokens'));
    rf.appendChild(field('Шагов за один ответ', 'maxSteps', {
      help: `Сколько раз Claude может обратиться к модели в одном ответе (каждый шаг — действия с файлами, командами, поиском). ` +
        `У каждого агента — столько же. От 1 до ${def.maxStepsLimit}, по умолчанию ${def.maxSteps}. Больше шагов — больше расход токенов.`
    }));
    rf.appendChild(field('Размер контекста модели (токены)', 'contextWindow', { help: 'Для окна «Использование»: Claude — 200000, модели с 1M контекста — 1000000' }));
    body.appendChild(rf);
    if (anthropic) {
      const g = list();
      g.appendChild(switchRow('Кэширование промптов', 'Как в Claude: системный промпт, инструменты и история кэшируются — повторные запросы быстрее и до 10 раз дешевле',
        !!F.promptCache, v => { F.promptCache = v; draw(); }));
      body.appendChild(h('<div style="height:12px"></div>'));
      body.appendChild(g);
    }
    body.appendChild(saveBar());

    function refreshTest() {
      testBtn.disabled = !(String(F.baseUrl || '').trim() && hasKey());
    }
  }

  async function testConnection(btn) {
    btn.disabled = true;
    btn.textContent = 'Проверяю…';
    status = null;
    try {
      chatModels = await api('POST', '/api/cfg/models', patch());
      status = { text: chatModels.status, error: false };
      if (!String(F.model || '').trim() && chatModels.models.length) F.model = chatModels.models[0].id;
      draw();
      if (chatModels.models.length && ctx && ctx.id === 'model') {
        pickModel({ title: 'Модель', all: chatModels.models, options: chatModels.models.map(m => m.id), value: String(F.model || '').trim(), onPick: id => { F.model = id; draw(); } });
      }
    } catch (e) {
      status = { text: e.message, error: true };
      draw();
    }
  }

  /** Список моделей чата для «Моделей по ролям» и резервной модели — по сохранённым настройкам. */
  function ensureChatModels() {
    if (chatModels || !st().configured || ensureChatModels.busy) return;
    ensureChatModels.busy = true;
    api('POST', '/api/cfg/models', {}).then(r => { chatModels = r; draw(); }).catch(() => {}).finally(() => { ensureChatModels.busy = false; });
  }

  // ------------------------------------------------------------ Качество работы ИИ
  function drawQuality(body) {
    const s = st();
    ensureChatModels();
    body.appendChild(sectionTitle('Проверка результата'));
    let g = list();
    g.appendChild(switchRow('Проверка перед «Готово»', 'В «Коде» отдельный агент-проверяющий сверяет результат с просьбой, запускает сборку или тесты; если что-то не так — Claude дорабатывает (до 2 раз)',
      s.verifyResult, v => setNow({ verifyResult: v })));
    body.appendChild(g);
    body.appendChild(sectionTitle('Модели агентов'));
    g = list();
    g.appendChild(switchRow('Модели по ролям', 'Проверяющий и планировщик — на сильной модели, поиск по коду и в интернете — на быстрой. Выключено — все агенты на модели чата',
      s.roleModels, v => setNow({ roleModels: v })));
    body.appendChild(g);
    if (s.roleModels) {
      const f = h('<div class="cw-form" style="margin-top:14px"></div>');
      const all = chatModels ? chatModels.models : [];
      f.appendChild(modelField('Сильная модель', 'strongModel', { all, options: chatModels ? chatModels.strong : [], best: chatModels && chatModels.bestStrong, fallback: 'модель чата' }));
      f.appendChild(modelField('Быстрая модель', 'fastModel', { all, options: chatModels ? chatModels.fast : [], best: chatModels && chatModels.bestFast, fallback: 'модель чата' }));
      body.appendChild(f);
    }
    body.appendChild(sectionTitle('Контекст'));
    g = list();
    g.appendChild(switchRow('Автосжатие', 'Когда контекст модели заполнен на 80%, старые результаты действий сокращаются; длинный разговор сам продолжается в новом чате со сводкой',
      s.autoCompact, v => setNow({ autoCompact: v })));
    g.appendChild(switchRow('Карта проекта', 'В «Коде» Claude сразу видит файлы, классы и функции проекта — быстрее находит нужное место',
      s.projectMap, v => setNow({ projectMap: v })));
    body.appendChild(g);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ Генерация изображений и видео
  function loadMedia(fresh) {
    if (loadMedia.busy) return;
    loadMedia.busy = true;
    draw();
    const p = patch();
    p.fresh = !!fresh;
    api('POST', '/api/cfg/media-models', p)
      .then(r => { mediaModels = r; })
      .catch(e => { mediaModels = { models: [], images: [], videos: [], status: 'Не удалось загрузить список моделей: ' + e.message }; })
      .finally(() => { loadMedia.busy = false; draw(); });
  }

  function drawMedia(body) {
    if (!mediaModels && !loadMedia.busy) setTimeout(() => loadMedia(false), 0);
    body.appendChild(note('OpenAI-совместимый сервис (Images API и Videos API). Пусто — используется сервер чата, если он OpenAI-совместимый.'));
    const f = h('<div class="cw-form"></div>');
    f.appendChild(field('URL сервиса', 'mediaBaseUrl', { placeholder: 'https://api.openai.com/v1', mono: true, type: 'url' }));
    f.appendChild(keyField('API-ключ сервиса', 'mediaApiKey', { clearable: true, placeholder: 'Не задан — используется ключ чата', help: 'Пусто — ключ чата.' }));
    f.appendChild(h('<p class="cfg-note" style="margin:0">Картинки и видео из чата и «Кода» всегда создают эти модели, а не модель, выбранная для чата. «Авто» — лучшая модель из списка вашего сервиса; можно выбрать свою из списка.</p>'));
    const m = mediaModels || { models: [], images: [], videos: [] };
    f.appendChild(modelField('Модель картинок', 'imageModel', { all: m.models, options: m.images, best: m.bestImage, fallback: D.defaults.imageModel }));
    f.appendChild(modelField('Модель видео', 'videoModel', { all: m.models, options: m.videos, best: m.bestVideo, fallback: D.defaults.videoModel }));
    const row = h(`<div class="cfg-actions"><button class="btn">${loadMedia.busy ? 'Загружаю…' : 'Обновить список моделей'}</button></div>`);
    const b = row.querySelector('button');
    b.disabled = !!loadMedia.busy;
    b.onclick = () => loadMedia(true);
    f.appendChild(row);
    if (mediaModels && mediaModels.status) f.appendChild(h(`<div class="cfg-help">${esc(mediaModels.status)}</div>`));
    body.appendChild(f);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ Поиск в интернете
  function drawSearch(body) {
    const g = list();
    D.searchProviders.forEach(o => g.appendChild(radioRow(o.title, o.description, F.searchProvider === o.id, () => { F.searchProvider = o.id; draw(); })));
    body.appendChild(g);
    const f = h('<div class="cw-form" style="margin-top:14px"></div>');
    if (F.searchProvider === 'BRAVE' || F.searchProvider === 'TAVILY') {
      const sp = D.searchProviders.find(x => x.id === F.searchProvider);
      f.appendChild(keyField('Ключ ' + sp.title, 'searchApiKey', { clearable: true, help: 'Если сервис не ответит, поиск сам перейдёт на DuckDuckGo и Bing.' }));
    }
    if (F.searchProvider === 'SEARXNG') f.appendChild(field('Адрес сервера SearXNG', 'searchUrl', { placeholder: 'https://searx.example.org', mono: true, type: 'url' }));
    if (f.children.length) body.appendChild(f);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ Пожелания к ответам
  function drawWishes(body) {
    body.appendChild(note('Добавляются ко всем чатам: как отвечать, о чём помнить, кто вы. Подробные инструкции для чата, «Кода» и агентов — в «Память и инструкции для ИИ».'));
    const f = h('<div class="cw-form"></div>');
    f.appendChild(field('Пожелания к ответам', 'systemPrompt', { area: true, rows: 6, placeholder: 'Например: отвечай кратко, я Android-разработчик' }));
    body.appendChild(f);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ Возможности
  function drawCapabilities(body) {
    const s = st();
    let g = list();
    g.appendChild(switchRow('Артефакты', 'Веб-страницы, игры и большие блоки кода сохраняются в «Артефакты» и открываются в просмотре.', s.artifacts, v => setNow({ artifacts: v })));
    g.appendChild(switchRow('Визуализации в чате', 'Разрешить Claude создавать интерактивные визуализации, графики и диаграммы прямо в чате.', s.visualizations, v => setNow({ visualizations: v }), { badge: 'БЕТА' }));
    g.appendChild(switchRow('Выполнение кода и создание файлов', 'Разрешить Claude выполнять команды, создавать и редактировать файлы в рабочей папке и поручать работу дочерним агентам — в любом чате, не только в режиме «Код».',
      s.codeExecution, v => setNow({ codeExecution: v })));
    g.appendChild(switchRow('Переключение модели, если сообщение помечено системой безопасности', 'Если меры безопасности останавливают ответ, чат автоматически переключается на другую модель, чтобы общение могло продолжиться. Если параметр выключен, чат будет приостановлен.',
      s.modelFallback, v => setNow({ modelFallback: v })));
    if (s.modelFallback) {
      ensureChatModels();
      g.appendChild(linkRow('Резервная модель', s.fallbackModel || 'Автоматически — первая другая модель сервера', () => {
        pickModel({
          title: 'Резервная модель', all: chatModels ? chatModels.models : [], options: chatModels ? chatModels.models.map(m => m.id) : [],
          value: s.fallbackModel, autoLabel: 'Автоматически', autoSub: 'первая другая модель сервера',
          emptyText: 'Список моделей не загружен — проверьте подключение в «Модель и подключение».',
          onPick: id => setNow({ fallbackModel: id })
        });
      }));
    }
    body.appendChild(g);

    body.appendChild(sectionTitle('Память'));
    g = list();
    g.appendChild(switchRow('Поиск и использование чатов', 'Разрешить Claude искать нужные сведения в прошлых чатах.', s.chatSearch, v => setNow({ chatSearch: v })));
    g.appendChild(switchRow('Создание памяти на основе чатов', 'Разрешить Claude создавать память на основе ваших чатов.', s.memoryGeneration, v => setNow({ memoryGeneration: v })));
    g.appendChild(switchRow('Включать деликатные темы в память', 'Разрешить Claude сохранять в память сведения на деликатные темы, такие как состояние здоровья или религиозные убеждения.',
      s.sensitiveMemory, v => setNow({ sensitiveMemory: v }), { disabled: !s.memoryGeneration }));
    g.appendChild(linkRow('Файлы памяти', 'Просмотр того, что помнит Claude, и управление этим.', go('memory')));
    body.appendChild(g);

    body.appendChild(sectionTitle('Доступ к инструментам'));
    g = list();
    D.toolAccess.forEach(a => g.appendChild(radioRow(a.title, a.description, s.toolAccess === a.id, () => setNow({ toolAccess: a.id }))));
    body.appendChild(g);
  }

  // ------------------------------------------------------------ Файлы памяти (память и инструкции)
  let mem = null; // поля экрана: { memory, aiInstructions, rulesChat, rulesCode, rulesAgents, saved }
  function drawMemory(body) {
    const s = st(), def = D.defaults;
    if (!mem) mem = { memory: s.memory, aiInstructions: s.aiInstructions, rulesChat: s.rulesChat, rulesCode: s.rulesCode, rulesAgents: s.rulesAgents, saved: false, open: {} };
    body.appendChild(note('Это Claude получает автоматически в каждом сообщении. Инструкции для ИИ уже заполнены (чат, режим «Код», дочерние агенты) — их можно изменить или вернуть по умолчанию. Память Claude дополняет сам (если включено «Создание памяти на основе чатов»).'));
    const f = h('<div class="cw-form"></div>');
    const savedMark = h('<span class="cfg-ok"></span>');
    const markChanged = () => { mem.saved = false; savedMark.textContent = ''; };
    [['rulesChat', 'Инструкции для ИИ: чат', def.rulesChat], ['rulesCode', 'Инструкции для ИИ: режим «Код»', def.rulesCode],
      ['rulesAgents', 'Инструкции для ИИ: дочерние агенты', def.rulesAgents]].forEach(([k, title, dflt]) => {
      const changed = () => mem[k].trim() !== dflt.trim();
      const d = h(`<details class="cfg-rules"${mem.open[k] ? ' open' : ''}><summary>${icon('cfg-doc')}<div class="grow" style="flex:1"><div class="cw-label">${esc(title)}</div>
        <div class="cw-sub" data-state></div></div>${icon('chev', 'class="i cfg-item-chev"')}</summary>
        <div class="in"><textarea class="cw-field mono" spellcheck="false"></textarea><div><button class="btn" data-reset>Вернуть по умолчанию</button></div></div></details>`);
      const ta = d.querySelector('textarea'), state = d.querySelector('[data-state]'), reset = d.querySelector('[data-reset]');
      const upd = () => { state.textContent = changed() ? 'Изменено вами' : 'По умолчанию (ai-agent-rules.md)'; reset.style.display = changed() ? '' : 'none'; };
      ta.value = mem[k];
      ta.oninput = () => { mem[k] = ta.value; markChanged(); upd(); };
      reset.onclick = () => { mem[k] = dflt; ta.value = dflt; markChanged(); upd(); };
      d.ontoggle = () => { mem.open[k] = d.open; };
      upd();
      f.appendChild(d);
    });
    const ins = h(`<label><span>Ваши инструкции (дополнительно)</span><textarea class="cw-field" rows="4" placeholder="Например: обращайся ко мне на «ты»"></textarea></label>`);
    ins.querySelector('textarea').value = mem.aiInstructions;
    ins.querySelector('textarea').oninput = e => { mem.aiInstructions = e.target.value; markChanged(); };
    f.appendChild(ins);
    const mm = h(`<label><span>Память</span><textarea class="cw-field" rows="8" placeholder="Пока пусто"></textarea></label>`);
    const memArea = mm.querySelector('textarea');
    memArea.value = mem.memory;
    f.appendChild(mm);
    const row = h('<div class="cfg-actions"><button class="btn" data-clear>Очистить память</button><span style="flex:1"></span></div>');
    const clear = row.querySelector('[data-clear]');
    clear.disabled = !mem.memory.trim();
    memArea.oninput = () => { mem.memory = memArea.value; clear.disabled = !mem.memory.trim(); markChanged(); };
    row.appendChild(savedMark);
    const saveBtn = h('<button class="btn accent">Сохранить</button>');
    row.appendChild(saveBtn);
    if (mem.saved) savedMark.textContent = 'Сохранено';
    clear.onclick = () => confirmBox('Очистить память?', 'Claude забудет всё, что сохранено в памяти. Инструкции для ИИ останутся.', 'Очистить', async () => {
      mem.memory = '';
      if (await setNow({ memory: '' }, false)) { mem.saved = true; draw(); }
    });
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      const ok = await setNow({ memory: mem.memory.trim(), aiInstructions: mem.aiInstructions.trim(), rulesChat: mem.rulesChat.trim(),
        rulesCode: mem.rulesCode.trim(), rulesAgents: mem.rulesAgents.trim() }, false);
      saveBtn.disabled = false;
      if (ok) { const open = mem.open; mem = null; drawMemoryAfterSave(open); }
    };
    f.appendChild(row);
    body.appendChild(f);
  }
  function drawMemoryAfterSave(open) {
    const s = st();
    mem = { memory: s.memory, aiInstructions: s.aiInstructions, rulesChat: s.rulesChat, rulesCode: s.rulesCode, rulesAgents: s.rulesAgents, saved: true, open: open || {} };
    draw();
  }

  // ------------------------------------------------------------ Оформление и интерфейс
  function drawInterface(body) {
    const s = st();
    body.appendChild(sectionTitle('Тема'));
    body.appendChild(h('<div class="cfg-help" style="margin-bottom:8px">В приложении на телефоне</div>'));
    body.appendChild(chips([['SYSTEM', 'Как в системе'], ['LIGHT', 'Светлая'], ['DARK', 'Тёмная']], F.themeMode, id => { F.themeMode = id; draw(); }));
    body.appendChild(h('<div class="cfg-help" style="margin:14px 0 8px">В этом браузере</div>'));
    const local = CW.load('theme') || 'system';
    body.appendChild(chips([['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], local, id => {
      CW.save('theme', id === 'system' ? (window.ClaudeInner ? 'system' : '') : id);
      if (id === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = id;
      draw();
    }));
    body.appendChild(sectionTitle('Поле ввода и отклик'));
    const g = list();
    g.appendChild(switchRow('Подсказки ответа', 'После ответа Claude над полем ввода — вариант вашего следующего сообщения: нажмите на текст, чтобы вставить, или «›», чтобы сразу отправить (и в браузере на компьютере)',
      s.replySuggestions, v => setNow({ replySuggestions: v })));
    g.appendChild(switchRow('Тактильный отклик', 'Лёгкая вибрация при нажатиях, отправке, шагах работы и готовом ответе — как в приложении Claude (на телефоне)',
      s.haptics, v => setNow({ haptics: v })));
    body.appendChild(g);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ Режим разрешений
  function drawPermissions(body) {
    body.appendChild(note('Как в Claude Code: что Claude может делать без вашего подтверждения. Меняется и в поле ввода «Кода».'));
    const g = list();
    D.permissionModes.forEach(m => g.appendChild(radioRow(m.title, m.description, F.permissionMode === m.id, () => { F.permissionMode = m.id; draw(); })));
    body.appendChild(g);
    body.appendChild(saveBar());
  }

  // ------------------------------------------------------------ GitHub
  let gh = null; // вход по коду: { status, userCode, uri, error, login }
  function drawGitHub(body) {
    const s = st();
    body.appendChild(sectionTitle('Аккаунт'));
    let g = list();
    if (s.githubConnected) {
      const row = h(`<div class="cw-item"><div class="grow"><div class="cw-label">Подключено${s.githubLogin ? ' как @' + esc(s.githubLogin) : ''}</div>
        <div class="cw-sub">Репозитории доступны в разделе «Код» → GitHub</div></div><button class="btn">Выйти</button></div>`);
      row.querySelector('button').onclick = () => confirmBox('Выйти из GitHub?', 'Приложение забудет токен доступа. Файлы проектов на телефоне останутся.', 'Выйти',
        () => api('POST', '/api/cfg/github/logout').then(d => { gh = null; applyData(d); draw(); }).catch(e => toast(e.message)));
      g.appendChild(row);
      body.appendChild(g);
    } else if (gh && gh.status === 'waiting') {
      const box = h(`<div class="cw-list" style="padding:16px"><div class="cw-label">Откройте <a href="${esc(gh.uri)}" target="_blank" rel="noopener">${esc(gh.uri)}</a> и введите код:</div>
        <div class="cfg-code">${esc(gh.userCode)}</div><div class="cfg-help">Ожидаю подтверждения на GitHub… Токен придёт на телефон сам.</div>
        <div class="cfg-actions" style="margin-top:10px"><button class="btn" data-copy>Копировать код</button><button class="btn" data-cancel>Отмена</button></div></div>`);
      box.querySelector('[data-copy]').onclick = () => CW.copy(gh.userCode);
      box.querySelector('[data-cancel]').onclick = () => api('POST', '/api/cfg/github/cancel').then(r => { gh = r; stopGhPoll(); draw(); }).catch(e => toast(e.message));
      body.appendChild(box);
      startGhPoll();
    } else {
      const box = h(`<div class="cw-form"><div class="cfg-actions"><button class="btn accent" data-login>Войти через GitHub</button><button class="btn" data-token>Войти по токену</button></div></div>`);
      if (gh && gh.status === 'error') box.appendChild(h(`<div class="cfg-err">${esc(gh.error)}</div>`));
      box.querySelector('[data-login]').onclick = async e => {
        e.target.disabled = true;
        try { gh = await api('POST', '/api/cfg/github/login'); } catch (err) { gh = { status: 'error', error: err.message }; }
        draw();
      };
      box.querySelector('[data-token]').onclick = tokenLogin;
      box.appendChild(h('<div class="cfg-help">Как в Claude Code: приложение покажет код, вы подтвердите вход на github.com, токен придёт сам — на телефон, в браузере он не хранится.</div>'));
      body.appendChild(box);
    }

    body.appendChild(sectionTitle('Синхронизация'));
    g = list();
    g.appendChild(switchRow('Синхронизация с GitHub', 'Перед ответом Claude забирает изменения из GitHub (сделанные в другом месте), после ответа отправляет свои правки. Свои и чужие изменения не затирают друг друга',
      s.autoSync, v => setNow({ autoSync: v })));
    g.appendChild(linkRow('Client ID OAuth-приложения', s.githubClientId || (D.defaults.githubClientIdBuiltIn ? 'Встроен в приложение' : 'Не задан — нужен для входа без токена'), editClientId));
    body.appendChild(g);
  }
  function startGhPoll() {
    if (ghTimer) return;
    ghTimer = setInterval(async () => {
      if (!ctx || ctx.id !== 'github' || CW.current().name !== 'settings') { stopGhPoll(); return; }
      try {
        gh = await api('GET', '/api/cfg/github/login');
        if (gh.status !== 'waiting') {
          stopGhPoll();
          if (gh.status === 'done') { toast('Вход выполнен' + (gh.login ? ': @' + gh.login : '')); applyData(await api('GET', '/api/cfg/all')); }
          draw();
        }
      } catch (e) {}
    }, 3000);
  }
  function stopGhPoll() { if (ghTimer) { clearInterval(ghTimer); ghTimer = null; } }
  function tokenLogin() {
    modal(`<h3>Вход по токену</h3><p>Вставьте personal access token (github.com → Settings → Developer settings → Personal access tokens) с доступом к репозиториям.</p>
      <input class="field" type="password" autocomplete="off" placeholder="Токен"><div class="cfg-err" data-err></div>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Войти</button></div>`, (bg, close) => {
      const input = bg.querySelector('input'), err = bg.querySelector('[data-err]'), ok = bg.querySelector('[data-ok]');
      bg.querySelector('[data-x]').onclick = close;
      const goLogin = async () => {
        if (!input.value.trim()) return;
        ok.disabled = true; err.textContent = '';
        try { applyData(await api('POST', '/api/cfg/github/token', { token: input.value.trim() })); close(); toast('Вход выполнен'); gh = null; draw(); }
        catch (e) { err.textContent = e.message; ok.disabled = false; }
      };
      ok.onclick = goLogin;
      input.onkeydown = e => { if (e.key === 'Enter') goLogin(); };
    });
  }
  function editClientId() {
    modal(`<h3>Client ID OAuth-приложения</h3><p>github.com → Settings → Developer settings → OAuth Apps → New OAuth App, включите «Enable Device Flow». Client ID не секретный. Пусто — использовать встроенный.</p>
      <input class="field" placeholder="Client ID" spellcheck="false"><div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Сохранить</button></div>`, (bg, close) => {
      const input = bg.querySelector('input');
      input.value = st().githubClientId || '';
      bg.querySelector('[data-x]').onclick = close;
      bg.querySelector('[data-ok]').onclick = () => { close(); setNow({ githubClientId: input.value.trim() }); };
      input.onkeydown = e => { if (e.key === 'Enter') bg.querySelector('[data-ok]').click(); };
    });
  }

  // ------------------------------------------------------------ Доступ с компьютера
  let web = null;
  let webTimer = null;
  function loadWeb() {
    return api('GET', '/api/cfg/devices').then(r => { web = r; if (ctx && ctx.id === 'webaccess') draw(); return r; });
  }
  function drawWebAccess(body) {
    if (!web) { body.appendChild(h('<div class="empty">Загрузка…</div>')); loadWeb().catch(e => toast(e.message)); return; }
    body.appendChild(note('Чаты, проекты и артефакты телефона — на большом экране в браузере. Claude работает на телефоне, компьютер только показывает и отправляет сообщения.'));
    body.appendChild(sectionTitle('Способы подключения'));
    let g = list();
    const stateRow = (title, on, sub) => h(`<div class="cw-item"><div class="grow"><div class="cw-label">${esc(title)}</div>${sub ? `<div class="cw-sub">${sub}</div>` : ''}</div>
      <span class="cw-badge${on ? ' ok' : ''}">${on ? 'Включено' : 'Выключено'}</span></div>`);
    const addrs = web.addresses.map(a => `${esc(a.label ? a.label + ': ' : '')}<span class="cw-mono">${esc(a.url)}</span>`).join('<br>');
    // На внутреннем экране — настоящие переключатели (страница держит сервер сама и связь не теряет)
    const accessRow = (kind, title, on, sub) => {
      if (!V) return stateRow(title, on, sub);
      const row = h(`<div class="cw-item link"><div class="grow"><div class="cw-label">${esc(title)}</div>${sub ? `<div class="cw-sub">${sub}</div>` : ''}</div>
        <button class="cw-switch${on ? ' on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(title)}"></button></div>`);
      const sw = row.querySelector('button');
      const toggle = () => {
        const next = !on;
        if (kind === 'relay' && next && !web.relayHost) { V.setAccess(kind, true); return; }
        sw.classList.toggle('on', next);
        V.setAccess(kind, next);
        CW.haptic && CW.haptic('tick');
        setTimeout(() => loadWeb().catch(() => {}), 500);
        setTimeout(() => loadWeb().catch(() => {}), 2500);
      };
      sw.onclick = e => { e.stopPropagation(); toggle(); };
      // ссылку в подписи («Постоянная ссылка») нажимать можно, не переключая
      row.onclick = e => { if (!e.target.closest('a')) toggle(); };
      return row;
    };
    g.appendChild(accessRow('wifi', '1. В сети Wi-Fi', web.enabled, web.enabled ? (addrs || 'Телефон не подключён к Wi-Fi') : 'Телефон и компьютер в одной сети Wi-Fi'));
    g.appendChild(accessRow('remote', '2. Через интернет', web.remote, web.bookmark
      ? `Постоянная ссылка: <a href="${esc(web.bookmark)}" target="_blank" rel="noopener">${esc(web.bookmark)}</a>` : esc(web.bookmarkStatus || 'Туннель Cloudflare — телефон в любой сети')));
    g.appendChild(accessRow('relay', '3. Через свой сервер', web.relay, web.relayHost ? '<span class="cw-mono">' + esc(web.relayHost) + '</span>' : (V ? 'Сервер не указан — нажмите, чтобы указать адрес' : 'Пересадка на вашем сервере (VPS)')));
    g.appendChild(h(`<div class="cw-item"><div class="grow"><div class="cw-label">Порт</div><div class="cw-sub">Меняйте, только если порт занят другим приложением (1024–65535)</div></div><span class="cw-mono">${esc(web.port)}</span></div>`));
    if (V) g.appendChild(linkRow('Адрес сервера, установка, порт', 'Свой сервер (VPS): адрес и команда установки, порт, туннель — на экране приложения', () => V.openAppScreen('web_access'), { icon: 'cfg-computer' }));
    body.appendChild(g);
    body.appendChild(h(V
      ? '<p class="cfg-help" style="margin:8px 2px 0">Нажмите строку, чтобы включить или выключить способ. Этот экран работает на самом телефоне — связь с ним не прервётся.</p>'
      : '<p class="cfg-help" style="margin:8px 2px 0">Способы включаются и выключаются на телефоне («Настройки» → «Доступ с компьютера»): выключив способ отсюда, этот браузер сразу потерял бы связь.</p>'));
    const check = h(`<div class="cfg-actions" style="margin-top:12px"><button class="btn">${web.checking ? 'Проверяю…' : 'Проверить подключение'}</button></div>`);
    check.querySelector('button').disabled = web.checking;
    check.querySelector('button').onclick = () => api('POST', '/api/cfg/devices/check').then(r => { web = r; draw(); pollWeb(); }).catch(e => toast(e.message));
    body.appendChild(check);
    if (web.checks.length) {
      const c = h('<div style="margin-top:10px;display:flex;flex-direction:column;gap:4px"></div>');
      web.checks.forEach(l => c.appendChild(h(`<div style="display:flex;gap:8px;font-size:13.5px"><b class="${l.ok ? 'cfg-ok' : 'cfg-err'}" style="width:16px">${l.ok ? '✓' : '✗'}</b><span>${esc(l.text)}</span></div>`)));
      body.appendChild(c);
    }
    if (web.checking) pollWeb();

    body.appendChild(sectionTitle('Устройства'));
    g = list();
    if (!web.devices.length) g.appendChild(h('<div class="cw-item"><div class="cw-sub">Пока ни один компьютер не подключён</div></div>'));
    web.devices.forEach(d => {
      const seen = d.online ? 'Подключён сейчас' : 'Был в сети ' + CW.ago(d.lastSeen);
      const row = h(`<div class="cw-item cfg-dev${d.online ? ' online' : ''}">${icon('cfg-computer')}<div class="grow"><div class="cw-label">${esc(d.name)}${d.current ? ' <span class="cw-badge accent">Этот компьютер</span>' : ''}</div>
        <div class="cw-sub">${esc(seen)}${d.ip ? ' · ' + esc(d.ip) : ''}</div></div>
        <button class="icon-btn sm" title="Переименовать" data-rename>${icon('edit')}</button><button class="icon-btn sm" title="Отключить" data-remove>${icon('trash')}</button></div>`);
      row.querySelector('[data-rename]').onclick = () => renameDevice(d);
      row.querySelector('[data-remove]').onclick = () => confirmBox('Отключить компьютер?',
        `«${d.name}» потеряет доступ. Чтобы подключиться снова, нужно будет ещё раз разрешить доступ на телефоне.`, 'Отключить', () =>
          api('POST', '/api/cfg/devices/remove', { id: d.id }).then(r => {
            if (d.current) { CW.save('token', ''); location.hash = '#/'; location.reload(); return; }
            web = r; draw();
          }).catch(e => toast(e.message)));
      g.appendChild(row);
    });
    body.appendChild(g);
  }
  function pollWeb() {
    if (webTimer) return;
    webTimer = setTimeout(() => {
      webTimer = null;
      if (!ctx || ctx.id !== 'webaccess') return;
      loadWeb().then(r => { if (r.checking) pollWeb(); }).catch(() => {});
    }, 1500);
  }
  function renameDevice(d) {
    modal(`<h3>Название компьютера</h3><input class="field" maxlength="60"><div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Сохранить</button></div>`, (bg, close) => {
      const input = bg.querySelector('input');
      input.value = d.name;
      bg.querySelector('[data-x]').onclick = close;
      const ok = () => {
        const name = input.value.trim();
        if (!name) return;
        close();
        api('POST', '/api/cfg/devices/rename', { id: d.id, name }).then(r => { web = r; draw(); }).catch(e => toast(e.message));
      };
      bg.querySelector('[data-ok]').onclick = ok;
      input.onkeydown = e => { if (e.key === 'Enter') ok(); };
    });
  }

  // ------------------------------------------------------------ Уведомления и работа в фоне
  function drawDevice(body) {
    const s = st(), p = Object.assign({}, D.phone, phoneState() || {});
    const g = list();
    g.appendChild(switchRow('Уведомления', '«Claude работает…» во время ответа (задача не прерывается, когда приложение свёрнуто) и «Готово» по завершении'
      + (V && s.notifications && p.notificationsAllowed === false ? ' · Android запретил уведомления — нажмите ещё раз, чтобы разрешить' : ''),
      s.notifications, v => { setNow({ notifications: v }); if (V && v) V.requestNotifications(); }));
    if (V && s.notifications && p.notificationsAllowed === false) g.lastChild.onclick = () => V.openAppDetails();
    const bgRow = h(`<div class="cw-item${V ? ' link' : ''}"><div class="grow"><div class="cw-label">Работа в фоне</div><div class="cw-sub">${p.unrestricted
      ? 'Без ограничений батареи — задачи продолжаются, когда приложение свёрнуто или закрыто'
      : 'Ограничено экономией батареи — телефон может остановить задачу' + (V ? '. Нажмите, чтобы снять ограничение' : '')}</div></div><span class="cw-badge${p.unrestricted ? ' ok' : ' bad'}">${p.unrestricted ? 'Без ограничений' : 'Ограничено'}</span>${V ? icon('chev', 'class="i cfg-item-chev"') : ''}</div>`);
    if (V) bgRow.onclick = () => (p.unrestricted ? V.openAppDetails() : V.requestUnrestricted());
    g.appendChild(bgRow);
    if (p.manufacturerNote || V) {
      const auto = h(`<div class="cw-item${V ? ' link' : ''}"><div class="grow"><div class="cw-label">Автозапуск</div><div class="cw-sub">${esc(p.manufacturerNote || 'Запуск приложения после перезагрузки и в фоне — настройки приложения в Android')}</div></div>${V ? icon('chev', 'class="i cfg-item-chev"') : ''}</div>`);
      if (V) auto.onclick = () => V.openAutostart();
      g.appendChild(auto);
    }
    body.appendChild(g);
    body.appendChild(h(V
      ? '<p class="cfg-help" style="margin:10px 2px 0">Нажмите строку — откроется системное окно Android. Когда вернётесь, состояние обновится само.</p>'
      : '<p class="cfg-help" style="margin:10px 2px 0">Ограничение батареи и автозапуск настраиваются на телефоне: «Настройки» → «Уведомления и работа в фоне» — там откроются системные окна Android.</p>'));
  }

  function drawWidget(body) {
    if (V) {
      body.appendChild(note('Виджет Claude на рабочем столе Android: переписка, ход работы, «Написать» и «Голос» без открытия приложения.'));
      const g = list();
      g.appendChild(linkRow('Настроить виджет', 'Прозрачность, тема, размер, что показывать — с предпросмотром', () => V.openWidgetSettings(), { icon: 'gear' }));
      g.appendChild(linkRow('Добавить виджет на экран', 'В окне настроек — кнопка «Добавить виджет на экран»', () => V.openWidgetSettings(), { icon: 'plus' }));
      body.appendChild(g);
      return;
    }
    body.appendChild(note('Виджет настраивается на телефоне: «Настройки» → «Виджет на рабочем столе» — прозрачность, тема, размер, что показывать; там же кнопка «Добавить виджет на экран». Виджет живёт на рабочем столе Android, поэтому в браузере его настроек нет.'));
  }

  // ------------------------------------------------------------ Резервная копия
  let backupMsg = null;
  function drawBackup(body) {
    body.appendChild(note('Один файл со всеми чатами, проектами, файлами, памятью и настройками. В копии есть API-ключи и вход в GitHub — храните её только у себя.'));
    const row = h('<div class="cfg-actions"><button class="btn accent" data-save>Сохранить копию</button></div>');
    const b = row.querySelector('[data-save]');
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Готовлю копию…'; backupMsg = null;
      try {
        const r = await api('POST', '/api/cfg/backup');
        const url = CW.base + '/api/cfg/backup-file?name=' + encodeURIComponent(r.name) + '&token=' + encodeURIComponent(CW.S.token);
        const a = h(`<a href="${esc(url)}" download="${esc(r.name)}" style="display:none"></a>`);
        document.body.appendChild(a); a.click(); a.remove();
        backupMsg = { text: `Копия готова (файлов: ${r.files}, ${CW.size(r.size)}) — браузер сохраняет «${r.name}».`, error: false };
      } catch (e) { backupMsg = { text: 'Не удалось сохранить копию: ' + e.message, error: true }; }
      draw();
    };
    body.appendChild(row);
    if (backupMsg) body.appendChild(h(`<div class="${backupMsg.error ? 'cfg-err' : 'cfg-ok'}" style="margin-top:10px">${esc(backupMsg.text)}</div>`));
    body.appendChild(sectionTitle('Восстановление'));
    if (V) {
      body.appendChild(note('Восстановление заменяет все данные и перезапускает приложение — это делается на экране приложения: «Резервная копия» → «Восстановить».'));
      const r = h('<div class="cfg-actions"><button class="btn">Восстановить из копии…</button></div>');
      r.querySelector('button').onclick = () => { toast('Откроются «Настройки» приложения → «Резервная копия»'); V.openAppScreen('settings'); };
      body.appendChild(r);
      return;
    }
    body.appendChild(note('Восстановить копию можно только на телефоне: «Настройки» → «Резервная копия» → «Восстановить». Приложение при этом перезапускается и заменяет все данные — из браузера это оборвало бы связь до ручного запуска приложения.'));
  }

  // ------------------------------------------------------------ О программе
  let updateMsg = null;
  function drawAbout(body) {
    const a = D.app, s = st();
    body.appendChild(h(`<div class="cfg-about"><div class="logo">${CW.LOGO}</div><h2>Claude AI (Android)</h2>
      <div>Версия ${esc(a.version)} (build ${esc(a.build)})</div><div class="cfg-help">${esc(a.phone)}</div></div>`));
    body.appendChild(h('<p class="cfg-note" style="text-align:center;margin-top:12px">Клон оригинального приложения Claude AI и Claude Code. Подключается к стороннему провайдеру по адресу и API-ключу. Включает чат с Claude, режим «Код», проекты, агенты, хуки, MCP, навыки, плагины, GitHub, генерация картинок и видео, артефакты и многое другое.</p>'));
    const row = h('<div class="cfg-actions" style="justify-content:center"><button class="btn accent">Проверить обновления</button></div>');
    const b = row.querySelector('button');
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Проверяю…';
      try {
        const r = await api('POST', '/api/cfg/update');
        updateMsg = r;
        if (r.update) D.app.update = r.update;
      } catch (e) { updateMsg = { status: 'failed', message: e.message }; }
      draw();
    };
    body.appendChild(row);
    const up = (updateMsg && updateMsg.update) || a.update;
    if (updateMsg) body.appendChild(h(`<div class="${updateMsg.status === 'failed' ? 'cfg-err' : 'cfg-ok'}" style="text-align:center;margin-top:10px">${esc(updateMsg.message)}</div>`));
    if (up) {
      body.appendChild(h(`<div class="cw-list" style="margin-top:14px"><div class="cw-item"><div class="grow"><div class="cw-label">Доступна сборка №${esc(up.build)}</div>
        <div class="cw-sub">${esc(up.title || '')}${up.date ? ' · ' + esc(up.date) : ''}. На телефоне открыто окно «Доступно обновление» — нажмите там «Обновить»: установка APK возможна только на телефоне.</div></div>
        ${up.url ? `<a class="btn" href="${esc(up.url)}" target="_blank" rel="noopener">Сборка</a>` : ''}</div></div>`));
    }
    body.appendChild(h('<div style="height:12px"></div>'));
    const g = list();
    g.appendChild(switchRow('Проверять обновления', 'Раз в день при запуске, если выполнен вход в GitHub', s.checkUpdates, v => setNow({ checkUpdates: v })));
    body.appendChild(g);
    body.appendChild(h('<div class="cfg-footer">Разработано VARTA2005</div>'));
  }

  // ------------------------------------------------------------ Использование токенов
  let usage = null;
  function fmt(n) {
    const v = Number(n) || 0;
    const short = (x, suf) => x.toFixed(1).replace(/\.0$/, '') + suf;
    return v < 1000 ? String(v) : v < 1e6 ? short(v / 1e3, 'k') : short(v / 1e6, 'M');
  }
  function drawUsage(body) {
    if (!usage) {
      body.appendChild(h('<div class="empty">Считаю расход…</div>'));
      api('GET', '/api/cfg/usage').then(r => { usage = r; draw(); }).catch(e => { body.innerHTML = ''; body.appendChild(h(`<div class="err-box">${esc(e.message)}</div>`)); });
      return;
    }
    const head = h('<div class="cfg-actions" style="margin-bottom:12px"><span class="cfg-help" style="flex:1">По окнам «Использование» под ответами Claude: все запросы к модели, включая дочерних агентов.</span><button class="btn">Обновить</button></div>');
    head.querySelector('button').onclick = () => { usage = null; draw(); };
    body.appendChild(head);
    const grid = h('<div class="cfg-stats"></div>');
    [['today', 'Сегодня'], ['week', '7 дней'], ['month', '30 дней'], ['all', 'Всё время']].forEach(([k, label]) => {
      const p = usage.periods[k];
      const total = p.input + p.output;
      grid.appendChild(h(`<div class="cfg-stat"><div class="k">${esc(label)}</div><div class="v">${esc(fmt(total))}</div>
        <div class="s">вход ${esc(fmt(p.input))} · выход ${esc(fmt(p.output))}</div><div class="s">ответов: ${esc(p.answers)} · запросов: ${esc(p.steps)}</div>
        ${p.cacheRead ? `<div class="s">из кэша ${esc(fmt(p.cacheRead))}</div>` : ''}${p.agents ? `<div class="s">агенты ${esc(fmt(p.agents))}</div>` : ''}</div>`));
    });
    body.appendChild(grid);
    body.appendChild(sectionTitle('По дням (14 дней)'));
    const max = Math.max(1, ...usage.days.map(d => d.tokens));
    const bars = h('<div class="cfg-bars" role="list"></div>');
    usage.days.slice().reverse().forEach(d => {
      const date = new Date(d.start).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
      bars.appendChild(h(`<div class="cfg-bar" role="listitem" title="${esc(date)}: ${esc(d.tokens.toLocaleString('ru'))} токенов"><span class="d">${esc(date)}</span>
        <span class="t"><span style="width:${(d.tokens / max * 100).toFixed(1)}%"></span></span><span class="n">${esc(fmt(d.tokens))}</span></div>`));
    });
    body.appendChild(bars);
    body.appendChild(sectionTitle('Больше всего токенов'));
    const g = list();
    if (!usage.chats.length) g.appendChild(h('<div class="cw-item"><div class="cw-sub">Пока нет ответов с расходом токенов</div></div>'));
    usage.chats.forEach(c => g.appendChild(linkRow(c.title || 'Без названия', fmt(c.tokens) + ' токенов', () => { location.hash = '#/chat/' + encodeURIComponent(c.id); })));
    body.appendChild(g);
    const est = usage.periods.all.estimated;
    if (est) body.appendChild(h(`<p class="cfg-help" style="margin-top:10px">Ответов с оценкой по длине текста (сервер не сообщил расход): ${esc(est)}.</p>`));
  }

  // ------------------------------------------------------------ регистрация
  CW.page('settings', { title: 'Настройки', render });
  CW.on('settingsMenu', () => [{ sep: true }, { label: 'Все настройки', sub: 'Модель, качество, возможности, GitHub, резервная копия…', onClick: () => CW.go('settings') }]);
  // Переподключение к телефону: свежие данные (несохранённые поля формы остаются)
  CW.on('hello', () => {
    if (!D) return;
    api('GET', '/api/cfg/all').then(d => { applyData(d); if (CW.current().name === 'settings' && !dirty()) draw(); }).catch(() => {});
  });
  // Уход из «Настроек» в чат или другой раздел: изменения сохраняются сами, как при выходе из раздела в приложении
  window.addEventListener('hashchange', () => {
    if (/^#\/settings(\/|$)/.test(location.hash) || !ctx) return;
    if (D && dirty() && canSave()) saveForm(true).then(ok => { if (ok) toast('Изменения настроек сохранены'); });
    ctx = null;
    stopGhPoll();
  });
  // Закрытие вкладки с несохранёнными полями
  window.addEventListener('beforeunload', e => { if (D && dirty()) { e.preventDefault(); e.returnValue = ''; } });
})();
