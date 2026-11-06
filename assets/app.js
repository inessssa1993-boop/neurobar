/* НЕЙРОБАР — сценарий и анимации. Данные и тексты: assets/cocktails.js */
(function () {
  'use strict';
  const D = window.NB_DATA, S = D.SETTINGS, E = window.NBEngine.create(D);
  const $ = id => document.getElementById(id);
  const el = {
    bg: $('bg'), vIdle: $('vIdle'), vTouch: $('vTouch'), flash: $('flash'), fx: $('fx'),
    helloTxt: $('helloTxt'), progress: $('progress'), qnum: $('qnum'), qtext: $('qtext'), answers: $('answers'), sQ: $('sQ'),
    params: $('params'), thinkPct: $('thinkPct'),
    rname: $('rname'), ralt: $('ralt'), rpct: $('rpct'), rdesc: $('rdesc'), rchips: $('rchips'), sResult: $('sResult'), autoBar: $('autoBar'),
    admin: $('admin')
  };
  const AX_RU = { sweet: 'сладость', sour: 'кислотность', fresh: 'свежесть', rich: 'насыщенность', berry: 'ягодность',
    herb: 'травяность', floral: 'цветочность', calm: 'спокойствие', energy: 'энергия', party: 'праздничность' };
  // максимум по каждой оси (для процентов на экране анализа)
  const AX_MAX = {};
  Object.assign(AX_MAX, E.AX_MAX);

  let state = 'load', run = 0, busy = false, last = Date.now(), picks = [], pending = null, adminOpen = false, qs = null, prevQs = null, ord = [];
  const timers = new Set();

  /* ---------- таймеры: всё, что запущено, гасится при сбросе ---------- */
  function after(ms, fn) {
    const r = run;
    const t = setTimeout(() => { timers.delete(t); if (r === run) fn(); }, ms);
    timers.add(t); return t;
  }
  function clearAll() { timers.forEach(clearTimeout); timers.clear(); run++; }
  function setStep(n) {   // индикатор шагов: пройдено / текущий / финал
    const p = $('vpill');
    p.querySelectorAll('.st').forEach((s, k) => { s.classList.toggle('done', k < n); s.classList.toggle('cur', k === n); });
    p.classList.toggle('end', n >= 3);
  }
  function show(id) {
    $('stage').dataset.s = id; document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
  const rand = a => a[Math.floor(Math.random() * a.length)];
  function reflow(n) { void n.offsetWidth; }

  /* ---------- Wake Lock ---------- */
  let wl = null;
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wl) {
        wl = await navigator.wakeLock.request('screen');
        wl.addEventListener('release', () => { wl = null; });
      }
    } catch (e) { wl = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { lockScreen(); fx.start(); } else fx.stop();
  });

  /* ---------- Защита от жестов, меню, зума ---------- */
  ['contextmenu', 'gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart'].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });

  /* ---------- Предзагрузка (blob-URL: мгновенный старт, без сети и без range-запросов) ---------- */
  const ASSETS = ['assets/idle.jpg', 'assets/touch.mp4', 'assets/bg.jpg'].concat(D.COCKTAILS.map(c => c.img).filter(Boolean));
  const IMG = {};   // blob-ссылки на картинки коктейлей
  async function preload() {
    let done = 0; const urls = {};
    const tick = () => { $('loadPct').textContent = Math.round(++done / ASSETS.length * 100) + '%'; };
    await Promise.all(ASSETS.map(async u => {
      try {
        const r = await fetch(u); if (!r.ok) throw 0;
        urls[u] = URL.createObjectURL(await r.blob());
      } catch (e) { urls[u] = u; }   // file:// или сбой — обычная загрузка
      tick();
    }));
    D.COCKTAILS.forEach(c => { if (c.img) IMG[c.id] = urls[c.img]; });
    el.vIdle.src = urls['assets/idle.jpg'];
    el.vTouch.src = urls['assets/touch.mp4'];
    el.bg.src = urls['assets/bg.jpg'];
    const ready = v => new Promise(res => {
      if (v.readyState >= 3) return res();
      v.addEventListener('canplay', () => res(), { once: true }); v.load(); setTimeout(res, 4000);
    });
    await Promise.all([el.vIdle.decode ? el.vIdle.decode().catch(() => {}) : 0, ready(el.vTouch), Promise.all(['400 20px Coil','700 20px Coil','500 40px "Cormorant Garamond"'].map(f => document.fonts.load(f, 'НЕЙРОБАРStrawberry')).concat(document.fonts.ready)).catch(() => {}), el.bg.decode ? el.bg.decode().catch(() => {}) : 0]);
  }

  /* ---------- Состояния ---------- */
  function goIdle() {
    clearAll();
    setStep(0);
    state = 'idle'; busy = false; picks = []; pending = null; qs = null;
    el.flash.classList.remove('on'); $('stage').classList.remove('touching');
    el.bg.classList.remove('on');
    el.vTouch.classList.remove('on'); el.vTouch.pause();
    try { el.vTouch.currentTime = 0; } catch (e) {}
    el.autoBar.classList.remove('run');
    el.vIdle.classList.add('on');
    after(400, () => { try { el.vTouch.currentTime = 0; } catch (e) {} });
    fx.mode('idle');
    show('sIdle');
  }

  function startTouch() {
    busy = true; state = 'touch';
    $('stage').classList.add('touching');
    show('');
    fx.mode('idle');
    try { el.vTouch.currentTime = 0; } catch (e) {}
    const p = el.vTouch.play(); if (p && p.catch) p.catch(() => {});
    el.vTouch.classList.add('on');
    after(260, () => { el.vIdle.classList.remove('on'); });
    let fin = false;
    const done = () => { if (fin) return; fin = true; el.vTouch.onended = null; whiteout(); };
    el.vTouch.onended = done;
    after(4600, done);                       // страховка, если видео не доиграло
  }

  function whiteout() {
    el.flash.classList.add('on');
    after(380, () => {
      el.vTouch.classList.remove('on'); el.vTouch.pause();
      el.bg.classList.add('on');
      fx.mode('nebula');
      state = 'hello';
      $('stage').classList.remove('touching');
      el.flash.classList.remove('on');       // белый свет рассеивается, проступает туманность
      after(500, () => question(0));
    });
  }

  function typeText(node, text, cb) {
    let i = 0;
    (function step() {
      node.textContent = text.slice(0, i);
      const c = document.createElement('span'); c.className = 'cur'; node.appendChild(c);
      if (i++ < text.length) after(48, step); else cb();
    })();
  }
  function hello() {
    show('sHello');
    typeText(el.helloTxt, rand(D.GREETINGS), () => after(1100, () => question(0)));
  }

  function question(i) {
    state = 'q'; busy = false; last = Date.now();
    if (!qs) { qs = E.draw(prevQs); prevQs = qs; ord = []; }
    const q = qs[i], n = qs.length;
    ord[i] = q.answers.map((_, k) => k).sort(() => Math.random() - 0.5);   // варианты каждый раз в новом порядке
    el.progress.querySelectorAll('i').forEach((b, k) => { b.className = k < i ? 'done' : k === i ? 'cur' : ''; });
    setStep(i);
    el.qnum.textContent = '0' + (i + 1) + ' / 0' + n;
    el.qtext.textContent = q.text;
    el.answers.textContent = '';
    ord[i].forEach((k, pos) => {
      const a = q.answers[k];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'answer'; b.dataset.k = k;
      const ic = document.createElement('span'); ic.className = 'n'; ic.textContent = '0' + (pos + 1);
      const tx = document.createElement('span'); tx.textContent = a.label;
      b.append(ic, tx); el.answers.appendChild(b);
    });
    el.sQ.classList.remove('qin'); reflow(el.sQ); el.sQ.classList.add('qin');
    el.sQ.dataset.q = i;
    show('sQ');
  }

  el.answers.addEventListener('click', e => {
    const b = e.target.closest('.answer');
    if (!b || busy || state !== 'q') return;         // защита от двойных нажатий и нажатий во время анимации
    busy = true; last = Date.now();
    const i = +el.sQ.dataset.q;
    picks[i] = +b.dataset.k;
    el.answers.querySelectorAll('.answer').forEach(x => x.classList.add(x === b ? 'sel' : 'dim'));
    el.progress.querySelectorAll('i')[i].className = 'done';
    after(600, () => {
      if (i < qs.length - 1) {
        el.sQ.classList.remove('qin'); el.sQ.classList.add('qout');
        after(380, () => { el.sQ.classList.remove('qout'); question(i + 1); });
      } else think();
    });
  });

  /* ---------- Подбор: локальный алгоритм + (по флагу) настоящий ИИ ---------- */
  async function askAI(p, local) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), S.AI_TIMEOUT_MS);
    try {
      const r = await fetch(S.AI_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({
          answers: p.map((a, q) => ({ question: qs[q].text, answer: qs[q].answers[a].label })),
          cocktails: D.COCKTAILS.map(c => ({ id: c.id, name: c.alt, taste: c.taste }))
        })
      });
      const j = await r.json();
      const idx = D.COCKTAILS.findIndex(c => c.id === j.id);
      if (idx < 0) throw new Error('bad id');
      return Object.assign({}, local, { index: idx, cocktail: D.COCKTAILS[idx],
        percent: Math.max(92, Math.min(99, j.percent | 0 || local.percent)), aiText: typeof j.text === 'string' ? j.text : '' });
    } catch (e) { return local; } finally { clearTimeout(t); }
  }
  function choose(p) {
    const local = E.pick(p, qs);
    return (S.USE_REAL_AI && S.AI_ENDPOINT) ? askAI(p, local) : Promise.resolve(local);
  }

  /* ---------- Анализ ---------- */
  function think() {
    state = 'think'; busy = true;
    setStep(3);
    show('sThink');
    el.params.textContent = ''; el.thinkPct.textContent = '0';
    const my = run, resP = choose(picks.slice());
    resP.then(r => { if (my === run) pending = r; });
    const ax = E.userAxes(picks, qs);
    const lines = Object.keys(ax).filter(k => ax[k] > 0).sort((a, b) => ax[b] - ax[a])
      .map(k => AX_RU[k] + ': <b>' + Math.min(100, Math.round(ax[k] / AX_MAX[k] * 100)) + '%</b>');
    const feed = [];
    const mix = D.THINK_LINES.slice().sort(() => Math.random() - 0.5);
    lines.forEach((l, i) => { feed.push(mix[i % mix.length]); feed.push(l); });
    while (feed.length < 8) feed.push(mix[feed.length % mix.length]);
    let li = 0; const total = S.THINK_MS, t0 = performance.now();
    (function addLine() {
      const d = document.createElement('div'); d.innerHTML = '› ' + feed[li++ % feed.length];   // тексты из своих данных
      el.params.appendChild(d);
      while (el.params.children.length > 5) el.params.removeChild(el.params.firstChild);
      after(300, addLine);
    })();
    (function tickPct() {
      const k = Math.min(1, (performance.now() - t0) / total);
      el.thinkPct.textContent = Math.round(100 * (1 - Math.pow(1 - k, 2.2)));
      if (k < 1) after(40, tickPct);
      else (function waitRes() { if (pending) result(pending); else after(100, waitRes); })();   // ИИ-запрос ограничен таймаутом
    })();
  }

  /* ---------- Результат ---------- */
  function result(r) {
    state = 'result'; busy = false;
    const c = r.cocktail;
    bump(c.id);
    el.sResult.style.setProperty('--rc', c.color);
    if (document.body.classList.contains('still')) $('sResult').style.setProperty('--p', r.percent / 100);
    el.rname.textContent = c.name;
    $('rimg').src = IMG[c.id] || c.img || '';
    $('rimg').style.width = (c.imgW || 56) + '%';
    el.ralt.textContent = c.alt;
    el.rdesc.textContent = r.aiText || rand(c.desc);
    el.rchips.textContent = '';
    c.ingredients.forEach(t => addChip(t, ''));
    $('rtaste').textContent = c.taste.join(' · ');
    el.rpct.textContent = '0'; $('ringFill').style.strokeDashoffset = 339.3;
    show('sResult'); fx.mode('sparks');
    const t0 = performance.now();
    (function cnt() {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      const v = r.percent * (1 - Math.pow(1 - k, 3));
      el.rpct.textContent = Math.round(v);
      $('ringFill').style.strokeDashoffset = 339.3 * (1 - v / 100);
      if (k < 1) after(35, cnt);
    })();
    el.autoBar.classList.remove('run'); reflow(el.autoBar);
    el.autoBar.style.setProperty('--dur', S.RESULT_RESET_MS + 'ms');
    el.autoBar.classList.add('run');
    after(S.RESULT_RESET_MS, goIdle);
  }
  function addChip(t, cls) { const s = document.createElement('span'); s.textContent = t; if (cls) s.className = cls; el.rchips.appendChild(s); }
  $('againBtn').addEventListener('click', () => { if (state === 'result') goIdle(); });

  /* ---------- Счётчики и панель бармена ---------- */
  const KEY = 'neurobar_counts_v1';
  function counts() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function bump(id) { const c = counts(); c[id] = (c[id] || 0) + 1; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  function renderStats() {
    const c = counts(), t = $('stats'); t.textContent = '';
    let sum = 0;
    D.COCKTAILS.forEach(k => {
      const n = c[k.id] || 0; sum += n;
      const tr = t.insertRow(); tr.insertCell().textContent = k.name + ' (' + k.alt + ')'; tr.insertCell().textContent = n;
    });
    const tr = t.insertRow(); tr.className = 'total'; tr.insertCell().textContent = 'Всего'; tr.insertCell().textContent = sum;
  }
  let taps = [];
  $('adminZone').addEventListener('pointerdown', () => {
    const now = Date.now(); taps = taps.filter(x => now - x < 3000); taps.push(now);
    if (taps.length >= S.ADMIN_TAPS) { taps = []; openAdmin(); }
  });
  function openAdmin() {
    adminOpen = true; renderStats();
    const pin = !!S.ADMIN_PIN;
    $('adminPin').hidden = !pin; $('adminBody').style.display = pin ? 'none' : '';
    $('pinInput').value = '';
    el.admin.classList.add('on'); el.admin.setAttribute('aria-hidden', 'false');
  }
  function closeAdmin() { adminOpen = false; last = Date.now(); el.admin.classList.remove('on'); el.admin.setAttribute('aria-hidden', 'true'); }
  $('pinOk').addEventListener('click', () => {
    if ($('pinInput').value === S.ADMIN_PIN) { $('adminPin').hidden = true; $('adminBody').style.display = ''; } else $('pinInput').value = '';
  });
  $('admClose').addEventListener('click', closeAdmin);
  $('admRestart').addEventListener('click', () => location.reload());
  let rt = 0;
  $('admReset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!rt) { b.textContent = 'Точно обнулить?'; rt = setTimeout(() => { rt = 0; b.textContent = 'Обнулить счётчик'; }, 3000); return; }
    clearTimeout(rt); rt = 0; b.textContent = 'Обнулить счётчик';
    try { localStorage.removeItem(KEY); } catch (e2) {} renderStats();
  });

  /* ---------- Ввод ---------- */
  document.addEventListener('pointerdown', e => {
    last = Date.now(); lockScreen();
    if (adminOpen || e.target.id === 'adminZone') return;
    if (state === 'idle' && !busy) startTouch();
  });
  setInterval(() => {            // сторож бездействия
    if (adminOpen) return;
    if (state === 'q' && Date.now() - last > S.IDLE_RESET_MS) goIdle();
  }, 1000);

  /* ---------- Частицы: звёзды, снег, искры (один canvas, фиксированные массивы — без утечек) ---------- */
  const fx = (function () {
    const cv = el.fx, ctx = cv.getContext('2d');
    let W = 0, H = 0, raf = 0, prev = 0, curMode = 'idle', k = { star: 0.5, snow: 0.6, spark: 0 }, tgt = { star: 0.5, snow: 0.6, spark: 0 };
    function sprite(c) {
      const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.25, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
    }
    const SP = { w: sprite('rgba(220,200,255,.9)'), g: sprite('rgba(255,200,90,.9)'), p: sprite('rgba(255,90,170,.9)') };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(2, 6), ph: rnd(0, 6.3), sp: rnd(.6, 2), v: rnd(.002, .01) }));
    const snow = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(2, 5), vy: rnd(.02, .07), ph: rnd(0, 6.3), dx: rnd(.01, .03) }));
    const sparks = Array.from({ length: 50 }, () => ({ x: Math.random(), y: 1 + Math.random(), r: rnd(3, 8), vy: rnd(.05, .16), ph: rnd(0, 6.3), s: Math.random() < .5 ? 'g' : 'p' }));
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
    }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (t - prev < 32) return;                       // ~30 fps — бережём планшет
      const dt = Math.min(0.1, (t - prev) / 1000); prev = t;
      for (const n in k) k[n] += (tgt[n] - k[n]) * Math.min(1, dt * 2);
      ctx.clearRect(0, 0, W, H);
      const u = W / 1920, ts = t / 1000;
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        s.y -= s.v * dt * 0.3; if (s.y < -.02) s.y = 1.02;
        ctx.globalAlpha = k.star * (0.35 + 0.65 * Math.abs(Math.sin(ts * s.sp + s.ph)));
        const r = s.r * u * 1.6; ctx.drawImage(SP.w, s.x * W - r, s.y * H - r, r * 2, r * 2);
      }
      for (const s of snow) {
        s.y += s.vy * dt; s.x += Math.sin(ts * .8 + s.ph) * s.dx * dt;
        if (s.y > 1.02) { s.y = -.02; s.x = Math.random(); }
        ctx.globalAlpha = k.snow * .55; const r = s.r * u * .9; ctx.drawImage(SP.w, s.x * W - r, s.y * H - r, r * 2, r * 2);
      }
      if (k.spark > 0.02) for (const s of sparks) {
        s.y -= s.vy * dt; s.x += Math.sin(ts * 1.3 + s.ph) * .02 * dt;
        if (s.y < -.05) { s.y = 1.05; s.x = Math.random(); }
        ctx.globalAlpha = k.spark * (0.4 + 0.6 * Math.abs(Math.sin(ts * 3 + s.ph)));
        const r = s.r * u * 1.4; ctx.drawImage(SP[s.s], s.x * W - r, s.y * H - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    window.addEventListener('resize', size); size();
    return {
      start() { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      mode(m) {
        curMode = m;
        tgt = m === 'sparks' ? { star: 1, snow: 1, spark: 1 } : m === 'nebula' ? { star: 1, snow: .8, spark: 0 } : { star: .45, snow: .6, spark: 0 };
      }
    };
  })();

  /* ---------- Старт ---------- */
  fx.start();
  preload().catch(() => {}).then(() => {
    goIdle();
    // ?shot=q|result — статичный показ экрана (для макетов/скриншотов); в обычной работе не используется
    const m = /[?&]shot=(\w+)/.exec(location.search);
    if (m) {
      document.body.classList.add('still');   // без анимаций: стабильный кадр
      if (m[1] !== 'idle') { clearAll(); el.vIdle.classList.remove('on'); el.bg.classList.add('on'); fx.mode('nebula'); }
      if (m[1] === 'q') { const qi = /[?&]q=(\d+)/.exec(location.search); if (qi) { qs = [D.QUESTIONS[+qi[1]]]; qs.length = 3; qs[1] = qs[2] = qs[0]; } question(0); const sl = /[?&]sel=(\d)/.exec(location.search); const st = /[?&]step=(\d)/.exec(location.search); if (st) setStep(+st[1]); if (sl) el.answers.querySelectorAll('.answer').forEach((b, k) => b.classList.add(k === +sl[1] ? 'sel' : 'dim')); }
      if (m[1] === 'think') { S.THINK_MS = 60000; qs = E.draw(null); picks = [1, 1, 2]; think(); }
      if (m[1] === 'result') { qs = E.draw(null); const rr = E.pick([+(/[?&]a=(\d)/.exec(location.search) || [0, 0])[1], 0, 0], qs); const ci = /[?&]c=(\d)/.exec(location.search); if (ci) { rr.cocktail = D.COCKTAILS[+ci[1]]; } result(rr); }
    }
  });
  lockScreen();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // защитный перезапуск раз в сутки не нужен; утечек нет: все таймеры сбрасываются в goIdle()
  window.__nb = { goIdle, state: () => state };   // для отладки
})();
