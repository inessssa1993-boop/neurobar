/* Локальный алгоритм подбора по баллам. Без интернета и ключей. */
(function (root) {
  function create(data) {
    const { AXES, COCKTAILS, QUESTIONS, CATEGORIES } = data;

    function contribution(ans, c) {
      let s = (ans.direct && ans.direct[c.id]) || 0;
      for (const ax in (ans.axes || {})) s += (c.profile[ax] || 0) * ans.axes[ax];
      return s;
    }
    const inCat = cat => QUESTIONS.filter(q => q.cat === cat);
    // максимум коктейля = сумма по категориям лучших возможных ответов (для расчёта %)
    const MAX = COCKTAILS.map(c => CATEGORIES.reduce((sum, cat) =>
      sum + Math.max(...inCat(cat).map(q => Math.max(...q.answers.map(a => contribution(a, c))))), 0));
    const AX_MAX = {};
    AXES.forEach(a => { AX_MAX[a] = CATEGORIES.reduce((s, cat) => s + Math.max(0, ...inCat(cat)
      .map(q => Math.max(0, ...q.answers.map(x => (x.axes && x.axes[a]) || 0)))), 0) || 1; });

    // случайный набор вопросов для гостя: по одному из каждой категории, не повторяя прошлый
    function draw(prev, rnd) {
      rnd = rnd || Math.random;
      return CATEGORIES.map((cat, i) => {
        const pool = inCat(cat);
        const fresh = pool.filter(q => !prev || prev[i] !== q);
        const list = fresh.length ? fresh : pool;
        return list[Math.floor(rnd() * list.length)];
      });
    }
    function userAxes(picks, qs) {
      const u = {}; AXES.forEach(a => (u[a] = 0));
      picks.forEach((ai, qi) => { const a = qs[qi].answers[ai]; for (const k in a.axes) u[k] += a.axes[k]; });
      return u;
    }
    // picks[i] — индекс выбранного ответа в qs[i].answers. rnd — генератор 0..1 (для тестов).
    function pick(picks, qs, rnd) {
      rnd = rnd || Math.random;
      const scores = COCKTAILS.map(c => picks.reduce((s, ai, qi) => s + contribution(qs[qi].answers[ai], c), 0));
      const jit = scores.map(s => s + rnd() * 0.05);   // равенство баллов -> случайно
      let best = 0; jit.forEach((v, i) => { if (v > jit[best]) best = i; });
      const ratio = Math.max(0, Math.min(1, scores[best] / MAX[best]));
      let pct = 92 + Math.round(7 * Math.pow(ratio, 1.4) + (rnd() * 2 - 1));
      pct = Math.max(92, Math.min(99, pct));
      return { index: best, cocktail: COCKTAILS[best], percent: pct, scores, axes: userAxes(picks, qs) };
    }
    return { pick, draw, MAX, AX_MAX, userAxes };
  }
  const api = { create };
  root.NBEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
