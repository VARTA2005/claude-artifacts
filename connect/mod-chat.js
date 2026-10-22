/*
 * Раздел mod-chat.js — чат в браузере как в приложении: действия с сообщениями (изменить и отправить заново,
 * повторить, удалить, 👍/👎 с уроком, откат файлов, прочитать вслух, поделиться), команды «/» и навыки,
 * «@» — файлы проекта, голосовой ввод и голосовой режим, панель «Сессия» (среда и результаты), заполнение
 * контекста, поиск по чату, план задач, браузер Claude, экспорт в Markdown и сжатие разговора.
 * API — /api/chatx/… (data/remote/web/WebChatApi.kt). Подключается к основе через window.CW.
 */
(function () {
  'use strict';
  const CW = window.CW;
  if (!CW) return;
  const { S, api, h, esc, icon, toast } = CW;
  const enc = encodeURIComponent;

  // ------------------------------------------------------------ значки и оформление
  const ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
    up1: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
    down1: '<path d="M7 13V4H4v9zM7 13l4 7c1.5 0 2.5-1 2.2-2.6l-.6-3.4H19a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 17.8 4H7"/>',
    retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    rewind: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2"/>',
    speak: '<path d="M4 10v4h4l5 4V6L8 10zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    session: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16M17.5 8h1M17.5 11h1"/>',
    term: '<path d="M4 6l6 6-6 6M12 19h8"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'
  };
  (function injectIcons() {
    const svg = Object.keys(ICONS).map(k => `<symbol id="i-cw-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('');
    const box = document.createElement('div');
    box.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${svg}</defs></svg>`;
    document.body.appendChild(box.firstElementChild);
  })();
  const ic = (name, extra) => icon('cw-' + name, extra);

  const style = document.createElement('style');
  style.textContent = `
.composer-wrap { position: relative; }
.cw-ua { display: flex; gap: 2px; justify-content: flex-end; opacity: 0; transition: opacity .15s; }
.msg.user:hover .cw-ua, .msg.user:focus-within .cw-ua { opacity: 1; }
.msg-actions .icon-btn.on { color: var(--accent); }
.msg-actions .icon-btn.bad { color: var(--danger); }
.msg.assistant:last-child .msg-actions { opacity: 1; }
@media (hover: none) { .msg-actions, .cw-ua { opacity: 1 !important; } }
.cw-errbtns { display: flex; gap: 8px; margin-top: 8px; }
.cw-errbtns .btn { padding: 5px 12px; font-size: 13px; }
.cw-pop { position: absolute; left: 0; right: 0; bottom: calc(100% - 10px); z-index: 30; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px; max-height: 320px; overflow: auto; }
.cw-pop .ph { font-size: 12px; color: var(--muted); padding: 4px 10px 6px; }
.cw-pop .it { display: flex; gap: 10px; align-items: baseline; width: 100%; text-align: left; padding: 7px 10px; border-radius: 8px; }
.cw-pop .it.cur, .cw-pop .it:hover { background: var(--bg-hover); }
.cw-pop .it .nm { font-family: var(--mono); font-size: 13.5px; color: var(--text); white-space: nowrap; }
.cw-pop .it .ds { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.cw-pop .it .tg { font-size: 11px; color: var(--accent); white-space: nowrap; }
.cw-todo, .cw-browser { border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); margin: 0 0 8px; font-size: 14px; overflow: hidden; }
.cw-todo .hd, .cw-browser .hd { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; user-select: none; }
.cw-todo .hd .t, .cw-browser .hd .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-todo .bar { height: 3px; background: var(--border); }
.cw-todo .bar i { display: block; height: 100%; background: var(--accent); transition: width .3s; }
.cw-todo ul { list-style: none; margin: 0; padding: 6px 12px 10px; max-height: 180px; overflow: auto; }
.cw-todo li { display: flex; gap: 8px; padding: 2px 0; color: var(--text-2); }
.cw-todo li .b { width: 16px; flex: none; text-align: center; }
.cw-todo li.done { color: var(--muted); text-decoration: line-through; }
.cw-todo li.cur { color: var(--text); font-weight: 500; }
.cw-todo li.cur .b { color: var(--accent); }
.cw-browser .u { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-browser .shot { display: block; width: 100%; max-height: 340px; object-fit: contain; object-position: top; background: #fff; border-top: 1px solid var(--border); cursor: zoom-in; }
.cw-spin { width: 14px; height: 14px; border: 2px solid var(--border-strong); border-top-color: var(--accent); border-radius: 50%; animation: cw-rot .8s linear infinite; flex: none; }
@keyframes cw-rot { to { transform: rotate(360deg); } }
.cw-ring { position: relative; }
.cw-ring svg.r { width: 20px; height: 20px; transform: rotate(-90deg); }
.cw-ring svg.r circle { fill: none; stroke-width: 3; }
.cw-ring svg.r .tr { stroke: var(--border-strong); }
.cw-ring svg.r .fg { stroke: var(--accent); stroke-linecap: round; transition: stroke-dasharray .3s; }
.cw-ring.hot svg.r .fg { stroke: var(--danger); }
.cw-badge-n { position: absolute; top: 2px; right: 1px; min-width: 15px; height: 15px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 10px; line-height: 15px; text-align: center; padding: 0 3px; font-weight: 600; }
.cw-tb { position: relative; }
.cw-drawer-bg { position: fixed; inset: 0; z-index: 55; background: rgba(20,20,19,.28); }
.cw-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 56; width: 400px; max-width: 100vw; background: var(--bg-elev); border-left: 1px solid var(--border); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.cw-drawer .dh { display: flex; align-items: center; gap: 8px; padding: 14px 14px 10px 18px; border-bottom: 1px solid var(--border); }
.cw-drawer .dh h3 { margin: 0; flex: 1; font-family: var(--serif); font-weight: 500; font-size: 20px; }
.cw-drawer .db { flex: 1; overflow: auto; padding: 6px 18px 24px; }
.cw-drawer .cw-item { padding: 10px 14px; }
.cw-env-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.cw-env-acts .btn { padding: 7px 13px; font-size: 13.5px; }
.cw-res .k { font-size: 12px; white-space: nowrap; }
.cw-res .k.CREATED { color: #3fb950; } .cw-res .k.DELETED { color: var(--danger); } .cw-res .k.MODIFIED { color: #d29922; }
.cw-res .k.OUTPUT, .cw-res .k.ARTIFACT { color: var(--accent); }
.cw-res.del .cw-label { color: var(--muted); text-decoration: line-through; }
.cw-env { display: flex; gap: 10px; align-items: flex-start; }
.cw-env .rd { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border-strong); flex: none; margin-top: 3px; }
.cw-env.on .rd { border-color: var(--accent); box-shadow: inset 0 0 0 3px var(--bg-elev); background: var(--accent); }
.cw-usage .seg { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--border); margin: 10px 0; }
.cw-usage .seg i { display: block; height: 100%; }
.cw-usage .row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; }
.cw-usage .row .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.cw-usage .row .l { flex: 1; }
.cw-usage .row .v { font-variant-numeric: tabular-nums; }
.cw-usage .row .p { width: 56px; text-align: right; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.cw-usage .box { border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; margin-bottom: 14px; background: var(--bg); }
.cw-usage .note { font-size: 12.5px; color: var(--muted); }
.cw-find { position: sticky; top: 0; z-index: 5; display: flex; gap: 6px; align-items: center; margin: 0 auto; max-width: 768px; padding: 8px 24px; background: var(--bg); border-bottom: 1px solid var(--border); }
.cw-find input { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 9px; padding: 6px 10px; background: var(--bg-input); outline: none; }
.cw-find .n { font-size: 13px; color: var(--muted); min-width: 52px; text-align: center; }
mark.cw-hit { background: rgba(250, 204, 21, .45); color: inherit; border-radius: 3px; }
mark.cw-hit.cur { background: rgba(249, 115, 22, .6); }
.c-btn.rec { color: #fff; background: var(--danger); border-color: var(--danger); animation: cw-pulse 1.2s ease-in-out infinite; }
@keyframes cw-pulse { 50% { opacity: .65; } }
.cw-perm { font-size: 12.5px; }
.question.cw-approve { border-color: var(--danger); }
.question.cw-approve .qh { color: var(--danger); display: flex; align-items: center; gap: 6px; }
.question.cw-approve .opt.allow { border-color: var(--accent); }
.question.cw-approve .opt.deny { color: var(--danger); }
.cw-voice { position: fixed; inset: 0; z-index: 70; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px; text-align: center; }
.cw-voice .orb { width: 150px; height: 150px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, var(--accent-2), var(--accent)); box-shadow: 0 10px 50px var(--accent-soft); transition: transform .3s; cursor: pointer; border: 0; }
.cw-voice.listening .orb { animation: cw-breathe 1.4s ease-in-out infinite; }
.cw-voice.thinking .orb { animation: cw-rot 2.4s linear infinite; background: conic-gradient(var(--accent), var(--accent-2), var(--bg-hover), var(--accent)); }
.cw-voice.speaking .orb { animation: cw-breathe .6s ease-in-out infinite; }
@keyframes cw-breathe { 50% { transform: scale(1.08); } }
.cw-voice .st { font-size: 18px; color: var(--text); }
.cw-voice .tx { max-width: 640px; color: var(--muted); font-size: 15px; max-height: 30vh; overflow: auto; white-space: pre-wrap; }
.cw-voice .bt { display: flex; gap: 10px; }
@media (max-width: 860px) { .cw-find { padding: 8px 14px; } .cw-hide-narrow { display: none !important; } }
`;
  document.head.appendChild(style);

  // ------------------------------------------------------------ утилиты
  const chatId = () => (S.chat && S.chat.id) || null;
  const messages = () => (S.chat && S.chat.messages) || [];
  const busy = id => CW.isRunning(id);
  function num(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' млн';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',') + ' тыс.';
    return String(n);
  }
  function pct(part, whole) { return whole > 0 ? (part * 100 / whole).toFixed(1).replace('.', ',') + '%' : '—'; }
  /** Текст ответа без разметки — для чтения вслух */
  function plain(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' (блок кода) ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\|/g, ' ')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/https?:\/\/\S+/g, 'ссылка')
      .replace(/\n{2,}/g, '\n').trim();
  }
  async function post(path, body) { return api('POST', '/api/chatx/' + path, body || {}); }
  function shotUrl() { return CW.base + '/api/chatx/browser/shot?token=' + enc(S.token) + '&t=' + Date.now(); }

  // ------------------------------------------------------------ данные чата (оценки, откаты, план, браузер)
  const META = { id: null, data: null };
  let metaTimer = null;
  function loadMeta(id) {
    id = id || chatId();
    if (!id) return;
    clearTimeout(metaTimer);
    metaTimer = setTimeout(async () => {
      let d;
      try { d = await api('GET', `/api/chatx/${enc(id)}/meta`); } catch (e) { return; }
      if (chatId() !== id) return;
      META.id = id; META.data = d;
      applyMeta();
    }, 60);
  }
  function meta() { return META.id === chatId() ? META.data : null; }

  function applyMeta() {
    const d = meta();
    if (!d) return;
    document.querySelectorAll('#messages .msg.assistant[data-mid]').forEach(el => {
      const id = el.dataset.mid;
      const r = (d.ratings || {})[id] || 0;
      const up = el.querySelector('[data-rate="1"]'), down = el.querySelector('[data-rate="-1"]');
      if (up) up.classList.toggle('on', r === 1);
      if (down) down.classList.toggle('bad', r === -1);
      const rw = el.querySelector('[data-rewind]');
      if (rw) rw.classList.toggle('hidden', !(d.checkpoints || []).includes(Number(id)) || busy(chatId()));
    });
    drawTodo();
    drawBrowser();
    drawTopbarExtras();
  }

  // ------------------------------------------------------------ ответы Claude: кнопки
  CW.on('assistantMessage', (el, m, actions) => {
    if (!actions || !m || m.id === undefined) return;
    el.dataset.mid = m.id;
    const id = chatId();
    const list = messages();
    const lastAssistant = [...list].reverse().find(x => x.role === 'assistant');
    const isLast = lastAssistant && lastAssistant.id === m.id;
    const meta0 = meta();
    const rating = meta0 && meta0.ratings ? (meta0.ratings[m.id] || 0) : 0;
    const btn = (name, title, attrs) => h(`<button class="icon-btn sm" title="${esc(title)}" ${attrs || ''}>${ic(name)}</button>`);
    const metaSpan = actions.querySelector('.meta');
    const add = b => actions.insertBefore(b, metaSpan);
    const speakBtn = btn('speak', 'Прочитать вслух');
    speakBtn.onclick = () => speakToggle(m.id, m.content, speakBtn);
    add(speakBtn);
    const share = btn('share', 'Поделиться');
    share.onclick = () => shareText('Ответ Claude', m.content || '');
    add(share);
    const up = btn('up1', 'Хороший ответ', 'data-rate="1"');
    const down = btn('down1', 'Плохой ответ', 'data-rate="-1"');
    if (rating === 1) up.classList.add('on');
    if (rating === -1) down.classList.add('bad');
    up.onclick = () => rate(m, 1);
    down.onclick = () => rate(m, -1);
    add(up); add(down);
    if (isLast) {
      const retry = btn('retry', 'Повторить');
      retry.onclick = () => retryLast();
      if (busy(id)) retry.classList.add('hidden');
      add(retry);
    }
    const rewind = btn('rewind', 'Откатить изменения файлов', 'data-rewind');
    rewind.classList.toggle('hidden', !(meta0 && (meta0.checkpoints || []).includes(m.id)));
    rewind.onclick = () => rewindFiles(m);
    add(rewind);
    const del = btn('', 'Удалить');
    del.innerHTML = icon('trash');
    del.onclick = () => deleteMessage(m);
    add(del);
    loadMeta(id);
  });

  // Сообщения пользователя: копировать, изменить и отправить заново, удалить
  CW.on('userMessage', (el, m) => {
    if (!m || m.id === undefined) return;
    const wrap = el.querySelector('.wrap');
    if (!wrap) return;
    const bar = h('<div class="cw-ua"></div>');
    const b = (ico, title, fn) => { const x = h(`<button class="icon-btn sm" title="${esc(title)}">${ico}</button>`); x.onclick = fn; bar.appendChild(x); return x; };
    if (m.content) b(icon('copy'), 'Копировать', () => CW.copy(m.content));
    if (!(m.content || '').startsWith('[Автоматически] ')) b(icon('edit'), 'Изменить', () => editMessage(m));
    b(icon('trash'), 'Удалить', () => deleteMessage(m));
    wrap.appendChild(bar);
  });

  async function rate(m, value) {
    const id = chatId();
    const d = meta();
    const cur = d && d.ratings ? (d.ratings[m.id] || 0) : 0;
    const send = async (v, comment) => {
      try {
        await post(`${enc(id)}/rate`, { messageId: m.id, value: v, comment: comment || '' });
        if (d) { d.ratings = d.ratings || {}; if (v) d.ratings[m.id] = v; else delete d.ratings[m.id]; applyMeta(); }
        if (comment) toast(v > 0 ? 'Запомнил, что понравилось' : 'Запомнил ошибку — учту в следующих ответах');
      } catch (e) { toast(e.message); }
    };
    if (cur === value) { send(0); return; }
    const positive = value > 0;
    CW.modal(`<h3>${positive ? 'Что понравилось?' : 'Что не так?'}</h3>
      <p>${positive ? 'Claude запомнит удачный подход и будет держаться его в этом проекте.' : 'Claude запомнит ошибку и не будет повторять её в этом проекте. Напишите, как надо было.'}</p>
      <textarea class="field" placeholder="${positive ? 'Например: коротко и с примерами кода' : 'Например: не проверил сборку'}"></textarea>
      <div class="btns"><button class="btn" data-skip>Без комментария</button><button class="btn primary" data-ok disabled>Запомнить</button></div>`,
    (bg, close) => {
      const ta = bg.querySelector('textarea'), ok = bg.querySelector('[data-ok]');
      ta.oninput = () => { ok.disabled = !ta.value.trim(); };
      ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ta.value.trim()) ok.click(); };
      bg.querySelector('[data-skip]').onclick = () => { close(); send(value, ''); };
      ok.onclick = () => { close(); send(value, ta.value.trim()); };
    });
  }

  async function retryLast() {
    const id = chatId();
    if (busy(id)) { toast('Claude ещё отвечает — дождитесь или нажмите «Стоп»'); return; }
    try { await post(`${enc(id)}/retry`); CW.reloadChat(); } catch (e) { toast(e.message); }
  }

  function editMessage(m) {
    const id = chatId();
    if (busy(id)) { toast('Claude ещё отвечает — изменить можно после ответа'); return; }
    CW.modal(`<h3>Изменить сообщение</h3><p style="font-size:13.5px">Сообщение и всё после него будут заменены, Claude ответит заново.</p>
      <textarea class="field" style="min-height:160px"></textarea>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Отправить</button></div>`,
    (bg, close) => {
      const ta = bg.querySelector('textarea');
      ta.value = m.content || '';
      setTimeout(() => CW.focusSoft(ta), 0);
      const ok = async () => {
        const text = ta.value.trim();
        if (!text && !(m.files || []).length) return;
        close();
        try { await post(`${enc(id)}/edit`, { messageId: m.id, text }); CW.reloadChat(); } catch (e) { toast(e.message); }
      };
      bg.querySelector('[data-x]').onclick = close;
      bg.querySelector('[data-ok]').onclick = ok;
      ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ok(); };
    });
  }

  function deleteMessage(m) {
    const id = chatId();
    CW.confirmBox('Удалить сообщение?', 'Сообщение удалится из чата на телефоне. Остальная переписка останется.', 'Удалить', async () => {
      try { await post(`${enc(id)}/delete-message`, { messageId: m.id }); CW.reloadChat(); } catch (e) { toast(e.message); }
    });
  }

  function rewindFiles(m) {
    const id = chatId();
    CW.confirmBox('Откатить изменения файлов?', 'Файлы проекта вернутся к состоянию до этого ответа (вместе с правками более поздних ответов). Переписка останется. Изменения, сделанные командами терминала, не откатываются.', 'Откатить', async () => {
      try { const r = await post(`${enc(id)}/rewind`, { messageId: m.id }); toast(r.message || 'Готово'); loadMeta(id); } catch (e) { toast(e.message); }
    });
  }

  function shareText(title, text) {
    if (navigator.share && window.isSecureContext) navigator.share({ title, text }).catch(() => {});
    else CW.copy(text);
  }

  // Ошибки в чате: «Повторить» (у последней) и «Скрыть» — как на телефоне
  function decorateErrors() {
    const box = document.getElementById('messages');
    if (!box || !S.chat || !S.chat.messages) return;
    const list = S.chat.messages;
    const kids = box.children;
    for (let i = 0; i < list.length && i < kids.length; i++) {
      const m = list[i], el = kids[i];
      if (!m.error || el._cwErr) continue;
      el._cwErr = true;
      const err = el.querySelector('.err-box');
      if (!err) continue;
      const row = h('<div class="cw-errbtns"></div>');
      if (i === list.length - 1) {
        const r = h(`<button class="btn">${ic('retry', 'style="width:14px;height:14px;vertical-align:-2px"')} Повторить</button>`);
        r.onclick = retryLast;
        row.appendChild(r);
      }
      const x = h('<button class="btn">Скрыть</button>');
      x.onclick = async () => { try { await post(`${enc(S.chat.id)}/delete-message`, { messageId: m.id }); CW.reloadChat(); } catch (e) { toast(e.message); } };
      row.appendChild(x);
      el.appendChild(row);
    }
  }

  // Запрос разрешения (режим «Спрашивать»): карточка вопроса с кнопками «Разрешить» / «Отклонить»
  function decorateApprovals() {
    document.querySelectorAll('#questions .question').forEach(q => {
      if (q._cwApp) return;
      q._cwApp = true;
      const hd = q.querySelector('.qh');
      if (!hd || !/^Разрешить действие/.test(hd.textContent)) return;
      q.classList.add('cw-approve');
      hd.insertAdjacentHTML('afterbegin', ic('shield', 'style="width:15px;height:15px"'));
      q.querySelectorAll('.opt').forEach(o => {
        const t = o.textContent.trim();
        if (/^›?\s*Разрешить$/.test(t) || /Разрешить$/.test(t)) o.classList.add('allow');
        if (/(Отклонить|Запретить)$/.test(t)) o.classList.add('deny');
      });
    });
  }

  // ------------------------------------------------------------ верхняя строка: контекст и «Сессия»
  let tbBox = null;
  CW.on('topbar', route => {
    if (route.name !== 'chat') { tbBox = null; return null; }
    tbBox = h('<span style="display:flex;gap:2px;align-items:center"></span>');
    drawTopbarExtras();
    loadMeta(route.id);
    return tbBox;
  });

  function lastUsage() {
    const m = [...messages()].reverse().find(x => x.role === 'assistant' && x.usage && typeof x.usage === 'object');
    return m ? m.usage : null;
  }

  function drawTopbarExtras() {
    if (!tbBox || !document.body.contains(tbBox)) return;
    const d = meta();
    tbBox.innerHTML = '';
    const find = h(`<button class="icon-btn cw-hide-narrow" title="Найти в чате (Ctrl+Shift+F)">${icon('search')}</button>`);
    find.onclick = openFind;
    tbBox.appendChild(find);
    const u = lastUsage();
    if (u) {
      const win = (d && d.contextWindow > 0 ? d.contextWindow : 0) || u.window || 0;
      const frac = win > 0 ? Math.min(1, (u.context || 0) / win) : 0;
      const C = 2 * Math.PI * 8;
      const ring = h(`<button class="icon-btn cw-ring${frac > 0.8 ? ' hot' : ''}" title="Контекст: ${Math.round(frac * 100)}% — подробнее">
        <svg class="r" viewBox="0 0 20 20"><circle class="tr" cx="10" cy="10" r="8"/><circle class="fg" cx="10" cy="10" r="8" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}"/></svg></button>`);
      ring.onclick = () => usageModal(u, win);
      tbBox.appendChild(ring);
    }
    const sess = h(`<button class="icon-btn cw-tb" title="Сессия: среда и результаты">${ic('session')}${d && d.results ? `<span class="cw-badge-n">${Math.min(99, d.results)}</span>` : ''}</button>`);
    sess.onclick = () => openSession();
    tbBox.appendChild(sess);
  }

  const PART_COLORS = { 'Системный промпт': '#8e7cc3', 'Инструменты': '#4f8fd6', 'Сообщения': '#d97757', 'Файлы': '#3fa37a', 'Изображения': '#d2a03a', 'Ответ': '#d97757', 'Размышления': '#9a7fd1', 'Вызовы инструментов': '#4f8fd6', 'Текст': '#d97757' };
  const FALLBACK = ['#5b9bd5', '#70ad47', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#c55a9a'];
  function partColor(label) {
    if (PART_COLORS[label]) return PART_COLORS[label];
    let x = 0;
    for (const ch of String(label)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    return FALLBACK[x % FALLBACK.length];
  }

  /** «Использование»: заполнение контекста и расход за ответ (как окно на телефоне) */
  function usageModal(u, win) {
    const window_ = Math.max(1, win || u.window || 1);
    const inParts = (u.inParts || []).map(p => ({ label: p.label, tokens: p.tokens || 0 }));
    const inputSum = inParts.reduce((s, p) => s + p.tokens, 0);
    const answer = Math.max(0, (u.context || 0) - inputSum);
    let added = false;
    const parts = inParts.map(p => { if (p.label === 'Сообщения') { added = true; return { label: p.label, tokens: p.tokens + answer }; } return p; });
    if (!added && answer > 0) parts.unshift({ label: 'Сообщения', tokens: answer });
    const ctx = parts.filter(p => p.tokens > 0);
    const used = Math.min(window_, ctx.reduce((s, p) => s + p.tokens, 0));
    const free = Math.max(0, window_ - used);
    const total = (u.in || 0) + (u.out || 0);
    const row = (color, label, v, p) => `<div class="row">${color ? `<span class="dot" style="background:${color}"></span>` : ''}<span class="l">${esc(label)}</span><span class="v">${esc(num(v))}</span><span class="p">${esc(p || '')}</span></div>`;
    const html = `<div class="cw-usage"><h3>Использование</h3>
      <div class="cw-section" style="margin-top:4px">Контекст</div>
      <div class="box"><div style="display:flex"><b style="flex:1;font-weight:500">Контекстное окно</b><span style="color:var(--muted)">Использовано ${Math.round(used * 100 / window_)}%</span></div>
        <div class="seg">${ctx.map(p => `<i style="width:${(p.tokens * 100 / window_).toFixed(2)}%;background:${partColor(p.label)}" title="${esc(p.label)}"></i>`).join('')}</div>
        <div style="color:var(--muted);font-size:13.5px;margin-bottom:6px">${esc(num(used))} из ${esc(num(window_))} токенов</div>
        ${ctx.map(p => row(partColor(p.label), p.label, p.tokens, pct(p.tokens, window_))).join('')}
        ${row('var(--border-strong)', 'Свободно', free, pct(free, window_))}</div>
      <div class="cw-section">Расход за ответ</div>
      <div class="box">${row(null, 'Запросов к модели', u.steps || 0, '')}${row(null, 'Входные токены', u.in || 0, pct(u.in || 0, total))}
        ${u.cacheRead ? row(null, '  из них из кэша', u.cacheRead, pct(u.cacheRead, u.in || 0)) : ''}
        ${u.cacheWrite ? row(null, '  записано в кэш', u.cacheWrite, pct(u.cacheWrite, u.in || 0)) : ''}
        ${row(null, 'Выходные токены', u.out || 0, pct(u.out || 0, total))}
        ${(u.outParts || []).map(p => row(partColor(p.label), '  ' + p.label, p.tokens || 0, pct(p.tokens || 0, u.out || 0))).join('')}
        ${u.agents ? row(null, `Дочерние агенты (${u.agents})`, u.agentTokens || 0, pct(u.agentTokens || 0, total)) : ''}
        <div style="border-top:1px solid var(--border);margin:6px 0"></div>${row(null, 'Всего', total, '')}</div>
      <div class="note">Части контекста рассчитаны пропорционально объёму текста; суммы — по данным сервера.${u.estimated ? ' Сервер не сообщил расход — все числа оценены по длине текста.' : ''}${u.cacheRead ? ' Токены из кэша стоят примерно в 10 раз дешевле.' : ''}</div>
      <div class="btns">${chatId() ? '<button class="btn" data-compact>Сжать разговор</button>' : ''}<button class="btn primary" data-x>Закрыть</button></div></div>`;
    CW.modal(html, (bg, close) => {
      bg.querySelector('.modal').style.maxWidth = '520px';
      bg.querySelector('[data-x]').onclick = close;
      const c = bg.querySelector('[data-compact]');
      if (c) c.onclick = () => { close(); compactChat(chatId()); };
    });
  }

  // ------------------------------------------------------------ панель «Сессия»
  let drawer = null;
  function closeDrawer() { if (drawer) { drawer.bg.remove(); drawer.el.remove(); drawer = null; } }
  function openDrawer(title) {
    closeDrawer();
    const bg = h('<div class="cw-drawer-bg"></div>');
    const el = h(`<aside class="cw-drawer"><div class="dh"><h3>${esc(title)}</h3><button class="icon-btn" data-x title="Закрыть">${icon('x')}</button></div><div class="db"><div class="empty">Загружаю…</div></div></aside>`);
    bg.onclick = closeDrawer;
    el.querySelector('[data-x]').onclick = closeDrawer;
    document.body.appendChild(bg);
    document.body.appendChild(el);
    drawer = { bg, el, body: el.querySelector('.db') };
    return drawer;
  }

  async function openSession(id) {
    id = id || chatId();
    if (!id) return;
    const d = openDrawer('Сессия');
    let s;
    try { s = await api('GET', `/api/chatx/${enc(id)}/session`); } catch (e) { d.body.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
    if (drawer !== d) return;
    drawSession(d, id, s);
  }

  function drawSession(d, id, s) {
    const body = d.body;
    body.innerHTML = '';
    body.appendChild(h('<div class="cw-section">Среда</div>'));
    const envs = h('<div class="cw-list"></div>');
    (s.environments || []).forEach(e => {
      const on = s.environment && e.id === s.environment.id;
      const row = h(`<div class="cw-item link cw-env${on ? ' on' : ''}"><span class="rd"></span><div class="grow"><div class="cw-label">${esc(e.name)}${e.id === s.defaultId ? ' <span class="cw-badge">по умолчанию</span>' : ''}</div><div class="cw-sub">${esc(e.line)}</div></div></div>`);
      row.onclick = async () => {
        // выбранная среда — открыть её настройки (сеть, секреты, переменные, скрипт)
        if (on) { closeDrawer(); CW.go('environments/' + encodeURIComponent(e.id)); return; }
        try { const r = await post(`${enc(id)}/environment`, { id: e.id }); toast('Среда: ' + e.name + '. Скрипт настройки выполнится перед следующим ответом'); drawSession(d, id, r); } catch (er) { toast(er.message); }
      };
      envs.appendChild(row);
    });
    body.appendChild(envs);
    const envLinks = h(`<div class="cw-env-acts"><button class="btn" data-edit>${icon('edit')}<span>Настроить среду</span></button><button class="btn" data-all>${icon('ext-cloud')}<span>Все среды</span></button></div>`);
    envLinks.querySelector('[data-edit]').onclick = () => { closeDrawer(); CW.go('environments/' + encodeURIComponent((s.environment || {}).id || '')); };
    envLinks.querySelector('[data-all]').onclick = () => { closeDrawer(); CW.go('environments'); };
    if (!s.environment) envLinks.querySelector('[data-edit]').remove();
    body.appendChild(envLinks);
    const p = s.place || {};
    body.appendChild(h('<div class="cw-section">Где работает Claude</div>'));
    body.appendChild(h(`<div class="cw-list"><div class="cw-item">${icon('folder')}<div class="grow"><div class="cw-label">${esc(p.project)}</div><div class="cw-sub cw-mono" style="word-break:break-all">${esc(p.folder)}</div></div></div>
      ${p.repo ? `<div class="cw-item">${icon('code')}<div class="grow"><div class="cw-label">${esc(p.branch || 'main')}</div><div class="cw-sub">${esc(p.repo)}${p.repoPath ? ' · папка ' + esc(p.repoPath) : ''}</div></div></div>` : ''}</div>`));
    const res = s.results || [];
    body.appendChild(h(`<div class="cw-section">Результаты${res.length ? ' · ' + res.length : ''}</div>`));
    if (!res.length) {
      body.appendChild(h('<div class="cw-list"><div class="cw-item"><div class="cw-sub">Пока пусто. Здесь появятся файлы, которые Claude создаст, изменит или удалит в этом чате, готовые файлы и артефакты.</div></div></div>'));
      return;
    }
    const list = h('<div class="cw-list"></div>');
    res.slice(0, 300).forEach(r => {
      const deleted = r.kind === 'DELETED';
      const name = String(r.name || r.path).split('/').pop();
      const dir = String(r.name || '').includes('/') ? String(r.name).slice(0, String(r.name).lastIndexOf('/')) : '';
      const ico = r.kind === 'ARTIFACT' ? icon('artifact') : deleted ? icon('trash') : r.image ? icon('file') : icon('code');
      const row = h(`<div class="cw-item cw-res${deleted ? ' del' : ' link'}">${ico}<div class="grow"><div class="cw-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>${dir ? `<div class="cw-sub" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dir)}</div>` : ''}</div><span class="k ${esc(r.kind)}">${esc(r.kindTitle)}</span></div>`);
      if (!deleted) row.onclick = () => openResult(r);
      list.appendChild(row);
    });
    body.appendChild(list);
    if (res.length > 300) body.appendChild(h(`<div class="cw-sub" style="margin-top:6px">… и ещё ${res.length - 300}</div>`));
  }

  const TEXT_EXT = /\.(txt|md|markdown|json|js|mjs|ts|tsx|jsx|kt|kts|java|py|sh|bash|yml|yaml|xml|html?|css|scss|svg|gradle|properties|toml|ini|cfg|conf|csv|log|sql|go|rs|c|h|cpp|hpp|cs|php|rb|swift|dart|lua|r|pl|bat|ps1|dockerfile|gitignore|env)$/i;
  async function openResult(r) {
    if (r.artifactId !== undefined) {
      try {
        const a = await api('GET', '/api/artifacts/' + enc(r.artifactId));
        closeDrawer();
        CW.showPanel({ title: a.title, language: a.language, content: a.content, versions: a.versions || [], version: a.version });
      } catch (e) { toast(e.message); }
      return;
    }
    if (r.exists === false) { toast('Файла больше нет: ' + r.name); return; }
    if (r.image) { CW.lightbox(CW.fileUrl(r.path)); return; }
    if (TEXT_EXT.test(r.path) || !/\.[a-z0-9]{1,6}$/i.test(r.path)) {
      try {
        const res = await fetch(CW.fileUrl(r.path));
        if (!res.ok) throw new Error('Ошибка ' + res.status);
        const text = await res.text();
        const ext = (r.path.match(/\.([a-z0-9]+)$/i) || [])[1] || 'text';
        closeDrawer();
        CW.showPanel({ title: String(r.name || r.path).split('/').pop(), language: ext.toLowerCase(), content: text, versions: [] });
      } catch (e) { toast(e.message); }
      return;
    }
    window.open(CW.fileUrl(r.path, true), '_blank');
  }

  // ------------------------------------------------------------ меню чата
  CW.on('chatMenu', c => {
    const current = chatId() === c.id;
    const items = [
      { sep: true },
      { label: 'Поделиться чатом (Markdown)', sub: 'Скачать файл .md', onClick: () => exportChat(c, false) },
      { label: 'Скопировать чат как Markdown', onClick: () => exportChat(c, true) },
      { label: 'Сжать разговор', sub: 'Сводка и продолжение в новом чате', onClick: () => compactChat(c.id) }
    ];
    if (current) {
      items.push({ label: 'Найти в чате', sub: 'Ctrl+Shift+F', onClick: openFind });
      items.push({ label: 'Сессия: среда и результаты', onClick: () => openSession(c.id) });
      const b = (meta() || {}).browser;
      if (b && b.open && !b.visible) items.push({ label: 'Показать браузер Claude', onClick: () => browserAction('show') });
    }
    return items;
  });

  async function exportChat(c, toClipboard) {
    try {
      const r = await api('GET', `/api/chatx/${enc(c.id)}/export`);
      if (toClipboard) CW.copy(r.markdown);
      else CW.download(r.title || 'Чат', 'md', r.markdown);
    } catch (e) { toast(e.message); }
  }

  async function compactChat(id) {
    if (!id) return;
    if (busy(id)) { toast('Claude ещё отвечает — сжать можно после ответа'); return; }
    toast('Сжимаю разговор…');
    try {
      const r = await post(`${enc(id)}/compact`);
      toast(r.message || 'Разговор сжат');
      if (r.chatId) CW.go('chat/' + enc(r.chatId));
    } catch (e) { toast(e.message); }
  }

  // ------------------------------------------------------------ поиск по чату
  const FIND = { open: false, q: '', hits: [], cur: -1, el: null, render: null };
  function openFind() {
    if (!chatId()) return;
    const sc = document.getElementById('chat-scroll');
    if (!sc) return;
    if (!FIND.el || !sc.contains(FIND.el)) {
      FIND.el = h(`<div class="cw-find">${icon('search')}<input placeholder="Найти в этом чате…"><span class="n"></span>
        <button class="icon-btn sm" data-p title="Предыдущее (Shift+Enter)">${icon('down', 'style="transform:rotate(180deg)"')}</button>
        <button class="icon-btn sm" data-n title="Следующее (Enter)">${icon('down')}</button>
        <button class="icon-btn sm" data-x title="Закрыть (Esc)">${icon('x')}</button></div>`);
      sc.insertBefore(FIND.el, sc.firstChild);
      const input = FIND.el.querySelector('input');
      input.value = FIND.q;
      let t = null;
      input.oninput = () => { clearTimeout(t); t = setTimeout(() => { FIND.q = input.value; highlight(true); }, 120); };
      input.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.stopPropagation(); closeFind(); }
      };
      FIND.el.querySelector('[data-p]').onclick = () => step(-1);
      FIND.el.querySelector('[data-n]').onclick = () => step(1);
      FIND.el.querySelector('[data-x]').onclick = closeFind;
    }
    FIND.open = true;
    const input = FIND.el.querySelector('input');
    CW.focusSoft(input, true);
    highlight(true);
  }
  function closeFind() {
    FIND.open = false; FIND.q = '';
    clearHits();
    if (FIND.el) FIND.el.remove();
    FIND.el = null;
  }
  function clearHits() {
    document.querySelectorAll('mark.cw-hit').forEach(m => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
    FIND.hits = []; FIND.cur = -1;
  }
  function highlight(scroll) {
    clearHits();
    const box = document.getElementById('messages');
    const q = FIND.q.trim().toLowerCase();
    if (box) FIND.render = box.firstElementChild;
    if (!box || !q) { counter(); return; }
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement && !n.parentElement.closest('button,.msg-actions,.cw-ua,svg') && n.nodeValue.toLowerCase().includes(q) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue, low = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let i = 0, k;
      while ((k = low.indexOf(q, i)) >= 0) {
        if (k > i) frag.appendChild(document.createTextNode(text.slice(i, k)));
        const mk = document.createElement('mark');
        mk.className = 'cw-hit'; mk.textContent = text.slice(k, k + q.length);
        frag.appendChild(mk);
        i = k + q.length;
      }
      if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
      node.parentNode.replaceChild(frag, node);
    });
    // Свёрнутые блоки (размышления, действия) с совпадениями раскрываются
    FIND.hits = [...box.querySelectorAll('mark.cw-hit')];
    FIND.hits.forEach(m => { let d = m.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } });
    FIND.cur = FIND.hits.length ? FIND.hits.length - 1 : -1;
    counter();
    if (scroll && FIND.cur >= 0) focusHit();
  }
  function counter() {
    if (!FIND.el) return;
    FIND.el.querySelector('.n').textContent = FIND.q.trim() ? (FIND.hits.length ? `${FIND.cur + 1} из ${FIND.hits.length}` : 'нет') : '';
  }
  function step(d) {
    if (!FIND.hits.length) return;
    FIND.cur = (FIND.cur + d + FIND.hits.length) % FIND.hits.length;
    focusHit(); counter();
  }
  function focusHit() {
    FIND.hits.forEach((m, i) => m.classList.toggle('cur', i === FIND.cur));
    const m = FIND.hits[FIND.cur];
    if (m) m.scrollIntoView({ block: 'center' });
  }
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f' && chatId()) { e.preventDefault(); openFind(); }
    if (e.key === 'Escape' && drawer && !document.querySelector('.modal-bg:not(.leaving)')) closeDrawer();
  });

  // ------------------------------------------------------------ план задач и браузер Claude над полем ввода
  function composerSlot(cls) {
    const box = document.getElementById('composer-box');
    const wrap = box && box.querySelector('.composer-wrap');
    if (!wrap) return null;
    let el = wrap.querySelector(':scope > .' + cls);
    if (!el) {
      el = h(`<div class="${cls} hidden"></div>`);
      const order = ['cw-browser', 'cw-todo'];
      const before = [...wrap.children].find(c => c.classList.contains('composer') || order.indexOf(cls) < order.findIndex(o => c.classList.contains(o)));
      wrap.insertBefore(el, before || wrap.firstChild);
    }
    return el;
  }

  // План над полем ввода теперь рисует app.js (renderPlan: живой план, «Сейчас», последние шаги) — здесь
  // только прячем старое место, чтобы не было двух одинаковых панелей
  function drawTodo() {
    const el = composerSlot('cw-todo');
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  }

  let browserOpen = true;
  let shotTimer = null;
  let browserState = null;
  function drawBrowser() {
    const el = composerSlot('cw-browser');
    if (!el) return;
    const b = browserState || (meta() || {}).browser;
    if (!b || !b.open || !b.visible) { el.classList.add('hidden'); el.innerHTML = ''; el._key = ''; stopShots(); return; }
    const key = [b.title, b.url, b.loading, browserOpen].join('|');
    if (el._key !== key) {
      el._key = key;
      el.classList.remove('hidden');
      el.innerHTML = `<div class="hd">${ic('browser')}<div class="t"><div style="font-weight:500;overflow:hidden;text-overflow:ellipsis">${esc(b.title || 'Браузер Claude')}</div>${b.url ? `<div class="u">${esc(b.url)}</div>` : ''}</div>
        ${b.loading ? '<span class="cw-spin"></span>' : ''}${b.url && /^https?:/.test(b.url) ? `<a class="icon-btn sm" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" title="Открыть страницу на компьютере">${icon('open')}</a>` : ''}
        <button class="icon-btn sm" data-tg title="${browserOpen ? 'Свернуть' : 'Развернуть'}">${icon(browserOpen ? 'down' : 'chev')}</button>
        <button class="icon-btn sm" data-x title="Скрыть браузер">${icon('x')}</button></div>
        ${browserOpen ? '<img class="shot" alt="Страница браузера Claude">' : ''}`;
      el.querySelector('[data-tg]').onclick = e => { e.stopPropagation(); browserOpen = !browserOpen; el._key = ''; drawBrowser(); };
      el.querySelector('[data-x]').onclick = e => { e.stopPropagation(); browserAction('hide'); };
      el.querySelector('.hd').onclick = e => { if (!e.target.closest('a,button')) { browserOpen = !browserOpen; el._key = ''; drawBrowser(); } };
      const img = el.querySelector('.shot');
      if (img) {
        img.onclick = () => CW.lightbox(img.src);
        img.onerror = () => { img.style.display = 'none'; };
        img.onload = () => { img.style.display = ''; };
        img.src = shotUrl();
      }
    }
    if (browserOpen) startShots(); else stopShots();
  }
  function startShots() {
    if (shotTimer) return;
    shotTimer = setInterval(() => {
      const img = document.querySelector('.cw-browser .shot');
      if (!img || document.hidden) { if (!img) stopShots(); return; }
      const next = new Image();
      next.onload = () => { img.src = next.src; img.style.display = ''; };
      next.src = shotUrl();
    }, 2500);
  }
  function stopShots() { clearInterval(shotTimer); shotTimer = null; }
  async function browserAction(what) {
    try { browserState = await post('browser/' + what); drawBrowser(); } catch (e) { toast(e.message); }
  }
  // Состояние браузера Claude, пока открыт чат (страница меняется, пока Claude работает)
  setInterval(async () => {
    if (!chatId() || document.hidden || !S.online) return;
    try {
      const b = await api('GET', '/api/chatx/browser');
      const was = JSON.stringify(browserState);
      browserState = b;
      if (JSON.stringify(b) !== was) drawBrowser();
    } catch (e) { /* нет связи */ }
  }, 4000);

  // ------------------------------------------------------------ поле ввода: «/», «@», голос, разрешения
  let CMDS = null, cmdsAt = 0;
  async function loadCommands(force) {
    if (CMDS && !force && Date.now() - cmdsAt < 60000) return CMDS;
    try { CMDS = await api('GET', '/api/chatx/commands'); cmdsAt = Date.now(); } catch (e) { if (!CMDS) CMDS = { commands: [], skills: [] }; }
    return CMDS;
  }
  CW.on('hello', () => { loadCommands(true); });
  const BUILTIN = ['clear', 'compact', 'init', 'review', 'plan', 'research'];

  function knownCommand(text) {
    const m = text.match(/^\/([^\s/]+)(\s|$)/);
    if (!m) return false;
    const name = m[1].toLowerCase();
    if (BUILTIN.includes(name)) return true;
    if (!CMDS) return false;
    return CMDS.commands.some(c => c.name === name) || CMDS.skills.some(s => s.name.toLowerCase() === name);
  }

  const PERM_SHORT = { BYPASS: 'До конца сам', ASK: 'Спрашивать', ACCEPT_EDITS: 'Принимать правки' };

  CW.on('composer', (wrap, opts, ta) => {
    const row = wrap.querySelector('.c-row');
    const modelBtn = wrap.querySelector('[data-model]');
    const send = wrap.querySelector('[data-send]');
    // Режим разрешений «Кода» (как Shift+Tab в Claude Code): по кругу
    const perm = h(`<button class="c-btn cw-perm hidden" title="Разрешения «Кода» — нажмите, чтобы сменить (Shift+Tab)">${ic('shield', 'style="width:15px;height:15px"')}<span></span></button>`);
    const mic = h(`<button class="c-btn" title="Голосовой ввод">${ic('mic')}</button>`);
    const voice = h(`<button class="c-btn" title="Голосовой режим: разговор с Claude">${ic('wave')}</button>`);
    row.insertBefore(mic, modelBtn);
    row.insertBefore(voice, modelBtn);
    const cycle = () => {
      const modes = (S.info.permissionModes || []).map(m => m.id);
      if (!modes.length) return;
      const cur = modes.indexOf(S.settings.permissionMode);
      const next = modes[(cur + 1) % modes.length];
      CW.setSetting({ permissionMode: next });
      const t = (S.info.permissionModes || []).find(m => m.id === next);
      toast('Разрешения: ' + (t ? t.title : next));
    };
    perm.onclick = cycle;
    const drawPerm = () => {
      const on = !!S.settings.codeMode;
      perm.classList.toggle('hidden', !on);
      const t = (S.info.permissionModes || []).find(m => m.id === S.settings.permissionMode);
      perm.querySelector('span').textContent = PERM_SHORT[S.settings.permissionMode] || (t && t.title) || '';
      perm.classList.toggle('on', on && S.settings.permissionMode !== 'BYPASS');
    };
    const baseUpdate = wrap._update;
    wrap._update = () => { baseUpdate(); drawPerm(); if (opts.chatId) { drawTodo(); drawBrowser(); } };
    setTimeout(drawPerm, 0);
    mic.onclick = () => dictation(ta, mic);
    voice.onclick = () => voiceMode(opts);

    // Подсказки «/» и «@»
    const pop = h('<div class="cw-pop hidden"></div>');
    wrap.insertBefore(pop, wrap.firstChild);
    let items = [], cur = 0, kind = null, token = null, fileTimer = null, fileReq = 0;
    const close = () => { pop.classList.add('hidden'); items = []; kind = null; };
    const drawPop = (title) => {
      if (!items.length) { close(); return; }
      pop.innerHTML = `<div class="ph">${esc(title)}</div>` + items.map((it, i) =>
        `<button class="it${i === cur ? ' cur' : ''}" data-i="${i}"><span class="nm">${esc(it.label)}</span><span class="ds">${esc(it.desc || '')}</span>${it.tag ? `<span class="tg">${esc(it.tag)}</span>` : ''}</button>`).join('');
      pop.classList.remove('hidden');
      pop.querySelectorAll('[data-i]').forEach(b => {
        b.onmousedown = e => { e.preventDefault(); choose(+b.dataset.i); };
      });
      const c = pop.querySelector('.it.cur');
      if (c) c.scrollIntoView({ block: 'nearest' });
    };
    const choose = i => {
      const it = items[i];
      if (!it) return;
      const v = ta.value, pos = ta.selectionStart;
      if (kind === 'cmd') {
        ta.value = '/' + it.name + ' ' + v.replace(/^\/\S*\s?/, '');
        const at = it.name.length + 2;
        ta.setSelectionRange(at, at);
      } else if (kind === 'file' && token) {
        const ins = '@' + it.name + (it.dir ? '/' : ' ');
        ta.value = v.slice(0, token.start) + ins + v.slice(pos);
        const at = token.start + ins.length;
        ta.setSelectionRange(at, at);
      }
      close();
      ta.dispatchEvent(new Event('input'));
      CW.focusSoft(ta);
    };
    const update = async () => {
      const v = ta.value, pos = ta.selectionStart;
      const cm = v.match(/^\/([^\s/]*)$/);
      if (cm && pos === v.length) {
        const data = await loadCommands();
        if (ta.value !== v) return;
        const q = cm[1].toLowerCase();
        const all = data.commands.map(c => ({ name: c.name, label: '/' + c.name, desc: c.description, tag: c.builtin ? '' : (c.plugin || 'команда') }))
          .concat(data.skills.filter(s => !data.commands.some(c => c.name === s.name.toLowerCase())).map(s => ({ name: s.name, label: '/' + s.name, desc: s.description, tag: 'навык' })));
        const starts = all.filter(c => c.name.toLowerCase().startsWith(q));
        const has = all.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q));
        items = starts.concat(has).slice(0, 30);
        kind = 'cmd'; cur = 0;
        drawPop('Команды и навыки');
        return;
      }
      const before = v.slice(0, pos);
      const fm = before.match(/(^|\s)@([^\s@]*)$/);
      if (fm) {
        token = { start: pos - fm[2].length - 1 };
        const q = fm[2];
        clearTimeout(fileTimer);
        fileTimer = setTimeout(async () => {
          const req = ++fileReq;
          let r;
          const p = new URLSearchParams({ q, chatId: opts.chatId || '', projectId: opts.projectId || '' });
          try { r = await api('GET', '/api/chatx/files?' + p.toString()); } catch (e) { return; }
          if (req !== fileReq || !ta.value.slice(0, ta.selectionStart).match(/(^|\s)@([^\s@]*)$/)) return;
          items = (r.files || []).map(f => ({ name: f.path, label: f.path + (f.dir ? '/' : ''), dir: f.dir, desc: '', tag: f.dir ? 'папка' : '' }));
          kind = 'file'; cur = 0;
          if (!items.length) { pop.innerHTML = `<div class="ph">Файлов${q ? ' «' + esc(q) + '»' : ''} в папке проекта нет</div>`; pop.classList.remove('hidden'); kind = 'file'; return; }
          drawPop('Файлы проекта');
        }, 140);
        return;
      }
      close();
    };
    ta.addEventListener('input', update);
    ta.addEventListener('click', update);
    ta.addEventListener('blur', () => setTimeout(close, 150));

    // Отправка команды «/…»: перехват раньше основы (фаза захвата на обёртке)
    async function runCommand() {
      const text = ta.value.trim();
      if (S.files.some(f => f.uploading)) { toast('Дождитесь загрузки файлов'); return; }
      const files = S.files.filter(f => f.path);
      ta.value = ''; S.files = [];
      ta.dispatchEvent(new Event('input'));
      wrap._update();
      const name = text.slice(1).split(/\s/)[0].toLowerCase();
      if (name === 'compact') toast('Сжимаю разговор…');
      try {
        const r = await post('command', { text, chatId: opts.chatId || '', projectId: opts.projectId || '', files: files.map(f => f.path) });
        if (r.message) toast(r.message);
        if (r.action === 'open' && r.chatId) CW.go('chat/' + enc(r.chatId));
        else if (r.action === 'clear') CW.go(r.projectId ? 'project/' + enc(r.projectId) : '');
        else if (r.action === 'settings') { Object.assign(S.settings, r.settings || {}); CW.renderComposerState(); }
        else if (r.action === 'sent') CW.reloadChat();
      } catch (e) {
        toast(e.message);
        ta.value = text; S.files = files; ta.dispatchEvent(new Event('input')); wrap._update();
      }
    }
    wrap.addEventListener('keydown', e => {
      if (e.target !== ta) return;
      if (!pop.classList.contains('hidden') && items.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation();
          cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          drawPop(kind === 'cmd' ? 'Команды и навыки' : 'Файлы проекта');
          return;
        }
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
          // «/команда» целиком набрана — Enter отправляет её, а не выбирает подсказку
          const exact = kind === 'cmd' && items[cur] && ta.value.trim() === '/' + items[cur].name;
          if (!(exact && e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); choose(cur); return; }
        }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && knownCommand(ta.value.trim())) {
        e.preventDefault(); e.stopPropagation();
        close();
        runCommand();
      }
    }, true);
    wrap.addEventListener('click', e => {
      if (!send.contains(e.target) || send.classList.contains('stop') || send.disabled) return;
      if (knownCommand(ta.value.trim())) { e.preventDefault(); e.stopPropagation(); runCommand(); }
    }, true);
    if (!CMDS) loadCommands();
  });

  // ------------------------------------------------------------ голос: диктовка, чтение вслух, голосовой режим
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  function micError(err) {
    // Внутренний экран телефона: распознавание — телефонное, советы — про телефон
    if (window.ClaudeInner) {
      if (err === 'not-allowed') return 'Нет доступа к микрофону — разрешите его: настройки телефона → Приложения → Claude AI → Разрешения → Микрофон';
      if (err === 'service-not-allowed') return 'На телефоне нет распознавания речи — установите приложение Google или включите голосовой ввод';
      if (err === 'network') return 'Распознаванию речи нужен интернет';
      if (err === 'no-speech') return 'Ничего не услышал — попробуйте ещё раз';
      if (err === 'audio-capture') return 'Микрофон занят другим приложением';
      return 'Голосовой ввод: ' + err;
    }
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      return window.isSecureContext ? 'Браузер не дал доступ к микрофону — разрешите его в адресной строке'
        : 'Микрофон в браузере работает только по https: откройте приложение через «Через интернет» или «Через свой сервер»';
    }
    if (err === 'no-speech') return 'Ничего не услышал — попробуйте ещё раз';
    if (err === 'network') return 'Распознавание речи не работает без интернета на компьютере';
    if (err === 'audio-capture') return 'Микрофон не найден';
    return 'Голосовой ввод: ' + err;
  }
  let dict = null;
  function dictation(ta, btn) {
    if (!Recognition) { toast('Голосовой ввод не поддерживается этим браузером — откройте в Chrome, Edge или Яндекс Браузере'); return; }
    if (dict) { dict.rec.stop(); return; }
    const rec = new Recognition();
    rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
    let finalText = '';
    dict = { rec, btn };
    btn.classList.add('rec'); btn.title = 'Остановить запись';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      ta.value = base + finalText + interim;
      ta.dispatchEvent(new Event('input'));
    };
    rec.onerror = e => { if (e.error !== 'aborted') toast(micError(e.error)); };
    rec.onend = () => { btn.classList.remove('rec'); btn.title = 'Голосовой ввод'; dict = null; CW.focusSoft(ta); };
    try { rec.start(); } catch (e) { toast(micError(e.message)); btn.classList.remove('rec'); dict = null; }
  }

  let speaking = null;
  function pickVoice(u) {
    const voices = speechSynthesis.getVoices();
    const v = voices.find(x => /^ru/i.test(x.lang) && /Google|Natural|Online/i.test(x.name)) || voices.find(x => /^ru/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = 'ru-RU';
  }
  function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) { toast('Браузер не умеет читать вслух'); onEnd && onEnd(); return; }
    speechSynthesis.cancel();
    const chunks = plain(text).match(/[^.!?\n]+[.!?\n]*/g) || [plain(text)];
    let i = 0;
    const next = () => {
      if (i >= chunks.length) { onEnd && onEnd(); return; }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      pickVoice(u);
      u.onend = next;
      u.onerror = () => onEnd && onEnd();
      speechSynthesis.speak(u);
    };
    next();
  }
  function speakToggle(id, text, btn) {
    if (speaking === id) { speechSynthesis.cancel(); speaking = null; btn.classList.remove('on'); return; }
    document.querySelectorAll('.msg-actions .icon-btn.on[title="Остановить чтение"]').forEach(b => { b.classList.remove('on'); b.title = 'Прочитать вслух'; });
    speaking = id; btn.classList.add('on'); btn.title = 'Остановить чтение';
    speak(text, () => { if (speaking === id) speaking = null; btn.classList.remove('on'); btn.title = 'Прочитать вслух'; });
  }

  /** Голосовой режим: слушаю → сообщение в чат → жду ответ → читаю вслух → снова слушаю */
  function voiceMode(opts) {
    if (!Recognition) { toast('Голосовой режим не поддерживается этим браузером — откройте в Chrome или Edge'); return; }
    let chat = opts.chatId || null;
    let closed = false, rec = null, waitTimer = null;
    const el = h(`<div class="cw-voice"><button class="orb" title="Нажмите, чтобы говорить или прервать"></button><div class="st">Готовлюсь…</div><div class="tx"></div>
      <div class="bt"><button class="btn" data-x>Завершить</button></div><div class="cw-sub">Голосовой разговор: фразы уходят в чат${chat ? '' : ' (новый)'}, ответы Claude читаются вслух.</div></div>`);
    document.body.appendChild(el);
    const st = el.querySelector('.st'), tx = el.querySelector('.tx');
    const set = (mode, text) => { el.className = 'cw-voice ' + mode; st.textContent = text; };
    const finish = () => {
      closed = true;
      clearInterval(waitTimer);
      try { rec && rec.abort(); } catch (e) {}
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      el.remove();
      document.removeEventListener('keydown', esc_);
    };
    const esc_ = e => { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', esc_);
    el.querySelector('[data-x]').onclick = finish;
    el.querySelector('.orb').onclick = () => {
      if (el.classList.contains('speaking')) { speechSynthesis.cancel(); listen(); }
      else if (el.classList.contains('listening')) { try { rec.stop(); } catch (e) {} }
      else if (el.classList.contains('idle')) listen();
    };
    function listen() {
      if (closed) return;
      rec = new Recognition();
      rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = false;
      let text = '';
      set('listening', 'Слушаю…');
      rec.onresult = e => {
        text = [...e.results].map(r => r[0].transcript).join('');
        tx.textContent = text;
      };
      rec.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') { toast(micError(e.error)); set('idle', 'Нажмите на круг, чтобы говорить'); text = ''; } };
      rec.onend = () => {
        if (closed) return;
        if (text.trim()) sendPhrase(text.trim());
        else if (el.classList.contains('listening')) set('idle', 'Нажмите на круг, чтобы говорить');
      };
      try { rec.start(); } catch (e) { set('idle', 'Нажмите на круг, чтобы говорить'); }
    }
    async function sendPhrase(text) {
      set('thinking', 'Claude думает…');
      // Ответ на эту фразу — сообщение новее последнего, что было в чате до отправки
      const known = chat && S.chat && S.chat.id === chat && S.chat.messages ? S.chat.messages : [];
      const beforeId = known.reduce((mx, m) => Math.max(mx, Number(m.id) || 0), 0);
      try {
        if (chat) {
          await api('POST', `/api/chats/${enc(chat)}/messages`, { text, voice: true });
        } else {
          const r = await api('POST', '/api/chats', { text, projectId: opts.projectId || '', voice: true });
          chat = r.id;
          CW.go('chat/' + enc(chat));
        }
      } catch (e) { toast(e.message); set('idle', 'Нажмите на круг, чтобы говорить'); return; }
      let started = false, polls = 0, checking = false;
      clearInterval(waitTimer);
      waitTimer = setInterval(async () => {
        if (closed) { clearInterval(waitTimer); return; }
        polls++;
        const live = S.live[chat];
        if (live && live.status) st.textContent = /^(Синхронизация|Думаю)/.test(live.status) && live.text ? 'Claude отвечает…' : live.status;
        if (CW.isRunning(chat)) { started = true; return; }
        if ((!started && polls < 6) || checking) return;
        checking = true;
        let data;
        try { data = await api('GET', `/api/chats/${enc(chat)}`); } catch (e) { checking = false; return; }
        checking = false;
        const list = data.messages || [];
        const last = list[list.length - 1];
        // Ответа ещё нет (сообщение в очереди) — ждём до 15 минут
        if (!last || last.role !== 'assistant' || Number(last.id) <= beforeId) {
          if (polls > 1300) { clearInterval(waitTimer); set('idle', 'Ответа нет — нажмите на круг, чтобы говорить'); }
          return;
        }
        clearInterval(waitTimer);
        if (last.error) { tx.textContent = last.content; set('idle', 'Ошибка — нажмите на круг, чтобы повторить фразу'); return; }
        tx.textContent = plain(last.content);
        set('speaking', 'Claude говорит… (нажмите, чтобы перебить)');
        speak(last.content, () => { if (!closed && el.classList.contains('speaking')) listen(); });
      }, 700);
    }
    listen();
  }

  // ------------------------------------------------------------ наблюдение за чатом
  let scanFrame = 0;
  function scan() {
    if (scanFrame) return;
    scanFrame = requestAnimationFrame(() => {
      scanFrame = 0;
      if (!chatId()) return;
      decorateErrors();
      decorateApprovals();
      if (FIND.open && FIND.q) {
        const box = document.getElementById('messages');
        if (box && box.firstElementChild !== FIND.render) highlight(false);
      }
      if (FIND.el && !document.body.contains(FIND.el)) { FIND.el = null; FIND.open = false; }
      drawTodo();
      drawBrowser();
    });
  }
  const view = document.getElementById('view');
  if (view) new MutationObserver(muts => {
    // Свои изменения (подсветка поиска) не перерисовывают
    if (muts.every(m => [...m.addedNodes].every(n => n.nodeType === 3 || (n.nodeName === 'MARK')))) return;
    scan();
  }).observe(view, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => { closeDrawer(); stopShots(); FIND.open = false; FIND.q = ''; FIND.el = null; browserState = null; });
})();
