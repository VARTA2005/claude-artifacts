/* Раздел mod-code.js — «Код» в браузере: файлы проекта и редактор, терминал и фоновые команды, просмотр сайта и
 * dev-сервер, GitHub (репозитории, синхронизация, ветки, PR, issues, Actions, сборка) и планы задач.
 * Подключается к основе через window.CW (см. app.js «модули»), API — /api/code/… (WebCodeApi.kt). */
(function () {
  'use strict';
  const CW = window.CW;
  if (!CW) return;
  const { h, esc, icon, toast } = CW;

  // ------------------------------------------------------------ значки и оформление
  const ICONS = {
    term: '<path d="M4 6l5 5-5 5M11 17h9"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-6 4-11.5 8"/>',
    gh: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    fplus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    dplus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pr: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17V9a3 3 0 0 0-3-3h-4M13 4l-2 2 2 2"/>',
    issue: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    actions: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
    cloudup: '<path d="M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.6 8 4.5 4.5 0 0 1 17 18"/><path d="M12 12v8M9 15l3-3 3 3"/>',
    clouddown: '<path d="M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.6 8 4.5 4.5 0 0 1 17 18"/><path d="M12 12v8M9 17l3 3 3-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    todo: '<path d="M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M5 20h.01M12 20h8"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    console: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>'
  };
  function injectIcons() {
    const defs = document.querySelector('svg defs');
    if (!defs || document.getElementById('i-term')) return;
    defs.insertAdjacentHTML('beforeend', Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join(''));
  }
  injectIcons();
  const ic = (n, s) => icon(n, `style="width:${s || 16}px;height:${s || 16}px"`);

  const CSS = `
.cwc{flex:1;min-height:0;display:flex;flex-direction:column}
.cwc-head{display:flex;align-items:center;gap:8px;padding:6px 16px 0;flex-wrap:wrap}
.cwc-proj{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:10px;border:1px solid var(--border);font-weight:500;max-width:260px}
.cwc-proj span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwc-proj:hover{background:var(--bg-hover)}
.cwc-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);padding:0 12px;margin-top:6px;overflow-x:auto;flex:none}
.cwc-tabs button{padding:8px 12px;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
.cwc-tabs button:hover{color:var(--text)}
.cwc-tabs button.on{color:var(--text);border-bottom-color:var(--accent)}
.cwc-body{flex:1;min-height:0;display:flex;flex-direction:column}
.cwc-bar{display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.cwc-bar .grow{flex:1;min-width:0}
.cwc-sync{background:var(--bg-sidebar);font-size:13px}
.cwc-sync .mono{font-family:var(--mono);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwc-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-2);background:var(--bg);white-space:nowrap}
.cwc-btn:hover{background:var(--bg-hover);color:var(--text)}
.cwc-btn:disabled{opacity:.45;cursor:default}
.cwc-btn.primary{background:var(--text);color:var(--bg);border-color:var(--text)}
.cwc-btn.accent{background:var(--accent);color:#fff;border-color:var(--accent)}
.cwc-btn.danger{color:var(--danger)}
.cwc-btn.ghost{border-color:transparent;background:none}
.cwc-files{flex:1;min-height:0;display:flex}
.cwc-tree{width:290px;flex:none;border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0;background:var(--bg-sidebar)}
.cwc-tree .tools{display:flex;align-items:center;gap:2px;padding:6px 6px 4px 10px}
.cwc-tree .tools .t{flex:1;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.cwc-tree .find{margin:0 8px 6px;display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--bg-input)}
.cwc-tree .find input{flex:1;border:0;outline:none;background:transparent;font-size:13px;min-width:0}
.cwc-list{flex:1;overflow:auto;padding:2px 4px 16px;font-size:13.5px}
.cwc-list.drag{outline:2px dashed var(--accent);outline-offset:-4px}
.cwc-row{display:flex;align-items:center;gap:5px;padding:3px 4px;border-radius:6px;cursor:pointer;white-space:nowrap;color:var(--text-2)}
.cwc-row:hover{background:var(--bg-hover)}
.cwc-row.sel{background:var(--bg-active);color:var(--text)}
.cwc-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.cwc-row .car{width:14px;flex:none;color:var(--muted);display:inline-flex;transition:transform .12s}
.cwc-row .car.open{transform:rotate(90deg)}
.cwc-row .fic{color:var(--muted);flex:none;display:inline-flex}
.cwc-row .fic.dir{color:var(--accent)}
.cwc-row .dots{opacity:0}
.cwc-row:hover .dots,.cwc-row.sel .dots{opacity:1}
.cwc-row .sz{font-size:11px;color:var(--muted)}
.cwc-hit{padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12.5px}
.cwc-hit:hover{background:var(--bg-hover)}
.cwc-hit .p{font-family:var(--mono);color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cwc-hit .l{font-family:var(--mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cwc-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.cwc-fh{display:flex;align-items:center;gap:6px;padding:6px 10px 6px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.cwc-fh .path{flex:1;min-width:120px;font-family:var(--mono);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwc-fh .path .dirty{color:var(--accent)}
.cwc-fh .meta{font-size:12px;color:var(--muted)}
.cwc-code{flex:1;min-height:0;overflow:auto;display:flex;background:var(--bg-code);position:relative}
.cwc-gut{flex:none;padding:12px 10px 40px 12px;text-align:right;color:var(--muted);font:12.5px/20px var(--mono);user-select:none;border-right:1px solid var(--border);background:var(--bg-code);position:sticky;left:0;z-index:1;white-space:pre}
.cwc-src{margin:0;padding:12px 16px 40px;font:13px/20px var(--mono);white-space:pre;tab-size:4;flex:1;min-width:0;font-variant-ligatures:none}
.cwc-src.wrap{white-space:pre-wrap;word-break:break-word}
.cwc-mark{position:absolute;left:0;right:0;height:20px;background:var(--accent-soft);pointer-events:none}
.cwc-ed{flex:1;min-height:0;display:flex;background:var(--bg-code);overflow:hidden}
.cwc-ed .cwc-gut{overflow:hidden;position:static}
.cwc-ed textarea{flex:1;min-width:0;border:0;outline:none;resize:none;background:transparent;color:var(--text);font:13px/20px var(--mono);padding:12px 16px 40px;white-space:pre;tab-size:4;overflow:auto;font-variant-ligatures:none}
.cwc-ed textarea.wrap{white-space:pre-wrap}
.cwc-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);text-align:center;padding:32px;gap:10px}
.cwc-media{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;background:var(--bg-code)}
.cwc-media img,.cwc-media video{max-width:100%;border-radius:8px;box-shadow:var(--shadow)}
.cwc-md{flex:1;overflow:auto;padding:20px 28px;font-family:var(--serif);font-size:16px}
.cwc-term{flex:1;min-height:0;display:flex;flex-direction:column;background:#1e1e1c;color:#e8e6dc}
.cwc-tt-tabs{display:flex;align-items:center;gap:4px;background:#2a2a28;padding:4px 6px;overflow-x:auto;flex:none}
.cwc-tt-tab{display:inline-flex;align-items:center;gap:6px;padding:4px 4px 4px 10px;border-radius:7px;font-size:12.5px;color:#9a988e;cursor:pointer;white-space:nowrap}
.cwc-tt-tab.on{background:#3a3a37;color:#e8e6dc}
.cwc-tt-tab .x{width:20px;height:20px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center}
.cwc-tt-tab .x:hover{background:#4a4a46}
.cwc-tt-add{color:#e8e6dc;width:28px;height:28px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center}
.cwc-tt-add:hover{background:#3a3a37}
.cwc-tt-out{flex:1;min-height:0;overflow:auto;margin:0;padding:10px 14px;font:13px/18px var(--mono);white-space:pre-wrap;word-break:break-word;color:#e8e6dc}
.cwc-tt-keys{display:flex;gap:4px;padding:4px 6px;background:#2a2a28;overflow-x:auto;flex:none}
.cwc-tt-keys button{font:12.5px var(--mono);color:#e8e6dc;background:#3a3a37;border-radius:6px;padding:4px 9px;white-space:nowrap}
.cwc-tt-keys button:hover{background:#4a4a46}
.cwc-tt-in{display:flex;align-items:center;gap:8px;background:#2a2a28;padding:4px 6px 4px 14px;flex:none}
.cwc-tt-in .pr{font:13px var(--mono);color:#8fd18f;white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis}
.cwc-tt-in input{flex:1;min-width:0;background:transparent;border:0;outline:none;color:#e8e6dc;font:13px var(--mono);padding:6px 0}
.cwc-tt-in button{color:#8fd18f;width:30px;height:30px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center}
.cwc-tt-in button:hover{background:#3a3a37}
.cwc-tt-cwd{font:10.5px var(--mono);color:#9a988e;background:#2a2a28;padding:0 14px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}
.cwc-spin{width:10px;height:10px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:spin .8s linear infinite;display:inline-block;flex:none}
.cwc-side{border-top:1px solid var(--border);max-height:38%;overflow:auto;flex:none;background:var(--bg)}
.cwc-side>summary{list-style:none;cursor:pointer;padding:8px 14px;font-size:13px;font-weight:600;color:var(--text-2);display:flex;gap:8px;align-items:center;position:sticky;top:0;background:var(--bg)}
.cwc-side>summary::-webkit-details-marker{display:none}
.cwc-job{display:flex;align-items:center;gap:10px;padding:7px 14px;border-top:1px solid var(--border);font-size:13px}
.cwc-job .c{flex:1;min-width:0;font-family:var(--mono);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwc-job .s{font-size:12px;color:var(--muted);white-space:nowrap}
.cwc-pv{flex:1;min-height:0;display:flex;flex-direction:column}
.cwc-stage{flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;background:var(--bg-sidebar);padding:12px}
.cwc-stage iframe{border:1px solid var(--border);border-radius:10px;background:#fff;height:100%;min-height:400px;box-shadow:var(--shadow)}
.cwc-console{border-top:1px solid var(--border);height:180px;flex:none;display:flex;flex-direction:column;background:var(--bg)}
.cwc-console .lines{flex:1;overflow:auto;font:12px/1.5 var(--mono);padding:4px 12px}
.cwc-console .ERROR{color:var(--danger)} .cwc-console .WARNING{color:#b7791f}
.cwc-chip{padding:4px 10px;border-radius:8px;border:1px solid var(--border);font-size:12.5px;color:var(--text-2)}
.cwc-chip.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.cwc-sel{border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--bg);font-size:13px;max-width:260px}
.cwc-in{border:1px solid var(--border);border-radius:8px;padding:5px 9px;background:var(--bg-input);outline:none;font-size:13px;min-width:0}
.cwc-in:focus{border-color:var(--border-strong)}
.cwc-scroll{flex:1;min-height:0;overflow:auto}
.cwc-pad{padding:16px 20px 40px;max-width:1100px;margin:0 auto;width:100%}
.cwc-card{border:1px solid var(--border);border-radius:12px;background:var(--bg-elev);padding:14px 16px;margin-bottom:14px}
.cwc-card h3{margin:0 0 8px;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center}
.cwc-rrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);cursor:pointer}
.cwc-rrow:first-child{border-top:0}
.cwc-rrow:hover{background:var(--bg-hover)}
.cwc-rrow .t{flex:1;min-width:0}
.cwc-rrow .n{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:6px;align-items:center}
.cwc-rrow .d{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwc-st{font-size:11.5px;border-radius:6px;padding:1px 7px;white-space:nowrap;background:var(--bg-hover);color:var(--muted)}
.cwc-st.ok{background:rgba(63,125,78,.14);color:var(--ok)} .cwc-st.bad{background:var(--danger-soft);color:var(--danger)} .cwc-st.run{background:var(--accent-soft);color:var(--accent)} .cwc-st.pur{background:rgba(130,80,223,.14);color:#8250df}
.cwc-pre{margin:0;background:var(--bg-code);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font:12.5px/1.55 var(--mono);white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow:auto}
.cwc-diff .a{color:var(--ok);background:rgba(63,125,78,.08);display:block} .cwc-diff .r{color:var(--danger);background:var(--danger-soft);display:block} .cwc-diff .hh{color:#2f6aa3;display:block}
.cwc-status{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px}
.cwc-status.err{color:var(--danger)}
.cwc-steps{font-size:12.5px;color:var(--muted);padding-left:22px;margin:4px 0}
.cwc-plan{border:1px solid var(--border);border-radius:12px;background:var(--bg-elev);padding:12px 16px;margin-bottom:12px;cursor:pointer}
.cwc-plan:hover{border-color:var(--border-strong)}
.cwc-plan .ttl{display:flex;align-items:center;gap:8px;font-weight:600}
.cwc-plan .bar{height:4px;border-radius:2px;background:var(--bg-hover);margin:8px 0;overflow:hidden}
.cwc-plan .bar i{display:block;height:100%;background:var(--accent)}
.cwc-plan .it{display:flex;gap:8px;align-items:flex-start;font-size:14px;padding:2px 0}
.cwc-plan .it.done{color:var(--muted);text-decoration:line-through}
.cwc-plan .it.now{color:var(--accent);font-weight:500}
.cwc-plan .mk{width:16px;height:21px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--ok)}
.cwc-plan .ring{width:10px;height:10px;border-radius:50%;border:1.6px solid var(--muted)}
.page.cwc-todo{padding-left:24px;padding-right:24px}
.cwc-narrow-back{display:none}
@media (max-width:860px){
  .cwc-tree{width:auto;flex:1;border-right:0}
  .cwc-files.open .cwc-tree{display:none}
  .cwc-files:not(.open) .cwc-main{display:none}
  .cwc-narrow-back{display:inline-flex}
  .cwc-head{padding:6px 12px 0}
  .cwc-pad{padding:12px 14px 40px}
}`;
  document.head.appendChild(h(`<style id="mod-code-css">${CSS}</style>`));

  // ------------------------------------------------------------ помощники
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function qs(o) {
    const p = Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v));
    return p.length ? '?' + p.join('&') : '';
  }
  const get = (p, o) => CW.api('GET', '/api/code/' + p + qs(o));
  const post = (p, b) => CW.api('POST', '/api/code/' + p, b || {});
  const rawUrl = (pid, path, dl) => CW.base + '/api/code/raw' + qs({ project: pid, path, download: dl ? 1 : '', token: CW.S.token });
  const ghRawUrl = (repo, path, ref, dl) => CW.base + '/api/code/gh/raw' + qs({ repo, path, ref, download: dl ? 1 : '', token: CW.S.token });
  const alive = el => el && el.isConnected;
  const join = (dir, name) => (!dir || dir === '.') ? name : dir + '/' + name;
  const parentOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.';
  const baseName = p => p.split('/').pop();
  const pidOf = id => (!id || id === 'default') ? '' : id;
  const routeId = pid => pid ? encodeURIComponent(pid) : 'default';

  /** Долгое действие на телефоне: ждём окончания операции, status — в onStatus. */
  async function runOp(res, onStatus) {
    let st = res.state;
    let last = '';
    while (st.running) {
      if (onStatus && st.status !== last) { last = st.status; onStatus(st.status); }
      await sleep(900);
      st = await get('ops/' + res.op);
    }
    if (st.error) throw new Error(st.error);
    return st.result;
  }

  /** Строка состояния: «Загружаю…» с кружком или ошибка. */
  function statusLine() {
    const el = h('<div class="cwc-status hidden"></div>');
    el.busy = text => { el.className = 'cwc-status'; el.innerHTML = `<span class="cwc-spin"></span>${esc(text)}`; };
    el.ok = text => { el.className = 'cwc-status'; el.innerHTML = `<span style="color:var(--ok)">${ic('check', 14)}</span>${esc(text)}`; };
    el.err = text => { el.className = 'cwc-status err'; el.textContent = text; };
    el.clear = () => { el.className = 'cwc-status hidden'; el.textContent = ''; };
    return el;
  }

  function promptBox(title, label, value, okText, onOk, opts) {
    const multi = opts && opts.multi;
    CW.modal(`<h3>${esc(title)}</h3>${label ? `<p style="margin:0 0 8px;font-size:14px">${esc(label)}</p>` : ''}
      ${multi ? `<textarea class="field" style="min-height:${opts.height || 120}px;font-family:${opts.mono ? 'var(--mono)' : 'inherit'};font-size:13.5px">${esc(value || '')}</textarea>`
        : `<input class="field" value="${esc(value || '')}" placeholder="${esc((opts && opts.placeholder) || '')}">`}
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>${esc(okText)}</button></div>`,
      (bg, close) => {
        const input = bg.querySelector('input,textarea');
        const ok = () => { const v = input.value; if (!multi && !v.trim()) return; close(); onOk(multi ? v : v.trim()); };
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = ok;
        input.onkeydown = e => { if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) { e.preventDefault(); ok(); } };
      });
  }

  /** «Спросить Claude»: новый чат проекта с готовым текстом (как на телефоне — текст можно дописать). */
  function askClaude(pid, text) {
    CW.modal(`<h3>Спросить Claude</h3><p style="font-size:14px;margin:0 0 8px">Новый чат ${pid ? 'в проекте' : 'в общей папке'}. Допишите вопрос:</p>
      <textarea class="field" style="min-height:220px;font-size:13.5px">${esc(text)}</textarea>
      <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn accent" data-ok>Отправить</button></div>`,
      (bg, close) => {
        const ta = bg.querySelector('textarea');
        setTimeout(() => { CW.focusSoft(ta); ta.scrollTop = ta.scrollHeight; }, 0);
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = async () => {
          const t = ta.value.trim();
          if (!t) return;
          close();
          try {
            const res = await CW.api('POST', '/api/chats', { text: t, projectId: pid || '' });
            location.hash = '#/chat/' + encodeURIComponent(res.id);
          } catch (e) { toast(e.message); }
        };
      });
  }

  function startCodeChat(pid) {
    CW.setSetting({ codeMode: true });
    location.hash = pid ? '#/project/' + encodeURIComponent(pid) : '#/';
  }

  // ------------------------------------------------------------ подсветка кода
  const LANG = {
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', tsx: 'ts', kt: 'kotlin', kts: 'kotlin', java: 'java', py: 'python', rb: 'ruby',
    sh: 'bash', bash: 'bash', zsh: 'bash', yml: 'yaml', yaml: 'yaml', toml: 'toml', json: 'json', html: 'html', htm: 'html', xml: 'xml',
    svg: 'xml', css: 'css', scss: 'css', md: 'markdown', go: 'go', rs: 'rust', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'cs',
    swift: 'swift', dart: 'dart', php: 'php', sql: 'sql', gradle: 'kotlin', properties: 'toml', ini: 'toml', dockerfile: 'dockerfile',
    makefile: 'makefile', r: 'r', lua: 'lua', txt: 'text', log: 'text', csv: 'text', ps1: 'ps1', bat: 'text', vue: 'html'
  };
  function langOf(path) {
    const name = baseName(path).toLowerCase();
    if (name === 'dockerfile' || name === 'makefile') return name;
    return LANG[name.includes('.') ? name.split('.').pop() : ''] || 'text';
  }
  const KW = new Set(('abstract and as async await break case catch class const continue data def default del do elif else enum export extends ' +
    'false final finally fn for from fun function func go if impl import in interface is lambda let match module mut new nil none not null ' +
    'object or override package pass private protected pub public raise return self static struct super switch this throw throws true try type ' +
    'typeof undefined use val var void when where while with yield True False None internal suspend companion init lateinit sealed open').split(' '));
  const HASH = new Set(['python', 'bash', 'yaml', 'ruby', 'toml', 'r', 'dockerfile', 'makefile', 'ps1']);
  function highlight(code, lang) {
    if (code.length > 400000 || lang === 'text' || lang === 'markdown') return esc(code);
    if (lang === 'html' || lang === 'xml') {
      return esc(code).replace(/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([A-Za-z][\w:-]*)|(\s)([\w:-]+)(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g,
        (m, c, lt, tag, sp, attr, eq, val) => c ? `<span class="tok-c">${c}</span>` : lt ? `${lt}<span class="tok-k">${tag}</span>` : `${sp}<span class="tok-n">${attr}</span>${eq}<span class="tok-s">${val}</span>`);
    }
    const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      last = re.lastIndex;
      if (m[1]) {
        const isHash = m[1][0] === '#', isSlash = m[1][0] === '/' && m[1][1] === '/';
        if ((isHash && !HASH.has(lang)) || (isSlash && HASH.has(lang) && lang !== 'toml')) { out += esc(m[1][0]); re.lastIndex = m.index + 1; last = re.lastIndex; continue; }
        out += `<span class="tok-c">${esc(m[1])}</span>`;
      } else if (m[2]) {
        if (m[2][0] === "'" && (lang === 'kotlin' || lang === 'rust') && m[2].length > 4) { out += esc(m[2][0]); re.lastIndex = m.index + 1; last = re.lastIndex; continue; }
        out += `<span class="tok-s">${esc(m[2])}</span>`;
      } else if (m[3]) out += `<span class="tok-n">${esc(m[3])}</span>`;
      else if (m[4]) out += KW.has(m[4]) ? `<span class="tok-k">${esc(m[4])}</span>` : esc(m[4]);
    }
    return out + esc(code.slice(last));
  }
  function diffHtml(text) {
    return text.split('\n').map(l => {
      if (/^(\+\+\+|---)/.test(l)) return `<span class="hh">${esc(l)}</span>`;
      if (l[0] === '+') return `<span class="a">${esc(l)}</span>`;
      if (l[0] === '-') return `<span class="r">${esc(l)}</span>`;
      if (l.startsWith('@@')) return `<span class="hh">${esc(l)}</span>`;
      return esc(l);
    }).join('\n');
  }

  // ------------------------------------------------------------ проекты
  let PROJECTS = null;
  async function loadProjects(force) {
    if (!PROJECTS || force) PROJECTS = await get('projects');
    return PROJECTS;
  }
  function projectName(pid) {
    const p = PROJECTS && PROJECTS.projects.find(x => x.id === (pid || ''));
    return p ? p.name : (pid ? 'Проект' : 'Общая папка');
  }
  function projectPicker(pid, onPick) {
    const b = h(`<button class="cwc-proj" title="Выбрать папку проекта">${ic('folder')}<span>${esc(projectName(pid))}</span>${ic('down', 14)}</button>`);
    b.onclick = async () => {
      const data = await loadProjects(true).catch(e => { toast(e.message); return null; });
      if (!data) return;
      CW.menu(b, [{ header: 'Рабочая папка' }].concat(data.projects.map(p => ({
        label: p.name, sub: p.repo ? p.repo + (p.folder ? '/' + p.folder : '') + ' · ' + p.branch : (p.id ? '' : 'без проекта'),
        checked: p.id === (pid || ''), onClick: () => onPick(p.id)
      }))));
    };
    return b;
  }

  // ============================================================ страница «Код»
  const TABS = [
    { id: 'files', label: 'Файлы', icon: 'file' },
    { id: 'term', label: 'Терминал', icon: 'term' },
    { id: 'preview', label: 'Просмотр', icon: 'eye' },
    { id: 'github', label: 'GitHub', icon: 'gh' }
  ];

  function codePage(routeArg) {
    const parts = String(routeArg || '').split('/');
    const pid = pidOf(parts[0]);
    let tab = TABS.some(t => t.id === parts[1]) ? parts[1] : (CW.load('codeTab') || 'files');
    const root = h('<div class="cwc"></div>');
    const head = h('<div class="cwc-head"></div>');
    const tabs = h('<div class="cwc-tabs"></div>');
    const sync = h('<div></div>');
    const body = h('<div class="cwc-body"></div>');
    root.append(head, tabs, sync, body);
    const ctx = { pid, project: null, openFile: null, files: null, refreshFiles: () => {} };

    function drawHead() {
      head.innerHTML = '';
      head.appendChild(projectPicker(pid, id => CW.go('code/' + routeId(id) + '/' + tab)));
      head.appendChild(h('<div style="flex:1"></div>'));
      const cc = h(`<button class="cwc-btn accent">${ic('spark')}Claude Code</button>`);
      cc.title = 'Новый чат Claude Code в этом проекте';
      cc.onclick = () => startCodeChat(pid);
      head.appendChild(cc);
    }
    function drawTabs() {
      tabs.innerHTML = '';
      TABS.forEach(t => {
        const b = h(`<button class="${t.id === tab ? 'on' : ''}">${ic(t.icon, 15)}${esc(t.label)}</button>`);
        b.onclick = () => { if (t.id === tab) return; tab = t.id; CW.save('codeTab', tab); history.replaceState(null, '', '#/code/' + routeId(pid) + '/' + tab); drawTabs(); drawBody(); };
        tabs.appendChild(b);
      });
    }
    function drawBody() {
      body.innerHTML = '';
      if (tab === 'files') body.appendChild(filesView(ctx));
      else if (tab === 'term') body.appendChild(terminalView(ctx, true));
      else if (tab === 'preview') body.appendChild(previewView(ctx));
      else body.appendChild(githubView(ctx));
    }
    ctx.showTab = (t, extra) => { tab = t; CW.save('codeTab', t); ctx.extra = extra; drawTabs(); drawBody(); ctx.extra = null; };
    ctx.reloadSync = () => drawSync();
    function drawSync() {
      sync.innerHTML = '';
      if (ctx.project && ctx.project.repo) sync.appendChild(syncBar(ctx));
    }

    loadProjects(true).then(data => {
      ctx.project = data.projects.find(p => p.id === pid) || null;
      if (pid && !ctx.project) { body.innerHTML = '<div class="cwc-empty">Проект не найден</div>'; return; }
      ctx.github = data.github;
      drawHead(); drawSync();
    }).catch(e => toast(e.message));
    drawHead(); drawTabs(); drawBody();
    return root;
  }

  // ------------------------------------------------------------ синхронизация с репозиторием проекта
  function syncBar(ctx) {
    const p = ctx.project;
    const el = h(`<div class="cwc-bar cwc-sync">${ic('link', 15)}<div class="grow"><div class="mono">${esc(p.repo + (p.folder ? '/' + p.folder : ''))}</div>
      <div style="font-size:12px;color:var(--muted)">ветка ${esc(p.branch)}</div></div></div>`);
    const st = statusLine();
    el.insertBefore(st, el.querySelector('.grow').nextSibling);
    const pullBtn = h(`<button class="cwc-btn" title="Забрать изменения из GitHub, сохранив свои">${ic('clouddown')}Загрузить</button>`);
    const pushBtn = h(`<button class="cwc-btn" title="Отправить изменения папки в GitHub одним коммитом">${ic('cloudup')}Отправить</button>`);
    const more = h(`<button class="icon-btn sm" title="Ещё">${icon('dots')}</button>`);
    el.append(pullBtn, pushBtn, more);
    let busy = false;
    const task = async (label, fn) => {
      if (busy) return;
      busy = true; pullBtn.disabled = pushBtn.disabled = true;
      st.busy(label);
      try { await fn(); } catch (e) { st.err('Ошибка: ' + e.message); } finally { busy = false; pullBtn.disabled = pushBtn.disabled = false; }
    };
    const changed = () => { ctx.refreshFiles && ctx.refreshFiles(); };
    function merge(prefer) {
      task('Получаю изменения…', async () => {
        const r = await runOp(await post('sync/pull', { project: ctx.pid, prefer: prefer || '' }), s => st.busy(s));
        if (r.conflicts.length) {
          st.ok(`Получено изменений: ${r.applied.length}. Есть конфликты`);
          CW.modal(`<h3>Конфликт с GitHub</h3><p>Эти файлы изменены и здесь, и в GitHub. Какую версию оставить?</p>
            <pre class="cwc-pre" style="max-height:240px">${esc(r.conflicts.join('\n'))}</pre>
            <div class="btns"><button class="btn" data-r>Взять из GitHub</button><button class="btn primary" data-l>Оставить мои</button></div>`, (bg, close) => {
            bg.querySelector('[data-r]').onclick = () => { close(); merge('remote'); };
            bg.querySelector('[data-l]').onclick = () => { close(); merge('local'); };
          });
        } else if (!r.applied.length && !prefer) st.ok('Новых изменений в GitHub нет');
        else st.ok(`Получено из GitHub изменений: ${r.applied.length} (свои правки сохранены)`);
        if (r.applied.length || prefer) changed();
      });
    }
    pullBtn.onclick = () => merge(null);
    pushBtn.onclick = () => task('Сравниваю с GitHub…', async () => {
      const s = await runOp(await post('sync/status', { project: ctx.pid }), x => st.busy(x));
      if (!s.changes.length) { st.ok('Нет изменений для отправки'); return; }
      st.clear();
      const mark = k => k === 'ADDED' ? '+' : k === 'DELETED' ? '−' : '~';
      const color = k => k === 'ADDED' ? 'var(--ok)' : k === 'DELETED' ? 'var(--danger)' : 'var(--text)';
      CW.modal(`<h3>Отправить изменения</h3><p style="font-size:13px;color:var(--muted)">${esc(p.repo)} · ветка ${esc(p.branch)} · файлов: ${s.changes.length}</p>
        <div class="cwc-pre" style="max-height:240px;margin-bottom:10px">${s.changes.slice(0, 300).map(c => `<div style="color:${color(c.kind)}">${mark(c.kind)} ${esc(c.path)}</div>`).join('')}${s.changes.length > 300 ? `<div>… и ещё ${s.changes.length - 300}</div>` : ''}</div>
        ${s.skipped.length ? `<p style="color:var(--danger);font-size:13px">Не отправятся (больше 50 МБ): ${esc(s.skipped.join(', '))}</p>` : ''}
        ${s.truncated ? '<p style="color:var(--danger);font-size:13px">Репозиторий слишком большой для сравнения через API — отправка недоступна.</p>' : ''}
        <input class="field" value="Изменения из Claude app" placeholder="Описание коммита">
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok ${s.truncated ? 'disabled' : ''}>Отправить</button></div>`, (bg, close) => {
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = () => {
          const message = bg.querySelector('input').value.trim();
          if (!message) return;
          close();
          task('Отправляю…', async () => {
            const r = await runOp(await post('sync/push', { project: ctx.pid, message }), x => st.busy(x));
            st.ok('Отправлено в GitHub: коммит ' + r.sha);
          });
        };
      });
    });
    more.onclick = () => CW.menu(more, [
      { label: 'Заменить файлами из GitHub', sub: 'Папка станет как ветка ' + p.branch, onClick: () => task('Проверяю изменения…', async () => {
        const s = await runOp(await post('sync/status', { project: ctx.pid }), x => st.busy(x));
        const replace = () => task('Загружаю…', async () => {
          const r = await runOp(await post('sync/replace', { project: ctx.pid }), x => st.busy(x));
          st.ok('Загружено из GitHub: файлов ' + r.count); changed();
        });
        if (!s.changes.length) { busy = false; replace(); return; }
        st.clear();
        CW.confirmBox('Загрузить из GitHub?', `В папке проекта есть изменения, которых нет на GitHub (${s.changes.length}). Они будут заменены файлами ветки ${p.branch}. Чтобы сохранить их, сначала нажмите «Отправить».`, 'Заменить', () => { busy = false; replace(); });
      }) },
      { label: 'Открыть на GitHub', onClick: () => window.open('https://github.com/' + p.repo + '/tree/' + encodeURIComponent(p.branch) + (p.folder ? '/' + p.folder : ''), '_blank', 'noopener') },
      { sep: true },
      { label: 'Отключить репозиторий от проекта', danger: true, onClick: () => CW.confirmBox('Отключить репозиторий?', 'Файлы останутся в папке проекта, связь с ' + p.repo + ' пропадёт.', 'Отключить', async () => {
        try { await post('gh/unlink', { project: ctx.pid }); ctx.project.repo = ''; ctx.reloadSync(); toast('Репозиторий отключён'); } catch (e) { toast(e.message); }
      }) }
    ], { alignRight: true });
    return el;
  }

  // ============================================================ файлы и редактор
  function filesView(ctx) {
    const pid = ctx.pid;
    const root = h('<div class="cwc-files"></div>');
    const tree = h(`<div class="cwc-tree"><div class="tools"><span class="t">Файлы</span></div>
      <div class="find">${ic('search', 14)}<input placeholder="Найти файл или текст…"></div><div class="cwc-list"></div></div>`);
    const main = h('<div class="cwc-main"></div>');
    root.append(tree, main);
    const list = tree.querySelector('.cwc-list');
    const findInput = tree.querySelector('.find input');
    const tools = tree.querySelector('.tools');
    const key = 'codeOpen:' + (pid || 'default');
    let expanded = new Set(); try { expanded = new Set(JSON.parse(CW.load(key) || '[]')); } catch (e) {}
    const cache = {};
    let selected = null;
    let loadError = '';
    let editor = null; // { path, dirty() }
    const saveExpanded = () => CW.save(key, JSON.stringify([...expanded].slice(0, 200)));

    const tbtn = (name, title, fn) => { const b = h(`<button class="icon-btn sm" title="${esc(title)}">${ic(name, 15)}</button>`); b.onclick = fn; tools.appendChild(b); return b; };
    const targetDir = () => {
      if (!selected) return '.';
      const e = findEntry(selected);
      return e && e.dir ? selected : parentOf(selected);
    };
    tbtn('fplus', 'Новый файл', () => createIn(targetDir(), false));
    tbtn('dplus', 'Новая папка', () => createIn(targetDir(), true));
    tbtn('upload', 'Загрузить файлы в папку', () => pickUpload(targetDir()));
    tbtn('refresh', 'Обновить', () => refresh());

    function findEntry(path) {
      for (const k in cache) { const e = (cache[k] || []).find(x => x.path === path); if (e) return e; }
      return null;
    }
    async function load(dir) {
      try { const r = await get('files', { project: pid, path: dir }); cache[dir] = r.entries; if (dir === '.') loadError = ''; }
      catch (e) { cache[dir] = []; if (dir === '.') loadError = e.message; throw e; }
    }
    async function refresh() {
      const dirs = ['.', ...expanded];
      Object.keys(cache).forEach(k => delete cache[k]);
      await Promise.all(dirs.map(d => load(d).catch(() => { if (d !== '.') expanded.delete(d); })));
      draw();
    }
    ctx.refreshFiles = () => { if (alive(root)) refresh(); };

    function draw() {
      if (findInput.value.trim()) return;
      list.innerHTML = '';
      const rootEntries = cache['.'];
      if (!rootEntries) { list.innerHTML = '<div class="cwc-status" style="padding:10px"><span class="cwc-spin"></span>Загружаю…</div>'; return; }
      if (loadError) { list.innerHTML = `<div class="err-box" style="margin:8px">${esc(loadError)}</div>`; return; }
      if (!rootEntries.length) {
        list.appendChild(h('<div style="padding:14px 10px;color:var(--muted);font-size:13px">Папка пуста. Создайте файл, загрузите файлы, импортируйте репозиторий с GitHub или дайте задачу Claude Code.</div>'));
        return;
      }
      const frag = document.createDocumentFragment();
      const walk = (dir, depth) => {
        (cache[dir] || []).forEach(e => {
          const open = e.dir && expanded.has(e.path);
          const row = h(`<div class="cwc-row${selected === e.path ? ' sel' : ''}" style="padding-left:${6 + depth * 14}px" title="${esc(e.path)}">
            <span class="car${open ? ' open' : ''}">${e.dir ? ic('chev', 13) : ''}</span>
            <span class="fic${e.dir ? ' dir' : ''}">${ic(e.dir ? 'folder' : 'file', 15)}</span>
            <span class="nm">${esc(e.name)}</span>${e.dir ? '' : `<span class="sz">${esc(CW.size(e.size))}</span>`}
            <button class="icon-btn sm dots" title="Действия">${icon('dots')}</button></div>`);
          row.onclick = ev => {
            if (ev.target.closest('.dots')) { ev.stopPropagation(); entryMenu(e, ev.target.closest('.dots')); return; }
            selected = e.path;
            if (e.dir) toggle(e.path); else { openFile(e.path); draw(); }
          };
          row.oncontextmenu = ev => { ev.preventDefault(); entryMenu(e, row); };
          frag.appendChild(row);
          if (open) {
            if (cache[e.path]) walk(e.path, depth + 1);
            else frag.appendChild(h(`<div class="cwc-row" style="padding-left:${26 + depth * 14}px;color:var(--muted)"><span class="cwc-spin"></span></div>`));
          }
        });
      };
      walk('.', 0);
      list.appendChild(frag);
    }
    async function toggle(path) {
      if (expanded.has(path)) expanded.delete(path);
      else { expanded.add(path); if (!cache[path]) { draw(); await load(path).catch(e => toast(e.message)); } }
      saveExpanded(); draw();
    }

    function entryMenu(e, anchor) {
      const items = [];
      if (!e.dir) {
        items.push({ label: 'Открыть', onClick: () => openFile(e.path) });
        items.push({ label: 'Изменить', onClick: () => openFile(e.path, { edit: true }) });
        items.push({ label: 'Скачать', onClick: () => window.open(rawUrl(pid, e.path, true), '_blank') });
        if (/\.html?$/i.test(e.path)) items.push({ label: 'Открыть в «Просмотре»', onClick: () => ctx.showTab && ctx.showTab('preview', { page: e.path }) });
        items.push({ label: 'Спросить Claude', onClick: () => askAbout(e.path) });
      } else {
        items.push({ label: 'Новый файл здесь', onClick: () => createIn(e.path, false) });
        items.push({ label: 'Новая папка здесь', onClick: () => createIn(e.path, true) });
        items.push({ label: 'Загрузить файлы сюда', onClick: () => pickUpload(e.path) });
        items.push({ label: 'Открыть терминал здесь', onClick: () => ctx.showTab && ctx.showTab('term', { cd: e.path }) });
      }
      items.push({ label: 'Копировать путь', onClick: () => CW.copy(e.path) });
      items.push({ sep: true });
      items.push({ label: 'Переименовать или переместить', onClick: () => renameEntry(e) });
      items.push({ label: 'Удалить', danger: true, onClick: () => deleteEntry(e) });
      CW.menu(anchor, items, { alignRight: true });
    }

    function createIn(dir, folder) {
      promptBox(folder ? 'Новая папка' : 'Новый файл', (dir === '.' ? 'В корне проекта' : 'В папке ' + dir) + (folder ? '' : '. Можно с подпапками: src/app.js'), '', 'Создать', async name => {
        const path = join(dir, name.replace(/^\/+/, ''));
        try {
          if (folder) await post('mkdir', { project: pid, path });
          else await post('write', { project: pid, path, content: '', create: true });
          if (dir !== '.') expanded.add(dir);
          path.split('/').slice(0, -1).reduce((acc, seg) => { const d = join(acc, seg); expanded.add(d); return d; }, '.');
          saveExpanded();
          selected = path;
          await refresh();
          if (!folder) openFile(path, { edit: true });
        } catch (e) { toast(e.message); }
      }, { placeholder: folder ? 'имя папки' : 'например, index.html' });
    }
    function renameEntry(e) {
      promptBox('Переименовать', 'Новое имя или путь от корня проекта', e.path, 'Сохранить', async to => {
        if (to === e.path) return;
        try {
          await post('rename', { project: pid, from: e.path, to: to.replace(/^\/+/, '') });
          if (editor && (editor.path === e.path || editor.path.startsWith(e.path + '/'))) { editor = null; showEmpty(); }
          selected = to; await refresh();
        } catch (err) { toast(err.message); }
      });
    }
    function deleteEntry(e) {
      CW.confirmBox('Удалить?', e.dir ? `Папка «${e.name}» будет удалена со всем содержимым.` : `Файл «${e.name}» будет удалён.`, 'Удалить', async () => {
        try {
          await post('delete', { project: pid, path: e.path });
          if (editor && (editor.path === e.path || editor.path.startsWith(e.path + '/'))) { editor = null; showEmpty(); }
          expanded.delete(e.path); saveExpanded();
          await refresh();
        } catch (err) { toast(err.message); }
      });
    }
    function askAbout(path) {
      get('read', { project: pid, path }).then(f => {
        askClaude(pid, f.content != null ? `Файл \`${path}\` из рабочей папки:\n\`\`\`\n${f.content.slice(0, 60000)}\n\`\`\`\n\n` : `Файл \`${path}\` из рабочей папки.\n\n`);
      }).catch(e => toast(e.message));
    }

    // Загрузка файлов: кнопка и перетаскивание на список
    async function uploadFiles(dir, files) {
      if (!files || !files.length) return;
      let done = 0;
      for (const f of files) {
        toast(`Загружаю ${f.name}…`);
        try { await CW.api('POST', '/api/code/upload' + qs({ project: pid, dir, name: f.name }), undefined, f); done++; }
        catch (e) { toast(f.name + ': ' + e.message); }
      }
      if (dir !== '.') { expanded.add(dir); saveExpanded(); }
      toast(`Загружено файлов: ${done}`);
      refresh();
    }
    function pickUpload(dir) {
      const input = h('<input type="file" multiple style="display:none">');
      input.onchange = () => { uploadFiles(dir, [...input.files]); input.remove(); };
      document.body.appendChild(input);
      input.click();
    }
    list.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); list.classList.add('drag'); } });
    list.addEventListener('dragleave', () => list.classList.remove('drag'));
    list.addEventListener('drop', e => {
      e.preventDefault(); list.classList.remove('drag');
      const row = e.target.closest('.cwc-row');
      let dir = '.';
      if (row && row.title) { const en = findEntry(row.title); dir = en ? (en.dir ? en.path : parentOf(en.path)) : '.'; }
      uploadFiles(dir, [...(e.dataTransfer.files || [])]);
    });

    // Поиск по имени и содержимому
    let findTimer = null;
    findInput.oninput = () => {
      clearTimeout(findTimer);
      const q = findInput.value.trim();
      if (!q) { draw(); return; }
      findTimer = setTimeout(async () => {
        list.innerHTML = '<div class="cwc-status" style="padding:10px"><span class="cwc-spin"></span>Ищу…</div>';
        try {
          const r = await get('search', { project: pid, q, content: 1 });
          if (findInput.value.trim() !== q) return;
          list.innerHTML = '';
          if (!r.files.length && !r.lines.length) { list.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px">Ничего не найдено</div>'; return; }
          if (r.files.length) list.appendChild(h(`<div class="cw-section" style="margin:6px 8px">Файлы (${r.files.length})</div>`));
          r.files.forEach(f => { const el = h(`<div class="cwc-hit"><div class="p">${esc(f.path)}</div></div>`); el.onclick = () => openFile(f.path); list.appendChild(el); });
          if (r.lines.length) list.appendChild(h(`<div class="cw-section" style="margin:10px 8px 6px">Текст (${r.lines.length})</div>`));
          r.lines.forEach(l => {
            const el = h(`<div class="cwc-hit"><div class="p">${esc(l.path)}:${l.line}</div><div class="l">${esc(l.text)}</div></div>`);
            el.onclick = () => openFile(l.path, { line: l.line });
            list.appendChild(el);
          });
        } catch (e) { list.innerHTML = `<div class="err-box" style="margin:8px">${esc(e.message)}</div>`; }
      }, 300);
    };
    findInput.onkeydown = e => { if (e.key === 'Escape') { findInput.value = ''; draw(); } };

    // ---------------------------------------------------- просмотр и редактор файла
    function showEmpty() {
      root.classList.remove('open');
      main.innerHTML = `<div class="cwc-empty">${ic('code', 34)}<div>Выберите файл слева, чтобы посмотреть или изменить его.</div>
        <div style="font-size:13px">Ctrl+S — сохранить, Tab — отступ. Файлы можно перетащить в список.</div></div>`;
    }
    function guard(fn) {
      if (editor && editor.dirty && editor.dirty()) {
        CW.confirmBox('Несохранённые изменения', `В файле ${editor.path} есть несохранённые правки.`, 'Не сохранять', () => { editor = null; fn(); });
      } else fn();
    }
    function openFile(path, opts) {
      guard(() => doOpen(path, opts || {}));
    }
    ctx.openFile = openFile;
    async function doOpen(path, opts) {
      selected = path;
      root.classList.add('open');
      main.innerHTML = '<div class="cwc-empty"><span class="cwc-spin"></span></div>';
      let f;
      try { f = await get('read', { project: pid, path }); } catch (e) { main.innerHTML = `<div class="cwc-empty"><div class="err-box">${esc(e.message)}</div></div>`; return; }
      if (opts.edit && f.content != null) showEditor(f); else showViewer(f, opts.line);
    }
    function fileHead(f, extra) {
      const head = h(`<div class="cwc-fh"><button class="icon-btn sm cwc-narrow-back" title="К списку файлов">${ic('back')}</button>
        <div class="path" title="${esc(f.path)}">${esc(f.path)}</div><span class="meta">${esc(CW.size(f.size))}</span></div>`);
      head.querySelector('.cwc-narrow-back').onclick = () => guard(() => { editor = null; root.classList.remove('open'); });
      (extra || []).forEach(b => b && head.appendChild(b));
      return head;
    }
    const btn = (iconName, label, title, fn, cls) => {
      const b = h(`<button class="cwc-btn${cls ? ' ' + cls : ''}" title="${esc(title || label)}">${iconName ? ic(iconName, 15) : ''}${label ? esc(label) : ''}</button>`);
      b.onclick = fn; return b;
    };
    function moreMenu(f) {
      const m = h(`<button class="icon-btn sm" title="Ещё">${icon('dots')}</button>`);
      m.onclick = () => CW.menu(m, [
        { label: 'Спросить Claude', onClick: () => askClaude(pid, f.content != null ? `Файл \`${f.path}\` из рабочей папки:\n\`\`\`\n${f.content.slice(0, 60000)}\n\`\`\`\n\n` : `Файл \`${f.path}\`.\n\n`) },
        { label: 'Отправить в GitHub', sub: 'Коммит одного файла', onClick: () => pushFile(f) },
        { label: 'Копировать путь', onClick: () => CW.copy(f.path) },
        ...(/\.html?$/i.test(f.path) ? [{ label: 'Открыть в «Просмотре»', onClick: () => ctx.showTab && ctx.showTab('preview', { page: f.path }) }] : []),
        { label: 'Открыть в новой вкладке', onClick: () => window.open(rawUrl(pid, f.path, false), '_blank') },
        { sep: true },
        { label: 'Переименовать', onClick: () => renameEntry({ path: f.path, name: f.name, dir: false }) },
        { label: 'Удалить', danger: true, onClick: () => deleteEntry({ path: f.path, name: f.name, dir: false }) }
      ], { alignRight: true });
      return m;
    }
    function showViewer(f, line) {
      editor = null;
      main.innerHTML = '';
      const dl = btn('download', '', 'Скачать', () => window.open(rawUrl(pid, f.path, true), '_blank'), 'ghost');
      if (f.binary || f.content == null) {
        main.appendChild(fileHead(f, [dl, moreMenu(f)]));
        const ext = f.name.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'].includes(ext)) {
          main.appendChild(h(`<div class="cwc-media"><img src="${esc(rawUrl(pid, f.path))}" alt=""></div>`));
        } else if (['mp4', 'webm', 'mov'].includes(ext)) {
          main.appendChild(h(`<div class="cwc-media"><video controls src="${esc(rawUrl(pid, f.path))}"></video></div>`));
        } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
          main.appendChild(h(`<div class="cwc-media"><audio controls src="${esc(rawUrl(pid, f.path))}"></audio></div>`));
        } else {
          const box = h(`<div class="cwc-empty">${ic('file', 34)}<div>${f.tooLarge ? 'Файл слишком большой для редактора (больше 2 МБ).' : 'Двоичный файл — его можно скачать.'}</div></div>`);
          box.appendChild(btn('download', 'Скачать', '', () => window.open(rawUrl(pid, f.path, true), '_blank'), 'primary'));
          main.appendChild(box);
        }
        return;
      }
      const lang = langOf(f.path);
      let mode = 'code';
      let wrap = CW.load('codeWrap') === '1';
      const isMd = lang === 'markdown';
      const editBtn = btn('edit', 'Изменить', 'Изменить файл', () => showEditor(f), 'primary');
      const wrapBtn = btn('', 'Перенос', 'Переносить длинные строки', () => { wrap = !wrap; CW.save('codeWrap', wrap ? '1' : ''); render(); }, 'ghost');
      const mdBtn = isMd ? btn('eye', 'Markdown', 'Показать оформленным', () => { mode = mode === 'md' ? 'code' : 'md'; render(); }, 'ghost') : null;
      main.appendChild(fileHead(f, [mdBtn, wrapBtn, editBtn, dl, moreMenu(f)]));
      const area = h('<div style="flex:1;min-height:0;display:flex;flex-direction:column"></div>');
      main.appendChild(area);
      function render() {
        area.innerHTML = '';
        wrapBtn.classList.toggle('on', wrap);
        if (mode === 'md') {
          const md = h('<div class="cwc-md md"></div>');
          md.innerHTML = CW.markdown(f.content);
          CW.enhance(md);
          area.appendChild(md);
          return;
        }
        const n = f.content.split('\n').length;
        const code = h(`<div class="cwc-code"><div class="cwc-gut"></div><pre class="cwc-src${wrap ? ' wrap' : ''}"></pre></div>`);
        code.querySelector('.cwc-src').innerHTML = highlight(f.content, lang);
        const gut = code.querySelector('.cwc-gut');
        if (wrap) gut.style.display = 'none';
        else gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
        area.appendChild(code);
        if (line) {
          const mark = h('<div class="cwc-mark"></div>');
          mark.style.top = (12 + (line - 1) * 20) + 'px';
          code.appendChild(mark);
          setTimeout(() => { code.scrollTop = Math.max(0, (line - 6) * 20); }, 0);
        }
      }
      render();
    }
    function showEditor(f) {
      main.innerHTML = '';
      let original = f.content;
      let modified = f.modified;
      let wrap = CW.load('codeWrap') === '1';
      const pathEl = () => main.querySelector('.cwc-fh .path');
      const saveBtn = btn('save', 'Сохранить', 'Сохранить (Ctrl+S)', () => save(false), 'primary');
      const cancel = btn('', 'Готово', 'Закрыть редактор', () => guard(() => { editor = null; showViewer(Object.assign({}, f, { content: original, modified }), 0); }), '');
      const wrapBtn = btn('', 'Перенос', 'Переносить длинные строки', () => { wrap = !wrap; CW.save('codeWrap', wrap ? '1' : ''); ta.classList.toggle('wrap', wrap); gut.style.display = wrap ? 'none' : ''; }, 'ghost');
      main.appendChild(fileHead(f, [wrapBtn, cancel, saveBtn, moreMenu(f)]));
      const st = statusLine();
      st.style.padding = '0 14px';
      main.appendChild(st);
      const ed = h('<div class="cwc-ed"><div class="cwc-gut"></div><textarea spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div>');
      main.appendChild(ed);
      const ta = ed.querySelector('textarea');
      const gut = ed.querySelector('.cwc-gut');
      ta.value = f.content;
      ta.classList.toggle('wrap', wrap);
      if (wrap) gut.style.display = 'none';
      const usesTabs = /^\t/m.test(f.content) || /makefile/i.test(f.name);
      const unit = usesTabs ? '\t' : (/^ {4}\S/m.test(f.content) && !/^ {2}\S/m.test(f.content) ? '    ' : (/\.(py|kt|kts|java|cs|go|rs|swift)$/i.test(f.name) ? '    ' : '  '));
      let lines = -1;
      const updateGut = () => {
        const n = ta.value.split('\n').length;
        if (n !== lines) { lines = n; gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
        gut.scrollTop = ta.scrollTop;
      };
      const dirty = () => ta.value !== original;
      const markDirty = () => {
        const p = pathEl();
        if (p) p.innerHTML = esc(f.path) + (dirty() ? ' <span class="dirty">●</span>' : '');
        saveBtn.disabled = !dirty();
      };
      editor = { path: f.path, dirty };
      updateGut(); markDirty();
      ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; });
      ta.addEventListener('input', () => { updateGut(); markDirty(); });
      function replaceSel(text, selStart, selEnd) {
        ta.focus();
        // execCommand сохраняет отмену (Ctrl+Z); если не поддерживается — прямая замена
        if (!document.execCommand || !document.execCommand('insertText', false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        if (selStart != null) ta.setSelectionRange(selStart, selEnd);
        updateGut(); markDirty();
      }
      ta.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          if (s === en && !e.shiftKey) { replaceSel(unit); return; }
          const le = v.indexOf('\n', en - (en > s && v[en - 1] === '\n' ? 1 : 0)); const end = le < 0 ? v.length : le;
          const block = v.slice(ls, end);
          const changed = e.shiftKey
            ? block.split('\n').map(l => l.startsWith(unit) ? l.slice(unit.length) : l.replace(/^[ \t]{1,4}/, '')).join('\n')
            : block.split('\n').map(l => unit + l).join('\n');
          ta.setSelectionRange(ls, end);
          replaceSel(changed, ls, ls + changed.length);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const v = ta.value, s = ta.selectionStart;
          const ls = v.lastIndexOf('\n', s - 1) + 1;
          const indent = (v.slice(ls, s).match(/^[ \t]*/) || [''])[0];
          const before = v.slice(ls, s).trimEnd();
          const extra = /[{[(:]$/.test(before) ? unit : '';
          e.preventDefault();
          replaceSel('\n' + indent + extra);
        }
      });
      async function save(force) {
        if (!dirty() && !force) return;
        st.busy('Сохраняю…');
        try {
          const r = await post('write', { project: pid, path: f.path, content: ta.value, modified: force ? 0 : modified, force: !!force });
          original = ta.value; modified = r.modified; f.size = r.size;
          f.content = original; f.modified = modified;
          markDirty();
          st.ok('Сохранено');
          setTimeout(() => { if (alive(st) && !dirty()) st.clear(); }, 2000);
        } catch (e) {
          if (/изменён на телефоне/.test(e.message)) {
            st.clear();
            CW.modal(`<h3>Файл изменился</h3><p>Пока файл был открыт, его изменили на телефоне (например, Claude). Что сделать?</p>
              <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn" data-r>Открыть новую версию</button><button class="btn danger" data-ok>Сохранить мою</button></div>`, (bg, close) => {
              bg.querySelector('[data-x]').onclick = close;
              bg.querySelector('[data-r]').onclick = () => { close(); editor = null; doOpen(f.path, { edit: true }); };
              bg.querySelector('[data-ok]').onclick = () => { close(); save(true); };
            });
          } else st.err('Не сохранено: ' + e.message);
        }
      }
      setTimeout(() => CW.focusSoft(ta), 0);
    }
    function pushFile(f) {
      get('gh/repo-info', { project: pid, path: f.path }).then(info => {
        CW.modal(`<h3>Отправить в GitHub</h3><p style="font-size:13.5px">Коммит одного файла в репозиторий.</p>
          <input class="field" data-r placeholder="Репозиторий: владелец/имя" value="${esc(info.repo)}">
          <input class="field" data-b placeholder="Ветка" value="${esc(info.branch)}">
          <input class="field" data-p placeholder="Путь в репозитории" value="${esc(info.repoPath)}">
          <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Отправить</button></div>`, (bg, close) => {
          bg.querySelector('[data-x]').onclick = close;
          bg.querySelector('[data-ok]').onclick = async () => {
            const repo = bg.querySelector('[data-r]').value.trim(), branch = bg.querySelector('[data-b]').value.trim(), repoPath = bg.querySelector('[data-p]').value.trim();
            if (!repo.includes('/') || !branch || !repoPath) return;
            close();
            toast('Отправляю…');
            try { const r = await post('gh/put', { project: pid, path: f.path, repo, branch, repoPath }); toast(`Отправлено в ${repo} (${branch}), коммит ${r.sha}`); }
            catch (e) { toast('Ошибка GitHub: ' + e.message); }
          };
        });
      }).catch(e => toast(e.message));
    }

    const beforeUnload = e => { if (!alive(root)) { window.removeEventListener('beforeunload', beforeUnload); return; } if (editor && editor.dirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    showEmpty();
    refresh().catch(() => {});
    if (ctx.extra && ctx.extra.open) openFile(ctx.extra.open);
    return root;
  }

  // ============================================================ терминал и фоновые команды
  function terminalView(ctx, withJobs) {
    const pid = ctx.pid;
    const root = h('<div style="flex:1;min-height:0;display:flex;flex-direction:column"></div>');
    const term = h(`<div class="cwc-term"><div class="cwc-tt-tabs"></div><pre class="cwc-tt-out"></pre>
      <div class="cwc-tt-keys"></div><div class="cwc-tt-in"><span class="pr">$</span><input spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="команда…">
      <button title="Выполнить">${ic('play')}</button></div><div class="cwc-tt-cwd"></div></div>`);
    root.appendChild(term);
    const tabsEl = term.querySelector('.cwc-tt-tabs'), out = term.querySelector('.cwc-tt-out'), input = term.querySelector('input');
    const prEl = term.querySelector('.pr'), cwdEl = term.querySelector('.cwc-tt-cwd');
    let sessions = [];
    let current = null;
    let state = null;
    let histIndex = -1;
    const cdOnOpen = ctx.extra && ctx.extra.cd;

    function drawTabs() {
      tabsEl.innerHTML = '';
      sessions.forEach(s => {
        const t = h(`<div class="cwc-tt-tab${current === s.id ? ' on' : ''}">${s.running ? '<span class="cwc-spin" style="color:#8fd18f"></span>' : ''}${esc(s.title)}<span class="x" title="Закрыть">${ic('x', 12)}</span></div>`);
        t.onclick = e => {
          if (e.target.closest('.x')) { post('term/' + s.id + '/close').then(loadSessions).catch(err => toast(err.message)); return; }
          select(s.id);
        };
        tabsEl.appendChild(t);
      });
      const add = h(`<button class="cwc-tt-add" title="Новый терминал">${ic('plus')}</button>`);
      add.onclick = () => post('term/open', { project: pid }).then(s => { sessions.push(s); select(s.id); }).catch(e => toast(e.message));
      tabsEl.appendChild(add);
    }
    async function loadSessions(prefer) {
      try {
        const r = await get('term', { project: pid });
        sessions = r.sessions;
        if (!sessions.length) { const s = await post('term/open', { project: pid }); sessions = [s]; }
        const id = prefer && sessions.some(s => s.id === prefer) ? prefer : (sessions.some(s => s.id === current) ? current : sessions[0].id);
        select(id);
      } catch (e) { out.textContent = 'Ошибка: ' + e.message; }
    }
    function select(id) {
      if (current !== id) { current = id; state = null; histIndex = -1; out.textContent = ''; }
      drawTabs();
      poll(id);
      setTimeout(() => CW.focusSoft(input), 0);
    }
    function apply(s) {
      const nearBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 60;
      if (!state || state.output !== s.output) out.textContent = s.output;
      state = s;
      prEl.textContent = s.running ? '>' : s.prompt;
      cwdEl.textContent = s.cwd;
      const tab = sessions.find(x => x.id === s.id);
      if (tab && tab.running !== s.running) { tab.running = s.running; drawTabs(); }
      if (nearBottom) out.scrollTop = out.scrollHeight;
    }
    let polling = null;
    async function poll(id) {
      if (polling === id) return;
      polling = id;
      let first = true;
      while (alive(root) && current === id) {
        try {
          const s = await get('term/' + id, { v: first ? '' : (state && state.v) || '' });
          first = false;
          if (current !== id || !alive(root)) break;
          apply(s);
        } catch (e) {
          if (/закрыт/.test(e.message)) { polling = null; loadSessions(); return; }
          await sleep(2000);
        }
      }
      if (polling === id) polling = null;
    }
    function send(line) {
      if (current == null) return;
      post('term/' + current + '/send', { line }).catch(e => toast(e.message));
    }
    function submit() {
      const v = input.value;
      input.value = '';
      histIndex = -1;
      send(v);
    }
    function historyStep(up) {
      const hist = (state && state.history) || [];
      if (!hist.length) return;
      if (up) histIndex = histIndex === -1 ? hist.length - 1 : Math.max(0, histIndex - 1);
      else if (histIndex === -1) return;
      else histIndex = histIndex + 1 >= hist.length ? -1 : histIndex + 1;
      input.value = histIndex === -1 ? '' : hist[histIndex];
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    }
    const insert = t => { const s = input.selectionStart, e = input.selectionEnd; input.setRangeText(t, s, e, 'end'); CW.focusSoft(input); };
    const interrupt = () => current != null && post('term/' + current + '/interrupt').catch(e => toast(e.message));
    const keys = term.querySelector('.cwc-tt-keys');
    [['Ctrl+C', interrupt], ['↑', () => historyStep(true)], ['↓', () => historyStep(false)], ['Tab', () => insert('\t')]]
      .concat(['|', '/', '-', '~', '>', '&', '*', '$', '"', "'"].map(k => [k, () => insert(k)]))
      .concat([['clear', () => send('clear')]])
      .forEach(([label, fn]) => { const b = h(`<button>${esc(label)}</button>`); b.onclick = fn; keys.appendChild(b); });
    term.querySelector('.cwc-tt-in button').onclick = submit;
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); historyStep(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); historyStep(false); }
      else if (e.key === 'Tab') { e.preventDefault(); insert('\t'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd && !window.getSelection().toString()) { e.preventDefault(); interrupt(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); send('clear'); }
    };
    out.onclick = () => { if (!window.getSelection().toString()) CW.focusSoft(input); };

    if (withJobs) root.appendChild(jobsPanel());
    loadSessions().then(() => {
      if (cdOnOpen && current != null) send('cd ' + JSON.stringify(cdOnOpen));
    });
    return root;
  }

  /** Фоновые команды (run_command background=true и облачные запуски): список, вывод, остановка. */
  function jobsPanel(open) {
    const el = h(`<details class="cwc-side"${open || CW.load('jobsOpen') === '1' ? ' open' : ''}><summary>${ic('chev', 13)}Фоновые команды <span class="cw-badge" data-n>0</span><span style="flex:1"></span><button class="cwc-btn ghost" data-clear style="height:24px">Убрать завершённые</button></summary><div data-list></div></details>`);
    el.addEventListener('toggle', () => CW.save('jobsOpen', el.open ? '1' : ''));
    const listEl = el.querySelector('[data-list]');
    el.querySelector('[data-clear]').onclick = e => { e.preventDefault(); post('jobs/clear').then(draw).catch(err => toast(err.message)); };
    const stClass = s => s === 'RUNNING' ? 'run' : s === 'DONE' ? 'ok' : s === 'FAILED' ? 'bad' : '';
    async function draw() {
      try {
        const r = await get('jobs');
        el.querySelector('[data-n]').textContent = r.jobs.length;
        listEl.innerHTML = r.jobs.length ? '' : '<div style="padding:8px 14px 12px;font-size:13px;color:var(--muted)">Фоновых команд нет. Их запускает Claude (run_command с background=true) — когда команда закончится, Claude продолжит работу в своём чате.</div>';
        r.jobs.forEach(j => {
          const row = h(`<div class="cwc-job"><span class="cw-badge">#${j.id}</span><span class="c" title="${esc(j.command)}">${esc(j.command)}</span>
            <span class="cwc-st ${stClass(j.status)}">${esc(j.statusTitle)}${j.exitCode != null && j.status !== 'RUNNING' ? ' · ' + j.exitCode : ''}</span>
            <span class="s">${j.kind === 'CLOUD' ? 'облако · ' : ''}${esc(CW.ago(j.startedAt))}</span></div>`);
          const outBtn = h(`<button class="cwc-btn">${ic('term', 14)}Вывод</button>`);
          outBtn.onclick = () => jobOutput(j);
          row.appendChild(outBtn);
          if (j.chatId) { const c = h(`<button class="cwc-btn ghost" title="${esc(j.chatTitle || 'Чат')}">${ic('chat', 14)}</button>`); c.onclick = () => { location.hash = '#/chat/' + encodeURIComponent(j.chatId); }; row.appendChild(c); }
          if (j.url) { const u = h(`<button class="cwc-btn ghost" title="Открыть запуск на GitHub">${ic('open', 14)}</button>`); u.onclick = () => window.open(j.url, '_blank', 'noopener'); row.appendChild(u); }
          if (j.status === 'RUNNING') { const s = h('<button class="cwc-btn danger">Остановить</button>'); s.onclick = () => post('jobs/' + j.id + '/stop').then(draw).catch(e => toast(e.message)); row.appendChild(s); }
          listEl.appendChild(row);
        });
      } catch (e) { listEl.innerHTML = `<div class="err-box" style="margin:8px 14px">${esc(e.message)}</div>`; }
    }
    draw();
    // Пока панель на экране — обновление раз в 4 секунды
    (async () => { await sleep(4000); while (alive(el)) { await draw(); await sleep(4000); } })();
    return el;
  }
  function jobOutput(j) {
    const close = CW.modal(`<h3>#${j.id} · ${esc(j.command.slice(0, 80))}</h3><pre class="cwc-pre" style="max-height:60vh;background:#1e1e1c;color:#e8e6dc">Загружаю…</pre>
      <div class="btns"><button class="btn" data-copy>Копировать</button><button class="btn primary" data-x>Закрыть</button></div>`, (bg, cl) => {
      bg.querySelector('.modal').style.maxWidth = '860px';
      const pre = bg.querySelector('pre');
      bg.querySelector('[data-x]').onclick = cl;
      bg.querySelector('[data-copy]').onclick = () => CW.copy(pre.textContent);
      (async () => {
        while (bg.isConnected) {
          try {
            const r = await get('jobs/' + j.id, { lines: 1000 });
            const near = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
            pre.textContent = r.output || '(пока нет вывода)';
            if (near) pre.scrollTop = pre.scrollHeight;
          } catch (e) { pre.textContent = e.message; break; }
          if (j.status !== 'RUNNING') break;
          await sleep(2000);
        }
      })();
    });
    return close;
  }

  // ============================================================ просмотр и dev-сервер
  const FRAMES = [{ id: 'phone', label: 'Телефон', w: 390 }, { id: 'tablet', label: 'Планшет', w: 800 }, { id: 'full', label: 'Во всю ширину', w: 0 }];
  const VIEWS = {}; // ключи просмотра: «pid» или «port:N» → адрес

  async function viewUrl(pid, port) {
    const k = port ? 'port:' + port : 'dir:' + pid;
    if (!VIEWS[k]) { const r = await post('view', { project: pid, port: port || undefined }); VIEWS[k] = r.url; }
    return CW.base + VIEWS[k];
  }

  function previewView(ctx) {
    const pid = ctx.pid;
    const root = h('<div class="cwc-pv"></div>');
    const bar = h('<div class="cwc-bar"></div>');
    const serverBox = h('<div></div>');
    const stage = h('<div class="cwc-stage"></div>');
    const consoleEl = h(`<div class="cwc-console hidden"><div class="cwc-bar" style="padding:4px 12px"><b style="font-size:13px" data-t>Консоль</b><span style="flex:1"></span>
      <button class="cwc-btn ghost" data-clear>Очистить</button><button class="cwc-btn" data-fix>${ic('spark', 14)}Исправить с Claude</button></div><div class="lines"></div></div>`);
    root.append(bar, serverBox, stage, consoleEl);
    const linesEl = consoleEl.querySelector('.lines');
    let mode = (ctx.extra && ctx.extra.port) ? 'server' : (CW.load('pvMode:' + (pid || 'default')) || 'files');
    let page = ctx.extra && ctx.extra.page;
    let port = (ctx.extra && ctx.extra.port) || +CW.load('pvPort') || 0;
    let frame = CW.load('pvFrame') || 'phone';
    let pages = [];
    let consoleLines = [];
    let iframe = null;
    let nativeAndroid = false;

    function drawBar() {
      bar.innerHTML = '';
      const seg = h('<div class="tabs"></div>');
      [['files', 'Страницы проекта'], ['server', 'Dev-сервер']].forEach(([id, label]) => {
        const b = h(`<button class="${mode === id ? 'on' : ''}">${esc(label)}</button>`);
        b.onclick = () => { mode = id; CW.save('pvMode:' + (pid || 'default'), id); drawBar(); drawServer(); load(); };
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      if (mode === 'files') {
        const sel = h('<select class="cwc-sel"></select>');
        if (!pages.length) sel.appendChild(h('<option>Нет страниц</option>'));
        pages.forEach(p => { const o = h(`<option>${esc(p)}</option>`); o.value = p; if (p === page) o.selected = true; sel.appendChild(o); });
        sel.disabled = !pages.length;
        sel.onchange = () => { page = sel.value; consoleLines = []; drawConsole(); load(); };
        bar.appendChild(sel);
      } else {
        bar.appendChild(h(`<span style="font-size:13px;color:var(--muted)">${port ? 'порт ' + port : 'порт не выбран'}</span>`));
      }
      bar.appendChild(h('<span class="grow"></span>'));
      FRAMES.forEach(f => { const c = h(`<button class="cwc-chip${frame === f.id ? ' on' : ''}">${esc(f.label)}</button>`); c.onclick = () => { frame = f.id; CW.save('pvFrame', f.id); drawBar(); sizeFrame(); }; bar.appendChild(c); });
      const errors = consoleLines.filter(l => l.level === 'ERROR').length;
      const cbtn = h(`<button class="icon-btn sm" title="Консоль страницы" style="${errors ? 'color:var(--danger)' : ''}">${ic('console')}</button>`);
      cbtn.onclick = () => { consoleEl.classList.toggle('hidden'); };
      const rbtn = h(`<button class="icon-btn sm" title="Перезагрузить">${ic('refresh')}</button>`);
      rbtn.onclick = () => { consoleLines = []; drawConsole(); load(true); };
      const obtn = h(`<button class="icon-btn sm" title="Открыть в новой вкладке">${ic('open')}</button>`);
      obtn.onclick = () => { if (iframe && iframe.src) window.open(iframe.src, '_blank'); };
      bar.append(cbtn, rbtn, obtn);
    }
    function sizeFrame() {
      if (!iframe) return;
      const f = FRAMES.find(x => x.id === frame) || FRAMES[0];
      iframe.style.width = f.w ? f.w + 'px' : '100%';
      iframe.style.maxWidth = '100%';
      stage.style.padding = f.w ? '12px' : '0';
    }
    async function load(force) {
      stage.innerHTML = '';
      iframe = null;
      if (mode === 'files') {
        if (!page) {
          stage.appendChild(h(`<div class="cwc-empty">${ic('eye', 34)}<div>${nativeAndroid
            ? 'Это нативное Android-приложение (Kotlin): его нельзя запустить до сборки. Соберите APK во вкладке «GitHub» → «Сборка» — готовый файл появится в «Файлы» → .builds.'
            : 'В проекте нет HTML-страниц. Создайте index.html (или попросите Claude Code сделать веб-приложение) — оно откроется здесь.'}</div></div>`));
          return;
        }
      } else if (!port) {
        stage.appendChild(h(`<div class="cwc-empty">${ic('server', 34)}<div>Запустите dev-сервер выше или укажите порт уже запущенного сервера на телефоне.</div></div>`));
        return;
      }
      try {
        if (force) delete VIEWS[mode === 'files' ? 'dir:' + pid : 'port:' + port];
        const base = await viewUrl(pid, mode === 'files' ? 0 : port);
        if (!alive(root)) return;
        iframe = h('<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads" referrerpolicy="no-referrer"></iframe>');
        iframe.src = base + (mode === 'files' ? page.split('/').map(encodeURIComponent).join('/') : '') + (force ? (mode === 'files' ? '?r=' + Date.now() : '') : '');
        stage.appendChild(iframe);
        sizeFrame();
      } catch (e) {
        if (/Просмотр устарел/.test(e.message)) { delete VIEWS[mode === 'files' ? 'dir:' + pid : 'port:' + port]; }
        stage.appendChild(h(`<div class="cwc-empty"><div class="err-box">${esc(e.message)}</div></div>`));
      }
    }
    function drawConsole() {
      consoleEl.querySelector('[data-t]').textContent = `Консоль (${consoleLines.length})`;
      linesEl.innerHTML = consoleLines.map(l => `<div class="${esc(l.level)}">${esc(l.level)}: ${esc(l.text)}</div>`).join('');
      linesEl.scrollTop = linesEl.scrollHeight;
    }
    consoleEl.querySelector('[data-clear]').onclick = () => { consoleLines = []; drawConsole(); drawBar(); };
    consoleEl.querySelector('[data-fix]').onclick = () => {
      if (!consoleLines.length) return;
      askClaude(pid, `В просмотре ${mode === 'files' ? 'страницы `' + page + '`' : 'dev-сервера на порту ' + port} консоль показывает:\n\`\`\`\n` +
        consoleLines.slice(-60).map(l => l.level + ': ' + l.text).join('\n') + '\n```\nНайди и исправь причину.');
    };
    const onMessage = e => {
      if (!alive(root)) { window.removeEventListener('message', onMessage); return; }
      if (!iframe || e.source !== iframe.contentWindow || !e.data || !e.data.cwConsole) return;
      consoleLines.push({ level: String(e.data.level || 'LOG'), text: String(e.data.text || '') });
      if (consoleLines.length > 300) consoleLines.shift();
      drawConsole();
      if (e.data.level === 'ERROR') drawBar();
    };
    window.addEventListener('message', onMessage);

    // Dev-сервер: свои команды запуска, порт телефона, журнал
    async function drawServer() {
      serverBox.innerHTML = '';
      if (mode !== 'server') return;
      const box = h(`<div class="cwc-bar" style="background:var(--bg-sidebar);align-items:flex-start;flex-direction:column;gap:8px"></div>`);
      const form = h(`<div class="cw-row" style="width:100%">
        <input class="cwc-in" data-cmd style="flex:1;min-width:200px;font-family:var(--mono)" placeholder="Команда запуска, например: npm run dev -- --port $PORT" value="${esc(CW.load('pvCmd:' + (pid || 'default')) || '')}">
        <input class="cwc-in" data-port type="number" min="1" max="65535" style="width:96px" placeholder="порт" value="${port || 5173}">
        <button class="cwc-btn primary" data-start>${ic('play', 14)}Запустить</button>
        <button class="cwc-btn" data-open title="Открыть уже запущенный сервер на этом порту">${ic('eye', 14)}Открыть порт</button></div>`);
      box.appendChild(form);
      box.appendChild(h('<div style="font-size:12px;color:var(--muted)">Команда выполняется в папке проекта на телефоне (переменная $PORT — выбранный порт). В оболочке Android нет Node.js и Python — нужна установленная программа (например, из Termux) или сервер, который запустил Claude. Страница открывается только с самого телефона (127.0.0.1).</div>'));
      const listEl = h('<div style="width:100%"></div>');
      box.appendChild(listEl);
      serverBox.appendChild(box);
      const cmdIn = form.querySelector('[data-cmd]'), portIn = form.querySelector('[data-port]');
      form.querySelector('[data-start]').onclick = async () => {
        const command = cmdIn.value.trim(), p = +portIn.value;
        if (!command || !p) { toast('Укажите команду и порт'); return; }
        CW.save('pvCmd:' + (pid || 'default'), command);
        try {
          await post('servers', { project: pid, command, port: p });
          port = p; CW.save('pvPort', String(p));
          toast('Сервер запускается…');
          await waitPort(p);
          drawBar(); drawServer(); load(true);
        } catch (e) { toast(e.message); }
      };
      form.querySelector('[data-open]').onclick = async () => {
        const p = +portIn.value;
        if (!p) return;
        try {
          const r = await get('probe', { port: p });
          if (!r.open) toast('На порту ' + p + ' сейчас ничего не отвечает — страница покажет ошибку');
          port = p; CW.save('pvPort', String(p)); drawBar(); load(true);
        } catch (e) { toast(e.message); }
      };
      try {
        const r = await get('servers');
        const mine = r.servers;
        if (!mine.length) return;
        mine.forEach(s => {
          const row = h(`<div class="cwc-job" style="padding:6px 0;border-top:1px solid var(--border)"><span class="cwc-st ${s.running ? 'run' : (s.exitCode === 0 || s.stopped) ? '' : 'bad'}">${s.running ? 'работает' : s.stopped ? 'остановлен' : 'завершён' + (s.exitCode != null ? ' · ' + s.exitCode : '')}</span>
            <span class="c" title="${esc(s.command)}">${esc(s.command)}</span><span class="s">:${s.port} · ${esc(s.projectName)}</span></div>`);
          const open = h(`<button class="cwc-btn">${ic('eye', 14)}Открыть</button>`);
          open.onclick = () => { port = s.port; CW.save('pvPort', String(port)); drawBar(); load(true); };
          const log = h(`<button class="cwc-btn">${ic('term', 14)}Журнал</button>`);
          log.onclick = () => serverLog(s);
          row.append(open, log);
          if (s.running) { const st = h('<button class="cwc-btn danger">Остановить</button>'); st.onclick = () => post('servers/' + s.id + '/stop').then(drawServer).catch(e => toast(e.message)); row.appendChild(st); }
          else { const rm = h(`<button class="icon-btn sm" title="Убрать">${ic('x', 14)}</button>`); rm.onclick = () => post('servers/' + s.id + '/remove').then(drawServer).catch(e => toast(e.message)); row.appendChild(rm); }
          listEl.appendChild(row);
        });
      } catch (e) { listEl.appendChild(h(`<div class="err-box">${esc(e.message)}</div>`)); }
    }
    async function waitPort(p) {
      for (let i = 0; i < 30 && alive(root); i++) {
        const r = await get('probe', { port: p }).catch(() => ({ open: false }));
        if (r.open) return true;
        await sleep(1000);
      }
      return false;
    }
    function serverLog(s) {
      CW.modal(`<h3>Журнал: ${esc(s.command.slice(0, 70))}</h3><pre class="cwc-pre" style="max-height:60vh;background:#1e1e1c;color:#e8e6dc">Загружаю…</pre>
        <div class="btns"><button class="btn primary" data-x>Закрыть</button></div>`, (bg, close) => {
        bg.querySelector('.modal').style.maxWidth = '860px';
        bg.querySelector('[data-x]').onclick = close;
        const pre = bg.querySelector('pre');
        (async () => {
          while (bg.isConnected) {
            try { const r = await get('servers/' + s.id + '/log'); pre.textContent = r.output || '(пока нет вывода)'; pre.scrollTop = pre.scrollHeight; if (!r.running) break; }
            catch (e) { pre.textContent = e.message; break; }
            await sleep(1500);
          }
        })();
      });
    }

    get('pages', { project: pid }).then(r => {
      pages = r.pages; nativeAndroid = r.nativeAndroid;
      if (!page || !pages.includes(page)) page = page && pages.includes(page) ? page : pages[0];
      drawBar(); load();
    }).catch(e => { stage.innerHTML = `<div class="cwc-empty"><div class="err-box">${esc(e.message)}</div></div>`; });
    drawBar(); drawServer();
    return root;
  }

  // ============================================================ GitHub
  function ghStatusClass(status, conclusion) {
    if (status !== 'completed') return 'run';
    return conclusion === 'success' ? 'ok' : (conclusion === 'cancelled' || conclusion === 'skipped') ? '' : 'bad';
  }
  function ghStatusText(status, conclusion) {
    if (status === 'queued') return 'в очереди';
    if (status === 'in_progress') return 'выполняется';
    if (status !== 'completed') return status;
    return ({ success: 'успешно', failure: 'ошибка', cancelled: 'отменён', skipped: 'пропущен', timed_out: 'тайм-аут', action_required: 'нужно действие' })[conclusion] || conclusion;
  }

  function githubView(ctx, opts) {
    const root = h('<div class="cwc-scroll"></div>');
    const pad = h('<div class="cwc-pad"></div>');
    root.appendChild(pad);
    const g = { state: null, repos: null, repo: null, info: null, branch: '', branches: [], tab: 'code', path: '', detail: null, filter: 'open' };
    const linked = () => ctx.project && ctx.project.repo && g.repo === ctx.project.repo;

    async function start() {
      pad.innerHTML = '<div class="cwc-status"><span class="cwc-spin"></span>Загружаю…</div>';
      try { g.state = await get('gh/state'); } catch (e) { pad.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      if (opts && opts.repo) await openRepo(opts.repo);
      else if (ctx.project && ctx.project.repo && !g.repo) await openRepo(ctx.project.repo, ctx.project.branch, 'project');
      else draw();
    }
    function draw() {
      if (!alive(root) && root.parentNode) return;
      pad.innerHTML = '';
      if (!g.repo) drawHome(); else drawRepo();
    }

    // ---- вход и список репозиториев
    function loginCard() {
      const card = h(`<div class="cwc-card"><h3>${ic('gh', 18)}GitHub</h3>
        <p style="margin:0 0 12px;color:var(--text-2);font-size:14px">Подключите GitHub, чтобы выбрать свой репозиторий и работать с ним в Claude Code: войдите, выберите репозиторий — он подключится к проекту. Токен хранится только на телефоне.</p>
        <div class="cw-row"><button class="cwc-btn accent" data-login>Войти через GitHub</button><button class="cwc-btn" data-token>Войти токеном</button></div><div data-st style="margin-top:10px"></div></div>`);
      const st = statusLine();
      card.querySelector('[data-st]').appendChild(st);
      card.querySelector('[data-login]').onclick = async () => {
        try {
          const res = await post('gh/login/start');
          let shown = false;
          const result = await runOp(res, s => {
            try {
              const c = JSON.parse(s);
              if (!shown) {
                shown = true;
                const box = h(`<div class="cwc-card" style="background:var(--bg);margin:10px 0 0"><div style="font-size:14px">1. Откройте <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a></div>
                  <div style="font-size:14px;margin-top:6px">2. Введите код:</div><div style="font:600 30px var(--mono);letter-spacing:.08em;color:var(--accent);margin:8px 0">${esc(c.code)}</div>
                  <div class="cw-row"><button class="cwc-btn" data-copy>${ic('copy', 14)}Копировать код</button></div></div>`);
                box.querySelector('[data-copy]').onclick = () => CW.copy(c.code);
                card.appendChild(box);
                st.busy('Жду подтверждения на github.com…');
              }
            } catch (e) { if (s) st.busy(s); }
          });
          toast('Вход выполнен: @' + result.login);
          start();
        } catch (e) { st.err(e.message); }
      };
      card.querySelector('[data-token]').onclick = () => promptBox('Вход токеном', 'Personal access token (github.com → Settings → Developer settings → Personal access tokens) с доступом к репозиториям. Токен уйдёт на телефон и останется там.', '', 'Войти', async t => {
        try { const r = await post('gh/login/token', { token: t }); toast('Вход выполнен: @' + r.login); start(); } catch (e) { st.err(e.message); }
      }, { placeholder: 'ghp_… или github_pat_…' });
      return card;
    }
    async function drawHome() {
      if (!g.state.loggedIn) pad.appendChild(loginCard());
      const open = h(`<div class="cwc-card"><h3>Открыть репозиторий</h3><div class="cw-row"><input class="cwc-in" style="flex:1;min-width:200px" placeholder="владелец/имя"><button class="cwc-btn primary">Открыть</button></div></div>`);
      const oi = open.querySelector('input');
      const go = () => { const v = oi.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''); if (v.includes('/')) openRepo(v); };
      open.querySelector('button').onclick = go;
      oi.onkeydown = e => { if (e.key === 'Enter') go(); };
      pad.appendChild(open);
      if (!g.state.loggedIn) return;
      const card = h(`<div class="cwc-card" style="padding:0;overflow:hidden"><div class="cwc-bar" style="border-bottom:1px solid var(--border)"><div class="grow"><b>Мои репозитории</b>
        <div style="font-size:12.5px;color:var(--muted)">@${esc(g.state.login)} · ${ic('link', 12)} — подключить к проекту</div></div></div><div data-l><div class="cwc-status" style="padding:12px"><span class="cwc-spin"></span>Загружаю…</div></div></div>`);
      const bar = card.querySelector('.cwc-bar');
      const search = h('<input class="cwc-in" placeholder="Поиск…" style="width:160px">');
      const create = h(`<button class="cwc-btn">${ic('plus', 14)}Новый</button>`);
      const reload = h(`<button class="icon-btn sm" title="Обновить">${ic('refresh')}</button>`);
      const menuB = h(`<button class="icon-btn sm" title="Ещё">${icon('dots')}</button>`);
      bar.append(search, create, reload, menuB);
      menuB.onclick = () => CW.menu(menuB, [{ label: 'Выйти из GitHub', danger: true, onClick: () => CW.confirmBox('Выйти из GitHub?', 'Токен будет удалён с телефона.', 'Выйти', async () => { await post('gh/logout').catch(e => toast(e.message)); g.repos = null; start(); }) }], { alignRight: true });
      reload.onclick = () => { g.repos = null; draw(); };
      create.onclick = () => newRepoDialog();
      pad.appendChild(card);
      const listEl = card.querySelector('[data-l]');
      try { if (!g.repos) g.repos = (await get('gh/repos')).repos; } catch (e) { listEl.innerHTML = `<div class="err-box" style="margin:12px">${esc(e.message)}</div>`; return; }
      const drawList = () => {
        const q = search.value.trim().toLowerCase();
        const items = g.repos.filter(r => !q || r.fullName.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
        listEl.innerHTML = items.length ? '' : '<div class="empty">Репозиториев нет</div>';
        items.forEach(r => {
          const row = h(`<div class="cwc-rrow"><div class="t"><div class="n">${r.private ? ic('lock', 13) : ''}${esc(r.fullName)}</div>${r.description ? `<div class="d">${esc(r.description)}</div>` : ''}</div>
            <button class="icon-btn" title="Подключить к проекту" style="color:var(--accent)">${ic('link')}</button></div>`);
          row.onclick = e => { if (e.target.closest('button')) { e.stopPropagation(); linkDialog(r.fullName, r.defaultBranch); return; } openRepo(r.fullName); };
          listEl.appendChild(row);
        });
      };
      search.oninput = drawList;
      drawList();
    }
    function newRepoDialog() {
      CW.modal(`<h3>Новый репозиторий</h3><input class="field" data-n placeholder="Имя (например, my-app)"><input class="field" data-d placeholder="Описание (необязательно)">
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 8px"><input type="checkbox" data-p checked> Приватный</label>
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`, (bg, close) => {
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = async () => {
          const name = bg.querySelector('[data-n]').value.trim();
          if (!name) return;
          close();
          try { const r = await post('gh/create-repo', { name, description: bg.querySelector('[data-d]').value, private: bg.querySelector('[data-p]').checked }); g.repos = null; toast('Создан ' + r.fullName); openRepo(r.fullName); }
          catch (e) { toast(e.message); }
        };
      });
    }
    /** Подключить репозиторий к проекту (новому или существующему) — как на телефоне. */
    async function linkDialog(repo, branch) {
      const data = await loadProjects(true).catch(() => ({ projects: [] }));
      let branches = [branch];
      CW.modal(`<h3>Подключить ${esc(repo)}</h3>
        <label style="font-size:13px;color:var(--muted)">Ветка</label><select class="field" data-b><option>${esc(branch)}</option></select>
        <label style="font-size:13px;color:var(--muted)">Папка в репозитории (необязательно — весь репозиторий)</label><input class="field" data-f placeholder="например, apps/web">
        <p style="font-size:13px;color:var(--muted)">Файлы ветки будут загружены в рабочую папку проекта (её прежнее содержимое заменится). Claude Code будет работать с ними, а изменения отправляются кнопкой «Отправить».</p>
        <div data-p style="max-height:220px;overflow:auto;margin-bottom:8px"></div>
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Подключить</button></div>`, (bg, close) => {
        const sel = bg.querySelector('[data-b]');
        get('gh/branches', { repo }).then(r => { branches = r.branches; sel.innerHTML = branches.map(b => `<option${b === branch ? ' selected' : ''}>${esc(b)}</option>`).join(''); }).catch(() => {});
        const box = bg.querySelector('[data-p]');
        const opts = [{ id: '', name: `Новый проект «${repo.split('/')[1]}»` }].concat(data.projects.filter(p => p.id).map(p => ({ id: p.id, name: p.name + (p.repo ? ' · ' + p.repo : '') })));
        box.innerHTML = opts.map((o, i) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0;font-size:14px"><input type="radio" name="lp" value="${esc(o.id)}"${(ctx.pid ? o.id === ctx.pid : i === 0) ? ' checked' : ''}>${esc(o.name)}</label>`).join('');
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = async () => {
          const project = (box.querySelector('input:checked') || {}).value || '';
          const target = { repo, branch: sel.value, project, path: bg.querySelector('[data-f]').value.trim() };
          close();
          const st = statusLine(); pad.prepend(st);
          st.busy('Подключаю ' + repo + '…');
          try {
            const r = await runOp(await post('gh/link', target), s => st.busy(s));
            toast(`Репозиторий ${repo} (ветка ${r.branch}) подключён к проекту`);
            PROJECTS = null;
            CW.go('code/' + encodeURIComponent(r.project) + '/files');
          } catch (e) { st.err(e.message); }
        };
      });
    }

    // ---- репозиторий
    async function openRepo(repo, branch, tab) {
      g.repo = repo; g.branch = branch || ''; g.tab = tab || 'code'; g.path = ''; g.detail = null; g.info = null; g.branches = [];
      pad.innerHTML = '<div class="cwc-status"><span class="cwc-spin"></span>Открываю ' + esc(repo) + '…</div>';
      try { g.info = await get('gh/repo', { repo }); } catch (e) { pad.innerHTML = ''; const back = h(`<button class="cwc-btn">${ic('back', 14)}Назад</button>`); back.onclick = () => { g.repo = null; draw(); }; pad.append(back, h(`<div class="err-box" style="margin-top:10px">${esc(e.message)}</div>`)); return; }
      if (!g.branch) g.branch = g.info.defaultBranch;
      g.branches = [g.branch];
      get('gh/branches', { repo }).then(r => { g.branches = r.branches; }).catch(() => {});
      draw();
    }
    function drawRepo() {
      const headEl = h(`<div class="cwc-bar" style="padding:0 0 10px;border:0">
        <button class="icon-btn sm" title="К списку">${ic('back')}</button>
        <div class="grow"><div style="font-weight:600;font-size:16px;display:flex;gap:6px;align-items:center">${g.info.private ? ic('lock', 14) : ''}${esc(g.repo)}</div>${g.info.description ? `<div style="font-size:13px;color:var(--muted)">${esc(g.info.description)}</div>` : ''}</div></div>`);
      headEl.querySelector('button').onclick = () => { g.repo = null; g.detail = null; draw(); };
      const br = h(`<button class="cwc-btn" title="Ветка">${ic('branch', 14)}<span style="font-family:var(--mono)">${esc(g.branch)}</span>${ic('down', 12)}</button>`);
      br.onclick = () => CW.menu(br, [{ header: 'Ветка' }].concat(g.branches.map(b => ({ label: b + (b === g.info.defaultBranch ? ' (основная)' : ''), checked: b === g.branch, onClick: () => { g.branch = b; g.path = ''; g.detail = null; draw(); } })))
        .concat([{ sep: true }, { label: 'Новая ветка…', onClick: () => newBranch() }]));
      const linkB = h(`<button class="cwc-btn" title="Подключить к проекту">${ic('link', 14)}Подключить</button>`);
      linkB.onclick = () => linkDialog(g.repo, g.branch);
      const imp = h(`<button class="cwc-btn" title="Скачать файлы ветки в папку «${esc(g.repo.split('/')[1])}» рабочей папки">${ic('clouddown', 14)}Импорт</button>`);
      imp.onclick = async () => {
        const st = statusLine(); pad.insertBefore(st, pad.children[1] || null);
        st.busy('Импорт…');
        try { const r = await runOp(await post('gh/import', { repo: g.repo, ref: g.branch, project: ctx.pid }), s => st.busy(s)); st.ok(`Импортировано файлов: ${r.count} → папка «${r.folder}» во вкладке «Файлы»`); }
        catch (e) { st.err(e.message); }
      };
      const gh = h(`<button class="icon-btn sm" title="Открыть на GitHub">${ic('open')}</button>`);
      gh.onclick = () => window.open('https://github.com/' + g.repo, '_blank', 'noopener');
      headEl.append(br);
      if (!linked()) headEl.append(linkB, imp);
      headEl.append(gh);
      pad.appendChild(headEl);
      const tabs = h('<div class="cwc-tabs" style="padding:0;margin:0 0 14px"></div>');
      const list = (linked() ? [['project', 'Проект', 'folder']] : []).concat([['code', 'Код', 'code'], ['commits', 'Коммиты', 'commit'], ['pulls', 'Pull requests', 'pr'], ['issues', 'Issues', 'issue'], ['actions', 'Actions', 'actions']]);
      list.forEach(([id, label, ico]) => {
        const b = h(`<button class="${g.tab === id ? 'on' : ''}">${ic(ico, 15)}${esc(label)}</button>`);
        b.onclick = () => { g.tab = id; g.detail = null; draw(); };
        tabs.appendChild(b);
      });
      pad.appendChild(tabs);
      const area = h('<div></div>');
      pad.appendChild(area);
      if (g.tab === 'project') projectTab(area);
      else if (g.tab === 'code') codeTab(area);
      else if (g.tab === 'commits') commitsTab(area);
      else if (g.tab === 'pulls' || g.tab === 'issues') issuesTab(area, g.tab === 'pulls');
      else actionsTab(area);
    }
    function newBranch() {
      promptBox('Новая ветка', 'От ветки ' + g.branch, '', 'Создать', async name => {
        try { await post('gh/create-branch', { repo: g.repo, name, from: g.branch }); g.branches.push(name); g.branch = name; toast('Ветка ' + name + ' создана'); draw(); }
        catch (e) { toast(e.message); }
      }, { placeholder: 'feature/…' });
    }

    // ---- «Проект»: репозиторий, подключённый к проекту (те же действия, что у Claude)
    function projectTab(area) {
      const p = ctx.project;
      const out = h('<div></div>');
      const st = statusLine();
      const tool = async (name, input, label) => {
        st.busy(label || 'Выполняю…');
        try {
          const r = await runOp(await post('git', { project: ctx.pid, tool: name, input: input || {} }), s => st.busy(s));
          st.clear();
          return r;
        } catch (e) { st.err(e.message); throw e; }
      };
      const showText = (title, text, diff) => {
        out.innerHTML = '';
        const card = h(`<div class="cwc-card"><h3>${esc(title)}</h3><pre class="cwc-pre${diff ? ' cwc-diff' : ''}"></pre></div>`);
        const pre = card.querySelector('pre');
        if (diff) pre.innerHTML = diffHtml(text); else pre.textContent = text;
        out.appendChild(card);
      };
      const card = h(`<div class="cwc-card"><h3>${ic('folder', 16)}${esc(p.name)}</h3>
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:10px">Папка проекта связана с <b>${esc(p.repo + (p.folder ? '/' + p.folder : ''))}</b>, ветка <b style="font-family:var(--mono)">${esc(p.branch)}</b>.
        Загрузка и отправка — в полосе над вкладками.</div><div class="cw-row" data-b></div></div>`);
      const row = card.querySelector('[data-b]');
      const add = (ico, label, fn) => { const b = h(`<button class="cwc-btn">${ic(ico, 14)}${esc(label)}</button>`); b.onclick = fn; row.appendChild(b); };
      add('check', 'Статус', () => tool('git_status', {}, 'Сравниваю с GitHub…').then(r => showText('Статус', r.text)).catch(() => {}));
      add('code', 'Изменения (diff)', () => tool('git_diff', {}, 'Готовлю diff…').then(r => showText('Неотправленные изменения', r.text, true)).catch(() => {}));
      add('commit', 'История', () => tool('git_log', { limit: 30 }, 'Загружаю историю…').then(r => showText('История ветки', r.text)).catch(() => {}));
      add('branch', 'Сменить ветку', async () => {
        let branches = g.branches;
        try { branches = (await get('gh/branches', { repo: p.repo })).branches; } catch (e) {}
        CW.menu(row, [{ header: 'Работать с веткой' }].concat(branches.map(b => ({ label: b, checked: b === p.branch, onClick: () => {
          if (b === p.branch) return;
          tool('switch_branch', { branch: b }, 'Переключаю ветку…').then(r => { toast(r.text); p.branch = b; ctx.reloadSync && ctx.reloadSync(); ctx.refreshFiles && ctx.refreshFiles(); draw(); })
            .catch(e => { if (/неотправленных изменений/.test(e.message)) CW.confirmBox('Сменить ветку?', e.message + '\n\nСтереть неотправленные изменения и переключиться?', 'Стереть и переключить', () => tool('switch_branch', { branch: b, force: true }).then(r => { toast(r.text); p.branch = b; ctx.reloadSync && ctx.reloadSync(); draw(); }).catch(() => {})); });
        } }))).concat([{ sep: true }, { label: 'Создать ветку и отправить в неё…', onClick: () => promptBox('Новая ветка', 'Изменения папки уйдут в новую ветку (от ' + p.branch + ')', '', 'Создать', name =>
          tool('git_push', { branch: name, message: 'Изменения из Claude app' }, 'Отправляю в ' + name + '…').then(r => showText('Отправка', r.text)).catch(() => {})) }]));
      });
      add('pr', 'Создать pull request', () => {
        CW.modal(`<h3>Pull request из ${esc(p.branch)}</h3><input class="field" data-base placeholder="В ветку (пусто — основная)"><input class="field" data-t placeholder="Заголовок"><textarea class="field" data-b placeholder="Описание"></textarea>
          <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`, (bg, close) => {
          bg.querySelector('[data-x]').onclick = close;
          bg.querySelector('[data-ok]').onclick = () => {
            const input = { base: bg.querySelector('[data-base]').value.trim(), title: bg.querySelector('[data-t]').value.trim(), body: bg.querySelector('[data-b]').value };
            close();
            tool('create_pull_request', input, 'Создаю pull request…').then(r => showText('Pull request', r.text)).catch(() => {});
          };
        });
      });
      area.appendChild(card);
      // Сборка приложения (build_app): workflow, отправка, запуск, ожидание, скачивание в .builds
      const build = h(`<div class="cwc-card"><h3>${ic('actions', 16)}Сборка приложения</h3>
        <div style="font-size:13.5px;color:var(--text-2);margin-bottom:10px">Одной кнопкой: workflow (создаётся, если нет) → отправка правок → запуск в GitHub Actions → ожидание → готовый файл в «Файлы» → .builds.</div>
        <div class="cw-row"><select class="cwc-sel" data-k></select><input class="cwc-in" data-m placeholder="Описание (необязательно)" style="flex:1;min-width:160px"><button class="cwc-btn accent" data-go>${ic('play', 14)}Собрать</button></div><div data-o style="margin-top:10px"></div></div>`);
      const kinds = (g.state && g.state.buildKinds) || ['android', 'web', 'python', 'windows'];
      const titles = { android: 'Android (APK)', web: 'Веб-сайт', python: 'Python', windows: 'Windows (EXE)' };
      build.querySelector('[data-k]').innerHTML = kinds.map(k => `<option value="${esc(k)}">${esc(titles[k] || k)}</option>`).join('');
      const bst = statusLine();
      build.querySelector('[data-o]').appendChild(bst);
      build.querySelector('[data-go]').onclick = async e => {
        const b = e.currentTarget; b.disabled = true;
        bst.busy('Готовлю сборку…');
        try {
          const r = await runOp(await post('git', { project: ctx.pid, tool: 'build_app', input: { kind: build.querySelector('[data-k]').value, message: build.querySelector('[data-m]').value.trim() } }), s => bst.busy(s));
          bst.ok('Сборка готова');
          const res = h(`<div style="margin-top:8px"><pre class="cwc-pre"></pre><div class="cw-row" style="margin-top:8px"></div></div>`);
          res.querySelector('pre').textContent = r.text;
          (r.files || []).forEach(f => { const d = h(`<a class="cwc-btn primary" href="${esc(rawUrl(ctx.pid, f, true))}" target="_blank">${ic('download', 14)}${esc(baseName(f))}</a>`); res.querySelector('.cw-row').appendChild(d); });
          build.querySelector('[data-o]').appendChild(res);
          ctx.refreshFiles && ctx.refreshFiles();
        } catch (err) { bst.err(err.message); } finally { b.disabled = false; }
      };
      area.appendChild(build);
      area.appendChild(st);
      area.appendChild(out);
    }

    // ---- код репозитория
    async function codeTab(area) {
      const crumbs = h('<div class="cw-row" style="font-family:var(--mono);font-size:13px;margin-bottom:8px"></div>');
      const segs = g.path ? g.path.split('/') : [];
      const rootLink = h(`<a href="#" style="color:var(--accent)">${esc(g.repo.split('/')[1])}</a>`);
      rootLink.onclick = e => { e.preventDefault(); g.path = ''; draw(); };
      crumbs.appendChild(rootLink);
      segs.forEach((s, i) => {
        crumbs.appendChild(h('<span style="color:var(--muted)">/</span>'));
        const a = h(`<a href="#" style="color:var(--accent)">${esc(s)}</a>`);
        a.onclick = e => { e.preventDefault(); g.path = segs.slice(0, i + 1).join('/'); draw(); };
        crumbs.appendChild(a);
      });
      area.appendChild(crumbs);
      const card = h('<div class="cwc-card" style="padding:0;overflow:hidden"><div class="cwc-status" style="padding:12px"><span class="cwc-spin"></span>Загружаю…</div></div>');
      area.appendChild(card);
      try {
        const r = await get('gh/contents', { repo: g.repo, path: g.path, ref: g.branch });
        card.innerHTML = r.entries.length ? '' : '<div class="empty">Пусто</div>';
        r.entries.forEach(it => {
          const row = h(`<div class="cwc-rrow" style="padding:8px 12px"><span style="color:${it.dir ? 'var(--accent)' : 'var(--muted)'}">${ic(it.dir ? 'folder' : 'file', 16)}</span><div class="t"><div class="n" style="font-weight:400">${esc(it.name)}</div></div>${it.dir ? '' : `<span style="font-size:12px;color:var(--muted)">${esc(CW.size(it.size))}</span>`}</div>`);
          row.onclick = () => { if (it.dir) { g.path = it.path; draw(); } else ghFile(it); };
          card.appendChild(row);
        });
        const readme = r.entries.find(e => /^readme\.md$/i.test(e.name));
        if (readme) {
          const rc = h('<div class="cwc-card"><h3>README.md</h3><div class="md" style="font-family:var(--serif);font-size:15.5px"></div></div>');
          area.appendChild(rc);
          get('gh/file', { repo: g.repo, path: readme.path, ref: g.branch }).then(f => { if (f.content != null) { rc.querySelector('.md').innerHTML = CW.markdown(f.content); CW.enhance(rc); } }).catch(() => rc.remove());
        }
      } catch (e) { card.innerHTML = `<div class="err-box" style="margin:12px">${esc(e.message)}</div>`; }
    }
    function ghFile(it) {
      CW.modal(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><b style="flex:1;font-family:var(--mono);font-size:13.5px;word-break:break-all">${esc(it.path)}</b>
        <button class="icon-btn sm" data-ask title="Спросить Claude">${ic('spark')}</button><a class="icon-btn sm" data-dl title="Скачать" target="_blank">${ic('download')}</a><button class="icon-btn sm" data-x title="Закрыть">${ic('x')}</button></div>
        <div data-c><div class="cwc-status"><span class="cwc-spin"></span>Загружаю…</div></div>`, (bg, close) => {
        bg.querySelector('.modal').style.maxWidth = '960px';
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-dl]').href = ghRawUrl(g.repo, it.path, g.branch, true);
        const c = bg.querySelector('[data-c]');
        let text = null;
        bg.querySelector('[data-ask]').onclick = () => { close(); askClaude(ctx.pid, `Файл \`${it.path}\` из репозитория ${g.repo} (ветка ${g.branch}):\n\`\`\`\n${(text || '').slice(0, 60000)}\n\`\`\`\n\n`); };
        const ext = it.name.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) { c.innerHTML = `<div class="cwc-media" style="max-height:70vh"><img src="${esc(ghRawUrl(g.repo, it.path, g.branch))}"></div>`; return; }
        get('gh/file', { repo: g.repo, path: it.path, ref: g.branch }).then(f => {
          if (f.content == null) { c.innerHTML = `<div class="cwc-empty">${f.tooLarge ? 'Файл слишком большой для просмотра' : 'Двоичный файл — его можно скачать'}</div>`; return; }
          text = f.content;
          c.innerHTML = `<div class="cwc-code" style="max-height:70vh;border-radius:10px;border:1px solid var(--border)"><pre class="cwc-src">${highlight(f.content, langOf(it.path))}</pre></div>`;
        }).catch(e => { c.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; });
      });
    }
    async function commitsTab(area) {
      const card = h('<div class="cwc-card" style="padding:0;overflow:hidden"><div class="cwc-status" style="padding:12px"><span class="cwc-spin"></span>Загружаю…</div></div>');
      area.appendChild(card);
      try {
        const r = await get('gh/commits', { repo: g.repo, ref: g.branch });
        card.innerHTML = r.commits.length ? '' : '<div class="empty">Коммитов нет</div>';
        r.commits.forEach(c => {
          const row = h(`<div class="cwc-rrow"><div class="t"><div class="n" style="font-weight:400">${esc(c.message)}</div><div class="d" style="font-family:var(--mono)">${esc(c.sha)} · ${esc(c.author)} · ${esc(c.date)}</div></div>${ic('open', 14)}</div>`);
          row.onclick = () => window.open(`https://github.com/${g.repo}/commit/${c.sha}`, '_blank', 'noopener');
          card.appendChild(row);
        });
      } catch (e) { card.innerHTML = `<div class="err-box" style="margin:12px">${esc(e.message)}</div>`; }
    }

    // ---- pull requests и issues
    async function issuesTab(area, pulls) {
      if (g.detail) { issueDetail(area, pulls, g.detail); return; }
      const bar = h('<div class="cw-row" style="margin-bottom:10px"></div>');
      const seg = h('<div class="tabs"></div>');
      [['open', 'Открытые'], ['closed', 'Закрытые'], ['all', 'Все']].forEach(([id, label]) => {
        const b = h(`<button class="${g.filter === id ? 'on' : ''}">${esc(label)}</button>`);
        b.onclick = () => { g.filter = id; draw(); };
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      bar.appendChild(h('<span style="flex:1"></span>'));
      const nb = h(`<button class="cwc-btn primary">${ic('plus', 14)}${pulls ? 'Новый pull request' : 'Новая задача'}</button>`);
      nb.onclick = () => pulls ? newPr() : newIssue();
      bar.appendChild(nb);
      area.appendChild(bar);
      const card = h('<div class="cwc-card" style="padding:0;overflow:hidden"><div class="cwc-status" style="padding:12px"><span class="cwc-spin"></span>Загружаю…</div></div>');
      area.appendChild(card);
      try {
        const r = await get('gh/issues', { repo: g.repo, type: pulls ? 'pr' : 'issue', state: g.filter });
        card.innerHTML = r.items.length ? '' : `<div class="empty">${pulls ? 'Pull request нет' : 'Задач нет'}</div>`;
        r.items.forEach(it => {
          const cls = it.state === 'open' ? 'ok' : 'pur';
          const row = h(`<div class="cwc-rrow"><span class="cwc-st ${cls}">${it.state === 'open' ? (it.draft ? 'черновик' : 'открыт') : 'закрыт'}</span><div class="t"><div class="n" style="font-weight:500">${esc(it.title)}</div>
            <div class="d">#${it.number} · ${esc(it.user)} · ${esc((it.createdAt || '').slice(0, 10))}${it.comments ? ' · 💬 ' + it.comments : ''}${it.labels.length ? ' · ' + esc(it.labels.join(', ')) : ''}</div></div></div>`);
          row.onclick = () => { g.detail = it.number; draw(); };
          card.appendChild(row);
        });
      } catch (e) { card.innerHTML = `<div class="err-box" style="margin:12px">${esc(e.message)}</div>`; }
    }
    async function issueDetail(area, pulls, number) {
      const back = h(`<button class="cwc-btn" style="margin-bottom:10px">${ic('back', 14)}Ко всем</button>`);
      back.onclick = () => { g.detail = null; draw(); };
      area.appendChild(back);
      const box = h('<div><div class="cwc-status"><span class="cwc-spin"></span>Загружаю…</div></div>');
      area.appendChild(box);
      let d;
      try { d = await get('gh/issue', { repo: g.repo, number }); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      box.innerHTML = '';
      const it = d.issue;
      const head = h(`<div class="cwc-card"><h3 style="font-size:18px">${esc(it.title)} <span style="color:var(--muted);font-weight:400">#${it.number}</span></h3>
        <div class="cw-row" style="font-size:13px;color:var(--muted)"><span class="cwc-st ${it.state === 'open' ? 'ok' : 'pur'}">${d.pr && d.pr.merged ? 'слит' : it.state === 'open' ? 'открыт' : 'закрыт'}</span>
        ${esc(it.user)} · ${esc((it.createdAt || '').slice(0, 10))}${d.pr ? ` · <span style="font-family:var(--mono)">${esc(d.pr.head)} → ${esc(d.pr.base)}</span> · +${d.pr.additions} −${d.pr.deletions} · файлов ${d.pr.changedFiles}` : ''}</div>
        <div class="md" style="margin-top:12px;font-family:var(--serif);font-size:15.5px"></div><div class="cw-row" data-a style="margin-top:12px"></div></div>`);
      head.querySelector('.md').innerHTML = d.body ? CW.markdown(d.body) : '<span style="color:var(--muted)">Без описания</span>';
      CW.enhance(head);
      const actions = head.querySelector('[data-a]');
      const act = (label, cls, fn) => { const b = h(`<button class="cwc-btn ${cls || ''}">${esc(label)}</button>`); b.onclick = fn; actions.appendChild(b); };
      if (d.pr && !d.pr.merged && it.state === 'open') {
        const mergeable = d.pr.mergeable;
        act('Слить…', 'primary', () => CW.menu(actions, [{ header: mergeable === false ? 'Есть конфликты — слить нельзя' : 'Способ слияния' },
          ...(mergeable === false ? [] : [['merge', 'Создать коммит слияния'], ['squash', 'Squash: один коммит'], ['rebase', 'Rebase']].map(([m, l]) => ({ label: l, onClick: () => CW.confirmBox('Слить pull request?', `#${number} ${d.pr.head} → ${d.pr.base} (${l})`, 'Слить', async () => {
            try { const r = await post('gh/merge', { repo: g.repo, number, method: m }); toast('Слит, коммит ' + r.sha); draw(); } catch (e) { toast(e.message); }
          }) })))]));
      }
      if (!(d.pr && d.pr.merged)) act(it.state === 'open' ? 'Закрыть' : 'Открыть снова', it.state === 'open' ? 'danger' : '', async () => {
        try { await post('gh/issue-state', { repo: g.repo, number, state: it.state === 'open' ? 'closed' : 'open' }); draw(); } catch (e) { toast(e.message); }
      });
      act('Спросить Claude', '', () => askClaude(ctx.pid, `${pulls ? 'Pull request' : 'Задача'} #${number} в ${g.repo}: «${it.title}»\n${it.url}\n\n${(d.body || '').slice(0, 8000)}\n\n`));
      act('Открыть на GitHub', 'ghost', () => window.open(it.url, '_blank', 'noopener'));
      box.appendChild(head);
      if (d.files && d.files.length) {
        const files = h(`<div class="cwc-card"><h3>Изменённые файлы (${d.files.length})</h3></div>`);
        d.files.forEach(f => {
          const det = h(`<details class="fold" style="margin:6px 0"><summary>${ic('chev', 13)}<span style="font-family:var(--mono);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</span><span style="color:var(--ok)">+${f.additions}</span> <span style="color:var(--danger)">−${f.deletions}</span></summary><pre class="cwc-pre cwc-diff" style="margin:0 10px 10px"></pre></details>`);
          det.querySelector('pre').innerHTML = f.patch ? diffHtml(f.patch) : '<span style="color:var(--muted)">Без текстовых изменений</span>';
          files.appendChild(det);
        });
        box.appendChild(files);
      }
      const thread = h(`<div class="cwc-card"><h3>Обсуждение (${d.thread.length})</h3></div>`);
      d.thread.forEach(c => {
        const el = h(`<div style="border-top:1px solid var(--border);padding:10px 0"><div style="font-size:13px;color:var(--muted)"><b style="color:var(--text)">${esc(c.user)}</b> · ${esc((c.createdAt || '').replace('T', ' ').slice(0, 16))}</div><div class="md" style="font-size:14.5px;margin-top:4px"></div></div>`);
        el.querySelector('.md').innerHTML = CW.markdown(c.body || '');
        thread.appendChild(el);
      });
      const form = h('<div style="border-top:1px solid var(--border);padding-top:10px"><textarea class="cw-field" placeholder="Комментарий (Markdown)…"></textarea><div class="cw-row" style="margin-top:8px;justify-content:flex-end"><button class="cwc-btn primary">Комментировать</button></div></div>');
      form.querySelector('button').onclick = async () => {
        const body = form.querySelector('textarea').value.trim();
        if (!body) return;
        try { await post('gh/comment', { repo: g.repo, number, body }); toast('Комментарий добавлен'); draw(); } catch (e) { toast(e.message); }
      };
      thread.appendChild(form);
      box.appendChild(thread);
    }
    function newIssue() {
      CW.modal(`<h3>Новая задача</h3><input class="field" data-t placeholder="Заголовок"><textarea class="field" data-b placeholder="Описание (Markdown)"></textarea><input class="field" data-l placeholder="Метки через запятую (необязательно)">
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`, (bg, close) => {
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = async () => {
          const title = bg.querySelector('[data-t]').value.trim();
          if (!title) return;
          close();
          try { const r = await post('gh/new-issue', { repo: g.repo, title, body: bg.querySelector('[data-b]').value, labels: bg.querySelector('[data-l]').value }); toast('Создана задача #' + r.number); g.detail = r.number; draw(); }
          catch (e) { toast(e.message); }
        };
      });
    }
    function newPr() {
      const opts = g.branches.map(b => `<option${b === g.branch && b !== g.info.defaultBranch ? ' selected' : ''}>${esc(b)}</option>`).join('');
      CW.modal(`<h3>Новый pull request</h3><label style="font-size:13px;color:var(--muted)">Из ветки</label><select class="field" data-h>${opts}</select>
        <label style="font-size:13px;color:var(--muted)">В ветку</label><select class="field" data-base>${g.branches.map(b => `<option${b === g.info.defaultBranch ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <input class="field" data-t placeholder="Заголовок"><textarea class="field" data-b placeholder="Описание"></textarea>
        <div class="btns"><button class="btn" data-x>Отмена</button><button class="btn primary" data-ok>Создать</button></div>`, (bg, close) => {
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-ok]').onclick = async () => {
          const head = bg.querySelector('[data-h]').value, base = bg.querySelector('[data-base]').value;
          if (head === base) { toast('Выберите разные ветки'); return; }
          close();
          try { const r = await post('gh/new-pr', { repo: g.repo, head, base, title: bg.querySelector('[data-t]').value.trim(), body: bg.querySelector('[data-b]').value }); toast('Pull request создан'); window.open(r.url, '_blank', 'noopener'); draw(); }
          catch (e) { toast(e.message); }
        };
      });
    }

    // ---- GitHub Actions
    async function actionsTab(area) {
      if (g.detail) { runDetail(area, g.detail); return; }
      const wf = h('<div class="cwc-card"><h3>Workflow</h3><div data-w><div class="cwc-status"><span class="cwc-spin"></span>Загружаю…</div></div></div>');
      area.appendChild(wf);
      const runsCard = h(`<div class="cwc-card" style="padding:0;overflow:hidden"><div class="cwc-bar" style="border-bottom:1px solid var(--border)"><b class="grow">Запуски · ${esc(g.branch)}</b></div><div data-r><div class="cwc-status" style="padding:12px"><span class="cwc-spin"></span>Загружаю…</div></div></div>`);
      const allB = h(`<button class="cwc-chip${g.allBranches ? ' on' : ''}">Все ветки</button>`);
      allB.onclick = () => { g.allBranches = !g.allBranches; draw(); };
      const rl = h(`<button class="icon-btn sm" title="Обновить">${ic('refresh')}</button>`);
      rl.onclick = () => draw();
      runsCard.querySelector('.cwc-bar').append(allB, rl);
      area.appendChild(runsCard);
      get('gh/workflows', { repo: g.repo }).then(r => {
        const box = wf.querySelector('[data-w]');
        box.innerHTML = r.workflows.length ? '' : '<div style="font-size:13.5px;color:var(--muted)">Workflow нет. Создайте .github/workflows/&lt;имя&gt;.yml с триггером workflow_dispatch или соберите приложение во вкладке «Проект».</div>';
        r.workflows.forEach(w => {
          const row = h(`<div class="cw-row" style="padding:5px 0;border-top:1px solid var(--border)"><span style="flex:1;min-width:0"><b style="font-weight:500">${esc(w.name)}</b> <span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${esc(w.path)}</span></span></div>`);
          const run = h(`<button class="cwc-btn">${ic('play', 13)}Запустить</button>`);
          run.onclick = () => promptBox('Запустить ' + w.name, 'Ветка (нужен триггер workflow_dispatch)', g.branch, 'Запустить', async ref => {
            try { await post('gh/dispatch', { repo: g.repo, workflow: w.path.split('/').pop(), ref }); toast('Запущен — запуск появится через 5–10 секунд'); setTimeout(() => { if (alive(root)) draw(); }, 6000); }
            catch (e) { toast(e.message); }
          });
          row.appendChild(run);
          box.appendChild(row);
        });
      }).catch(e => { wf.querySelector('[data-w]').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; });
      try {
        const r = await get('gh/runs', { repo: g.repo, branch: g.allBranches ? '' : g.branch, limit: 25 });
        const box = runsCard.querySelector('[data-r]');
        box.innerHTML = r.runs.length ? '' : '<div class="empty">Запусков нет</div>';
        r.runs.forEach(run => {
          const row = h(`<div class="cwc-rrow"><span class="cwc-st ${ghStatusClass(run.status, run.conclusion)}">${esc(ghStatusText(run.status, run.conclusion))}</span><div class="t"><div class="n" style="font-weight:500">${esc(run.title || run.name)}</div>
            <div class="d">${esc(run.name)} · ${esc(run.branch)} · ${esc(run.event)} · <span style="font-family:var(--mono)">${esc(run.sha)}</span> · ${esc((run.createdAt || '').replace('T', ' ').slice(0, 16))}</div></div></div>`);
          row.onclick = () => { g.detail = run.id; draw(); };
          box.appendChild(row);
        });
        if (r.runs.some(x => x.status !== 'completed')) setTimeout(() => { if (alive(runsCard) && g.tab === 'actions' && !g.detail) draw(); }, 15000);
      } catch (e) { runsCard.querySelector('[data-r]').innerHTML = `<div class="err-box" style="margin:12px">${esc(e.message)}</div>`; }
    }
    async function runDetail(area, id) {
      const back = h(`<button class="cwc-btn" style="margin-bottom:10px">${ic('back', 14)}Все запуски</button>`);
      back.onclick = () => { g.detail = null; draw(); };
      area.appendChild(back);
      const box = h('<div><div class="cwc-status"><span class="cwc-spin"></span>Загружаю…</div></div>');
      area.appendChild(box);
      let d;
      try { d = await get('gh/run', { repo: g.repo, id }); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
      box.innerHTML = '';
      const r = d.run;
      const head = h(`<div class="cwc-card"><h3>${esc(r.title || r.name)}</h3><div class="cw-row" style="font-size:13px;color:var(--muted)"><span class="cwc-st ${ghStatusClass(r.status, r.conclusion)}">${esc(ghStatusText(r.status, r.conclusion))}</span>${esc(r.name)} · ${esc(r.branch)} · ${esc(r.event)} · ${esc(r.sha)}</div><div class="cw-row" data-a style="margin-top:10px"></div></div>`);
      const a = head.querySelector('[data-a]');
      const act = (label, cls, fn) => { const b = h(`<button class="cwc-btn ${cls || ''}">${esc(label)}</button>`); b.onclick = fn; a.appendChild(b); };
      if (r.status !== 'completed') act('Отменить', 'danger', () => post('gh/cancel', { repo: g.repo, id }).then(() => { toast('Отменяется'); draw(); }).catch(e => toast(e.message)));
      else {
        if (r.conclusion !== 'success') act('Перезапустить упавшие', 'primary', () => post('gh/rerun', { repo: g.repo, id, failedOnly: true }).then(() => { toast('Перезапущен'); draw(); }).catch(e => toast(e.message)));
        act('Перезапустить всё', '', () => post('gh/rerun', { repo: g.repo, id, failedOnly: false }).then(() => { toast('Перезапущен'); draw(); }).catch(e => toast(e.message)));
      }
      if (r.conclusion === 'failure') act('Исправить с Claude', '', () => askClaude(ctx.pid, `Сборка GitHub Actions упала: ${r.name} (${g.repo}, ветка ${r.branch}, запуск ${r.id})\n${r.url}\n\nНайди причину по журналу (get_run run_id=${r.id}) и исправь.`));
      act('Открыть на GitHub', 'ghost', () => window.open(r.url, '_blank', 'noopener'));
      box.appendChild(head);
      const jobs = h('<div class="cwc-card"><h3>Задачи</h3></div>');
      d.jobs.forEach(j => {
        const el = h(`<div style="border-top:1px solid var(--border);padding:8px 0"><div class="cw-row"><span class="cwc-st ${ghStatusClass(j.status, j.conclusion)}">${esc(ghStatusText(j.status, j.conclusion))}</span><b style="flex:1;font-weight:500">${esc(j.name)}</b></div>
          <div class="cwc-steps">${j.steps.map(s => `<div>${s.conclusion === 'success' ? '✓' : s.conclusion === 'failure' ? '✗' : s.status !== 'completed' ? '…' : '·'} ${esc(s.name)}</div>`).join('')}</div></div>`);
        const lb = h(`<button class="cwc-btn">${ic('term', 13)}Журнал</button>`);
        lb.onclick = () => jobLog(j);
        el.querySelector('.cw-row').appendChild(lb);
        jobs.appendChild(el);
      });
      box.appendChild(jobs);
      if (d.artifacts.length) {
        const arts = h('<div class="cwc-card"><h3>Артефакты</h3><div style="font-size:13px;color:var(--muted);margin-bottom:6px">Скачиваются в папку .builds проекта — оттуда их можно скачать на компьютер.</div></div>');
        d.artifacts.forEach(art => {
          const row = h(`<div class="cw-row" style="border-top:1px solid var(--border);padding:6px 0"><span style="flex:1">${esc(art.name)} <span style="color:var(--muted);font-size:12.5px">${esc(CW.size(art.size))}${art.expired ? ' · истёк' : ''}</span></span></div>`);
          if (!art.expired) {
            const b = h(`<button class="cwc-btn primary">${ic('download', 13)}В проект</button>`);
            b.onclick = async () => {
              const st = statusLine(); row.appendChild(st);
              st.busy('Скачиваю…');
              try {
                const res = await runOp(await post('gh/artifact', { repo: g.repo, id: art.id, runId: id, name: art.name, project: ctx.pid }), s => st.busy(s));
                st.clear();
                (res.files || []).slice(0, 10).forEach(f => row.appendChild(h(`<a class="cwc-btn" href="${esc(rawUrl(ctx.pid, f, true))}" target="_blank">${ic('download', 13)}${esc(baseName(f))}</a>`)));
                ctx.refreshFiles && ctx.refreshFiles();
              } catch (e) { st.err(e.message); }
            };
            row.appendChild(b);
          }
          arts.appendChild(row);
        });
        box.appendChild(arts);
      }
      if (r.status !== 'completed') setTimeout(() => { if (alive(box) && g.detail === id) draw(); }, 12000);
    }
    function jobLog(j) {
      CW.modal(`<h3>Журнал: ${esc(j.name)}</h3><pre class="cwc-pre" style="max-height:65vh;background:#1e1e1c;color:#e8e6dc;white-space:pre">Загружаю…</pre>
        <div class="btns"><button class="btn" data-ask>Спросить Claude</button><button class="btn" data-copy>Копировать</button><button class="btn primary" data-x>Закрыть</button></div>`, (bg, close) => {
        bg.querySelector('.modal').style.maxWidth = '1000px';
        const pre = bg.querySelector('pre');
        bg.querySelector('[data-x]').onclick = close;
        bg.querySelector('[data-copy]').onclick = () => CW.copy(pre.textContent);
        bg.querySelector('[data-ask]').onclick = () => { close(); askClaude(ctx.pid, `Журнал задачи «${j.name}» (${g.repo}):\n\`\`\`\n${pre.textContent.slice(-20000)}\n\`\`\`\nНайди причину ошибки и исправь.`); };
        get('gh/joblog', { repo: g.repo, job: j.id }).then(r => { pre.textContent = (r.truncated ? '… (показан конец журнала)\n' : '') + r.log; pre.scrollTop = pre.scrollHeight; })
          .catch(e => { pre.textContent = e.message; });
      });
    }

    start();
    return root;
  }

  // ============================================================ отдельные страницы: терминал, GitHub, планы
  function scopedPage(title, routeArg, name, build) {
    const pid = pidOf(String(routeArg || '').split('/')[0]);
    const root = h('<div class="cwc"></div>');
    const head = h('<div class="cwc-head" style="padding-bottom:8px;border-bottom:1px solid var(--border)"></div>');
    const body = h('<div class="cwc-body"></div>');
    root.append(head, body);
    const ctx = { pid, project: null };
    const drawHead = () => {
      head.innerHTML = '';
      head.appendChild(h(`<b style="font-size:15px;margin-right:6px">${esc(title)}</b>`));
      head.appendChild(projectPicker(pid, id => CW.go(name + '/' + routeId(id))));
      head.appendChild(h('<div style="flex:1"></div>'));
      const files = h(`<button class="cwc-btn">${ic('code', 14)}Файлы проекта</button>`);
      files.onclick = () => CW.go('code/' + routeId(pid) + '/files');
      head.appendChild(files);
    };
    drawHead();
    loadProjects(true).then(d => {
      ctx.project = d.projects.find(p => p.id === pid) || null;
      drawHead();
      body.innerHTML = '';
      body.appendChild(build(ctx));
    }).catch(e => { body.innerHTML = `<div class="cwc-empty"><div class="err-box">${esc(e.message)}</div></div>`; });
    return root;
  }

  function todoPage() {
    const el = CW.pageShell('Планы задач');
    el.querySelector('.column').classList.add('wide', 'cwc-todo');
    const body = el.querySelector('.page-body');
    const bar = h('<div class="cw-row" style="margin-bottom:16px"></div>');
    const listEl = h('<div></div>');
    body.append(h('<div style="color:var(--muted);font-size:14px;margin:-8px 0 14px">Планы, которые Claude ведёт в чатах (update_todo): что выполняется сейчас, что не доделано и что уже готово. Нажатие открывает чат.</div>'), bar, listEl);
    let filter = CW.load('todoProject') || 'all';
    let showDone = CW.load('todoDone') !== '0';
    const draw = async () => {
      const data = await loadProjects().catch(() => ({ projects: [] }));
      bar.innerHTML = '';
      const sel = h('<select class="cwc-sel"></select>');
      [{ id: 'all', name: 'Все чаты' }].concat(data.projects.map(p => ({ id: p.id || 'default', name: p.id ? p.name : 'Чаты без проекта' }))).forEach(p => {
        const o = h(`<option>${esc(p.name)}</option>`); o.value = p.id; if (p.id === filter) o.selected = true; sel.appendChild(o);
      });
      sel.onchange = () => { filter = sel.value; CW.save('todoProject', filter); load(); };
      const done = h(`<button class="cwc-chip${showDone ? ' on' : ''}">Показывать готовые</button>`);
      done.onclick = () => { showDone = !showDone; CW.save('todoDone', showDone ? '1' : '0'); draw(); };
      bar.append(sel, done);
      await load();
    };
    const load = async () => {
      try {
        const r = await get('todo', { project: filter });
        if (!alive(listEl) && listEl.parentNode) return;
        const plans = r.plans.filter(p => showDone || p.items.some(i => i.status !== 2));
        listEl.innerHTML = plans.length ? '' : '<div class="empty">Планов пока нет. Claude составляет план для задач из нескольких шагов.</div>';
        plans.forEach(p => {
          const doneN = p.items.filter(i => i.status === 2).length;
          const card = h(`<div class="cwc-plan"><div class="ttl">${p.running ? '<span class="dot-run"></span>' : doneN === p.items.length ? `<span style="color:var(--ok)">${ic('check', 16)}</span>` : ''}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title || 'Чат')}</span>
            <span style="font-size:12.5px;color:var(--muted);font-weight:400">${esc(p.projectName || '')}${p.projectName ? ' · ' : ''}${doneN} из ${p.items.length} · ${esc(CW.ago(p.updatedAt))}</span></div>
            <div class="bar"><i style="width:${p.items.length ? Math.round(doneN * 100 / p.items.length) : 0}%"></i></div>
            ${p.items.map(i => `<div class="it ${i.status === 2 ? 'done' : i.status === 1 ? 'now' : ''}"><span class="mk">${i.status === 2 ? ic('check', 15) : i.status === 1 ? '<span class="dot-run"></span>' : '<span class="ring"></span>'}</span><span>${esc(i.text)}</span></div>`).join('')}</div>`);
          card.onclick = () => { location.hash = '#/chat/' + encodeURIComponent(p.chatId); };
          listEl.appendChild(card);
        });
      } catch (e) { listEl.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
    };
    draw();
    // Пока страница открыта — обновление раз в 5 секунд (план идёт вместе с ответом)
    (async () => { await sleep(5000); while (alive(listEl)) { await load(); await sleep(5000); } })();
    return el;
  }

  // ============================================================ регистрация
  CW.page('code', { title: 'Код', render: id => codePage(id) });
  CW.page('terminal', { title: 'Терминал', render: id => scopedPage('Терминал', id, 'terminal', ctx => terminalView(ctx, true)) });
  CW.page('github', { title: 'GitHub', render: id => scopedPage('GitHub', id, 'github', ctx => githubView(ctx)) });
  CW.page('todo', { title: 'Планы задач', render: () => todoPage() });
  CW.nav({ page: 'code', label: 'Код', icon: 'code', group: 'Код', order: 20 });
  CW.nav({ page: 'terminal', label: 'Терминал', icon: 'term', group: 'Код', order: 21 });
  CW.nav({ page: 'github', label: 'GitHub', icon: 'gh', group: 'Код', order: 22 });

  // Чат проекта: кнопка «Файлы проекта» в верхней строке
  CW.on('topbar', route => {
    if (!route || route.name !== 'chat') return null;
    const c = CW.S.chats.find(x => x.id === route.id);
    if (!c || !c.projectId) return null;
    const b = h(`<button class="icon-btn" title="Файлы проекта (Код)">${ic('code', 18)}</button>`);
    b.onclick = () => CW.go('code/' + encodeURIComponent(c.projectId) + '/files');
    return b;
  });
  // Меню чата: открыть код проекта или общую папку
  CW.on('chatMenu', c => [{ label: 'Открыть файлы (Код)', sub: c.projectId ? 'Папка проекта' : 'Общая папка', onClick: () => CW.go('code/' + routeId(c.projectId || '') + '/files') }]);
})();
