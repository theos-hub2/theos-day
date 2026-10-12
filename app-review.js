// theo's day — app-review.js
// Part of the app. Loaded by index.html in order; every function is global.
//
// ── MONTH IN REVIEW ──
// A reward that arrives on the 1st, not a dashboard. Each finished month gets
// one review, and the first time you open it the numbers are frozen into
// theosReviews — so later edits, new routines or new schedules can never
// rewrite how a month went. It's frozen on first open rather than at midnight,
// so ticking off last night's tasks on the morning of the 1st still counts.
//
// The Month tab only gains two things: a one-line "so far" for the current
// month, and a card while last month's review is unread. Going back a month
// shows a "Read <month>'s review" row instead — that row is the library.
//
// Rules carried over from the rest of the app:
//  · Only true things. Highlights are records against your own earlier months,
//    and a month that broke none simply has no highlights.
//  · No month-vs-last-month arrows. The year chart is the only comparison, and
//    you have to hold it to see the figures.
//  · Habits are the heart of it. Each is judged as the day bar judges it: fixed
//    habits on the days they were due, flexible ones against their weekly
//    target, trip-paused days left out. Hobby sections then show only depth
//    (bests, books, hours, dishes) — the "how often" lives in the habit list.
//  · Biggest day = the most done, not the highest %, so an empty Sunday at
//    100% never beats a full day.
//  · Trips and asterisk days are context, listed under the calendar; neither
//    changes a number beyond what the day bar already does.
//  · Reviews frozen before habits (v1) keep their own shape and still render.

const REVIEW_KEY = 'theosReviews';
const REVIEW_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function loadReviews(){
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}'); }
  catch { return {}; }
}
function saveReviews(r){
  localStorage.setItem(REVIEW_KEY, JSON.stringify(r));
  if (typeof queueSync === 'function') queueSync();
}

// ── DATE HELPERS ──

function monthKeyOf(y, m0){ return y + '-' + String(m0 + 1).padStart(2, '0'); }
function parseMonthKey(k){ const [y, m] = k.split('-').map(Number); return { y, m0: m - 1 }; }
function daysInMonthKey(k){ const { y, m0 } = parseMonthKey(k); return new Date(y, m0 + 1, 0).getDate(); }
function currentMonthKey(){ const n = new Date(); return monthKeyOf(n.getFullYear(), n.getMonth()); }
function prevMonthKey(k){ const { y, m0 } = parseMonthKey(k); const d = new Date(y, m0 - 1, 1); return monthKeyOf(d.getFullYear(), d.getMonth()); }
function nextMonthKey(k){ const { y, m0 } = parseMonthKey(k); const d = new Date(y, m0 + 1, 1); return monthKeyOf(d.getFullYear(), d.getMonth()); }
function inMonth(dateKey, k){ return typeof dateKey === 'string' && dateKey.slice(0, 7) === k; }
function reviewShortDate(dateKey){
  const d = new Date(dateKey + 'T00:00:00');
  return REVIEW_MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
}
function rvPct(n){ return Math.round(n * 100); }
function rv1(n){ return Math.round(n * 10) / 10; }

// ── WHICH MONTHS HAVE A REVIEW ──

// a finished month with at least one task or habit in it
function monthHasData(k){
  const data = loadData();
  return Object.keys(data).some(d => inMonth(d, k) && dayCounts(d, data).total);
}
function isReviewable(k){ return k < currentMonthKey() && monthHasData(k); }

// every month that has tasks, oldest first
function dataMonths(){
  const data = loadData(), set = new Set();
  Object.keys(data).forEach(d => { if (dayCounts(d, data).total) set.add(d.slice(0, 7)); });
  return [...set].sort();
}

// ── DAYS ──

function monthDays(k, uptoDay){
  const data = loadData(), n = uptoDay || daysInMonthKey(k), out = [];
  for (let d = 1; d <= n; d++){
    const key = k + '-' + String(d).padStart(2, '0');
    const day = data[key];
    const c = dayCounts(key, data);     // tasks plus habits due that day
    out.push({ key, d, total: c.total, done: c.done,
               asterisk: day && day.asterisk ? (day.asterisk.reason || 'other') : null });
  }
  return out;
}
function withTasks(days){ return days.filter(d => d.total > 0); }
function avgCompletionOf(days){
  const t = withTasks(days);
  return t.length ? t.reduce((s, d) => s + d.done / d.total, 0) / t.length : 0;
}
function fullDaysOf(days){ return withTasks(days).filter(d => d.done === d.total).length; }
function tasksPerDayOf(days){
  const t = withTasks(days);
  return t.length ? t.reduce((s, d) => s + d.total, 0) / t.length : 0;
}
// "3 asterisk days (2 travel, 1 sick)" — context, not an excuse
function asteriskCount(days){
  const by = {};
  days.forEach(d => { if (d.asterisk) by[d.asterisk] = (by[d.asterisk] || 0) + 1; });
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return { total, by };
}
function asteriskText(a){
  if (!a || !a.total) return '';
  const label = r => (typeof asteriskLabel === 'function' ? asteriskLabel({ reason: r }) : r).toLowerCase();
  const parts = Object.entries(a.by).sort((x, y) => y[1] - x[1]).map(([r, n]) => n + ' ' + label(r));
  return `✱ ${a.total} asterisk day${a.total === 1 ? '' : 's'}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
}

function longest100Run(days){
  let best = { len: 0 }, cur = 0, from = null;
  days.forEach(d => {
    if (d.total && d.done === d.total){ if (!cur) from = d.key; cur++; if (cur > best.len) best = { len: cur, from, to: d.key }; }
    else cur = 0;
  });
  return best;
}

// days a named task or habit was ticked, as a Set of date keys within the month
function taskDays(k, name){
  const data = loadData(), out = new Set();
  const habit = habitNamed(name);
  Object.keys(data).forEach(d => {
    if (!inMonth(d, k)) return;
    if (habit && dayHabitIds(data[d]).includes(habit.id)) { out.add(d); return; }
    if (data[d].tasks && data[d].tasks.some(t => t.done && normalizeTaskName(t.text) === name)) out.add(d);
  });
  return out;
}

// how many times a habit was meant to happen this month, from its streak rule
function plannedFor(name, k){
  const habit = habitNamed(name);
  const sch = (habit && habit.sch) || loadSchedules()[name] || { type: 'daily' };
  const dim = daysInMonthKey(k);
  if (sch.type === 'none') return null;
  if (sch.type === 'daily') return dim;
  if (sch.type === 'days') {
    let n = 0;
    for (let d = 1; d <= dim; d++) if ((sch.days || []).includes(new Date(k + '-' + String(d).padStart(2, '0') + 'T00:00:00').getDay())) n++;
    return n;
  }
  if (sch.type === 'biweekly') return Math.max(1, Math.round(dim / 14));
  return Math.max(1, Math.round((sch.times || 1) * dim / 7));
}

// ── HOBBY FIGURES ──

function gymFigures(k){
  if (typeof loadGymLog !== 'function') return null;
  const log = loadGymLog();
  const start = k + '-01';
  const loggedIn = Object.keys(log).some(d => inMonth(d, k) &&
    Object.values(log[d].exercises || {}).some(sets => (sets || []).some(hasRep)));
  if (!loggedIn) return null;

  // new bests: the month's top set beat everything logged before it
  const keys = new Set();
  Object.values(log).forEach(s => Object.keys(s.exercises || {}).forEach(x => keys.add(x)));
  const prs = [];
  keys.forEach(key => {
    const hist = exerciseHistory(key);
    const before = hist.filter(p => p.date < start), during = hist.filter(p => inMonth(p.date, k));
    if (!before.length || !during.length) return;
    const timed = modeForKey(key) === 'time';
    const val = p => timed ? p.longest : p.top;
    const was = Math.max(...before.map(val)), now = Math.max(...during.map(val));
    if (now > was && now > 0) prs.push(pretty(unslug(key)) + ' ' + (timed ? fmtDur(now) : fmtNum(now) + ' kg'));
  });

  // morning weight, first and last of the month
  let bw = null;
  if (typeof loadWeights === 'function'){
    const w = loadWeights();
    const mornings = Object.keys(w).filter(d => inMonth(d, k) && w[d].morning != null).sort();
    if (mornings.length >= 2) bw = [fmtNum(w[mornings[0]].morning), fmtNum(w[mornings[mornings.length - 1]].morning)];
  }
  return { prs, bw };
}

function readingFigures(k){
  if (typeof loadBooks !== 'function') return null;
  const finished = loadBooks().filter(b => b.status === 'finished' && inMonth(b.finished, k))
    .map(b => ({ title: b.title || '', author: b.author || '', pages: Number(b.pages) || 0, color: bookColor(b.id) }));
  const quotes = (typeof loadQuotes === 'function' ? loadQuotes() : []).filter(q => inMonth(q.date, k)).length;
  if (!finished.length && !quotes) return null;
  return { books: finished, pages: finished.reduce((s, b) => s + b.pages, 0), quotes };
}

function drawingFigures(k){
  if (typeof loadSketches !== 'function') return null;
  const sessions = loadSketches().filter(s => inMonth(s.date, k));
  if (!sessions.length) return null;
  const mins = sessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
  // a session either holds sketch objects (with tags) or just a sketch count
  let sketches = 0;
  const tags = {};
  const addTags = list => (list || []).forEach(t => { const n = String(t).trim(); if (n) tags[n] = (tags[n] || 0) + 1; });
  sessions.forEach(s => {
    if (Array.isArray(s.sketches)){ sketches += s.sketches.length; s.sketches.forEach(sk => addTags(sk && sk.tags)); }
    else sketches += Number(s.sketches) || 0;
    addTags(s.tags);
  });
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { hours: rv1(mins / 60), sketches, tags: top };
}

function cookingFigures(k){
  if (typeof loadDishes !== 'function') return null;
  const dishes = loadDishes();
  let cooks = 0, fresh = 0, best = null;
  dishes.forEach(d => {
    const all = (d.attempts || []).filter(a => a.date).sort((a, b) => a.date < b.date ? -1 : 1);
    const here = all.filter(a => inMonth(a.date, k));
    if (!here.length) return;
    cooks += here.length;
    if (all[0] && inMonth(all[0].date, k)) fresh++;          // first time ever cooked
    here.forEach(a => { if (a.stars && (!best || a.stars > best.stars)) best = { name: d.name || '', stars: a.stars }; });
  });
  if (!cooks) return null;
  return { cooks, fresh, best };
}

// ── HABITS ──
// Judged exactly as the day bar judges them: fixed habits on the days they
// were due (a trip-paused day isn't expected, but a tick on it still counts);
// flexible habits against their weekly target, with paused days taken out.

function habitLive(h, k){
  const start = k + '-01', end = k + '-' + String(daysInMonthKey(k)).padStart(2, '0');
  return (h.since || '0000') <= end && (!h.ended || h.ended > start);
}

// longest run of due days ticked; trips never protect a run, as in streaks
function habitRuns(h, data, uptoKey){
  const keys = Object.keys(data).filter(x => x <= uptoKey).sort();
  if (!keys.length) return [];
  const runs = [];
  let cur = 0, from = null, prev = null;
  const d = new Date(keys[0] + 'T00:00:00'), stop = new Date(uptoKey + 'T00:00:00');
  for (; d <= stop; d.setDate(d.getDate() + 1)){
    const key = ymd(d);
    if (!habitInRange(h, key) || !habitDue(h, key)) continue;
    if (habitDoneOn(h, key, data)){ if (!cur) from = key; cur++; prev = key; }
    else { if (cur) runs.push({ len: cur, from, to: prev }); cur = 0; }
  }
  if (cur) runs.push({ len: cur, from, to: prev });
  return runs;
}

function habitFigures(k, data){
  const dim = daysInMonthKey(k), out = [];
  allHabits().forEach(h => {
    if (!habitLive(h, k)) return;
    const sch = habitSch(h);
    let done = 0, expected = 0, open = 0;
    for (let d = 1; d <= dim; d++){
      const key = k + '-' + String(d).padStart(2, '0');
      if (!habitInRange(h, key)) continue;
      const ticked = habitDoneOn(h, key, data);
      if (isFlexible(sch)){ if (ticked) done++; if (!habitPaused(h, key)) open++; continue; }
      const exp = habitExpected(h, key);
      if (exp || ticked){ expected++; if (ticked) done++; }
    }
    let target = expected, weeks = null;
    if (isFlexible(sch)){
      target = sch.type === 'biweekly' ? Math.max(1, Math.round(open / 14))
                                       : Math.max(1, Math.round((sch.times || 1) * open / 7));
      if (sch.type === 'weekly'){
        // Sunday-start weeks that begin in this month and finished inside it
        let hit = 0, all = 0;
        for (let d = 1; d + 6 <= dim; d++){
          const key = k + '-' + String(d).padStart(2, '0');
          if (new Date(key + 'T00:00:00').getDay() !== 0) continue;
          all++;
          let n = 0;
          for (let i = 0; i < 7; i++) if (habitDoneOn(h, addDaysKey(key, i), data)) n++;
          if (n >= (sch.times || 1)) hit++;
        }
        if (all) weeks = [hit, all];
      }
    }
    if (!target && !done) return;
    const end = k + '-' + String(dim).padStart(2, '0');
    let run = 0, record = false;
    if (!isFlexible(sch)){
      const runs = habitRuns(h, data, end);
      const inside = runs.filter(r => r.to >= k + '-01');
      run = inside.length ? Math.max(...inside.map(r => r.len)) : 0;
      const before = runs.filter(r => r.to < k + '-01');
      record = run >= 3 && before.length > 0 && run > Math.max(...before.map(r => r.len));
    }
    out.push({ name: h.name, avoid: h.kind === 'avoid', done, target,
               weeks, run, record, flexible: isFlexible(sch) });
  });
  return out;
}
function habitRate(list){
  const t = list.reduce((s, x) => s + x.target, 0);
  return t ? rvPct(list.reduce((s, x) => s + Math.min(x.done, x.target), 0) / t) : null;
}

function aimsFor(k){
  try {
    return JSON.parse(localStorage.getItem('theosGoals-month-' + k) || '[]').map(g => ({
      title: g.title || '', done: !!g.done,
      count: g.type === 'recurring' ? (g.current || 0) + '/' + (g.target || 0) : ''
    }));
  } catch { return []; }
}

function tripsIn(k){
  if (typeof tripsCached !== 'function') return [];
  const start = k + '-01', end = k + '-' + String(daysInMonthKey(k)).padStart(2, '0');
  return tripsCached().filter(t => t.start <= end && tripLastDay(t) >= start).map(t => ({
    place: t.place || 'Trip', start: t.start < start ? start : t.start,
    end: tripLastDay(t) > end ? end : tripLastDay(t), paused: (t.paused || []).length,
    color: tripColor(t)
  }));
}

// the day with the most done; a tie goes to the fuller day, then the earlier
function biggestDay(days){
  let best = null;
  days.forEach(d => {
    if (!d.done) return;
    if (!best || d.done > best.done || (d.done === best.done && d.done / d.total > best.done / best.total)) best = d;
  });
  return best ? { key: best.key, done: best.done, total: best.total } : null;
}

// ── BUILDING A REVIEW ──

// the headline numbers for any month: from its frozen review if there is one
function monthTotals(k){
  const saved = loadReviews()[k];
  if (saved && saved.totals && saved.totals.habits !== undefined) return saved.totals;
  const days = monthDays(k), d = drawingFigures(k);
  const live = { comp: rvPct(avgCompletionOf(days)), full: fullDaysOf(days),
                 habits: habitRate(habitFigures(k, loadData())), drawHours: d ? d.hours : 0 };
  // an older review keeps its own completion figures; only the gaps are filled
  return saved && saved.totals ? Object.assign(live, { comp: saved.totals.comp, full: saved.totals.full }) : live;
}

function buildReview(k){
  const data = loadData();
  const days = monthDays(k);
  const habits = habitFigures(k, data);
  const drawing = drawingFigures(k), gym = gymFigures(k), reading = readingFigures(k), cooking = cookingFigures(k);
  let tasksDone = 0, tasksAll = 0;
  days.forEach(d => { const c = dayCounts(d.key, data); tasksAll += c.tasks.length; tasksDone += c.tasks.filter(t => t.done).length; });
  const totals = { comp: rvPct(avgCompletionOf(days)), full: fullDaysOf(days),
                   habits: habitRate(habits), drawHours: drawing ? drawing.hours : 0 };

  // records, judged only against earlier months that have data
  const earlier = dataMonths().filter(x => x < k).map(monthTotals);
  const records = [];
  if (earlier.length){
    const beats = (v, f) => v != null && v > 0 && earlier.every(e => f(e) == null || v > f(e));
    if (beats(totals.comp, e => e.comp)) records.push({ head: `Your best month so far: ${totals.comp}%.`, line: `Best month so far at <b>${totals.comp}%</b>` });
    if (beats(totals.habits, e => e.habits)) records.push({ head: `Your best month for habits: ${totals.habits}%.`, line: `Best habits month yet: <b>${totals.habits}%</b>` });
    if (beats(totals.full, e => e.full)) records.push({ head: `Your most 100% days yet: ${totals.full}.`, line: `Most 100% days yet: <b>${totals.full}</b>` });
    if (drawing && beats(totals.drawHours, e => e.drawHours || 0)) records.push({ head: `Your most drawing yet: ${totals.drawHours} hours.`, line: `Most drawing yet: <b>${totals.drawHours} hours</b>` });
  }
  habits.filter(h => h.record).forEach(h => records.push({
    head: `Your longest ${h.name} streak yet: ${h.run} days.`, line: `Longest <b>${escHtml(h.name)}</b> streak yet: <b>${h.run} days</b>` }));
  const extras = [];
  const run = longest100Run(days);
  if (run.len >= 2) extras.push(`<b>${run.len} days</b> in a row at 100%, ${reviewShortDate(run.from)}–${Number(run.to.slice(8))}`);
  if (gym && gym.prs.length) extras.push(`New gym bests: <b>${gym.prs.map(escHtml).join(', ')}</b>`);

  // the year so far, frozen alongside the month
  const { y } = parseMonthKey(k);
  const year = [];
  for (let m0 = 0; m0 < 12; m0++){
    const mk = monthKeyOf(y, m0);
    year.push(mk === k ? totals.comp : (mk < k && monthHasData(mk) ? monthTotals(mk).comp : null));
  }
  const yearDays = [], yearHabits = [];
  for (let m0 = 0; m0 < 12; m0++){
    const mk = monthKeyOf(y, m0);
    if (mk > k || !monthHasData(mk)) continue;
    yearDays.push(...monthDays(mk));
    yearHabits.push(...(mk === k ? habits : habitFigures(mk, data)));
  }
  const firstMonth = dataMonths().find(x => x.startsWith(y + '-'));
  const partialYear = !!firstMonth && firstMonth > y + '-01';

  return {
    v: 2, frozenOn: getTodayKey(), totals,
    headline: records.length ? records[0].head : `${totals.comp}% done across ${withTasks(days).length} days.`,
    highlights: records.slice(1).map(r => r.line).concat(extras),
    hadRecord: records.length > 0,
    days: days.map(d => ({ d: d.d, total: d.total, done: d.done, asterisk: d.asterisk })),
    biggest: biggestDay(days),
    asterisks: asteriskCount(days),
    trips: tripsIn(k),
    habits, tasks: { done: tasksDone, all: tasksAll },
    gym, reading, drawing, cooking, aims: aimsFor(k),
    year: { values: year, partial: partialYear, comp: rvPct(avgCompletionOf(yearDays)),
            habits: habitRate(yearHabits), full: fullDaysOf(yearDays),
            asterisks: asteriskCount(yearDays).total }
  };
}

// ── MONTH TAB ──
// Called at the end of renderCalendar.

function renderReviewSlot(){
  const slot = document.getElementById('reviewSlot');
  if (!slot) return;
  const k = monthKeyOf(calYear, calMonth), now = currentMonthKey();
  const { m0 } = parseMonthKey(k);
  const name = REVIEW_MONTHS[m0];
  let h = '';

  if (k === now){
    const last = prevMonthKey(k);
    if (isReviewable(last) && !loadReviews()[last]){
      h += `<div class="rv-ready">
              <div class="rv-ready-text">
                <div class="rv-ready-title">${REVIEW_MONTHS[parseMonthKey(last).m0]} in review</div>
                <div class="rv-ready-sub">Ready to read</div>
              </div>
              <button class="btn btn-add" onclick="openReview('${last}')">Open</button>
            </div>`;
    }
    // so far = finished days only; today is still in progress
    const today = new Date().getDate();
    const before = today > 1 ? withTasks(monthDays(k, today - 1)) : [];
    const val = today === 1 ? 'starts today'
      : before.length ? `<b style="color:${getProgressColor(rvPct(avgCompletionOf(before)))}">${rvPct(avgCompletionOf(before))}%</b> · ${fullDaysOf(before)} 100% day${fullDaysOf(before) === 1 ? '' : 's'}`
      : 'nothing logged yet';
    h += `<div class="rv-sofar"><span class="rv-sofar-label">${name} so far</span><span class="rv-sofar-val">${val}</span></div>`;
  } else if (isReviewable(k)){
    h += `<button class="rv-read-row" onclick="openReview('${k}')">
            <span class="rv-read-t">Read ${name}'s review</span><span class="rv-read-c">&rsaquo;</span>
          </button>`;
  }
  slot.innerHTML = h;
}

// ── THE REVIEW SHEET ──

function rvPlan(txt, done, planned){
  if (!planned) return `<div class="rv-plan-head"><span class="rv-plan-txt">${txt}</span></div>`;
  const p = Math.min(100, rvPct(done / planned)), c = getProgressColor(p);
  return `<div class="rv-plan-head"><span class="rv-plan-txt">${txt}</span><span class="rv-plan-pct" style="color:${c}">${p}%</span></div>
          <div class="rv-track"><div class="rv-fill" data-w="${p}" style="width:${p}%;background:${c}"></div></div>`;
}
function rvRow(label, value){ return `<div class="rv-row"><span>${label}</span><span>${value}</span></div>`; }

function openReview(k){
  if (!isReviewable(k)) return;
  const all = loadReviews();
  const firstOpen = !all[k];
  if (firstOpen){ all[k] = buildReview(k); saveReviews(all); }
  const R = all[k];
  const v2 = (R.v || 1) >= 2;          // v1 reviews (frozen before habits) keep their own shape
  const { y, m0 } = parseMonthKey(k);
  const name = REVIEW_MONTHS[m0];
  const isLatest = k === prevMonthKey(currentMonthKey());
  const bigD = R.biggest ? Number(R.biggest.key.slice(8)) : null;

  // the month itself, shaded by completion with the % written in
  let heat = ['Su','Mo','Tu','We','Th','Fr','Sa'].map(x => `<div class="rv-dn">${x}</div>`).join('');
  for (let i = 0; i < new Date(y, m0, 1).getDay(); i++) heat += '<div class="rv-c rv-empty"></div>';
  R.days.forEach(d => {
    if (!d.total){ heat += `<div class="rv-c rv-none"><span class="rv-dnum">${d.d}</span></div>`; return; }
    const f = d.done / d.total, a = 0.08 + f * 0.92, light = a <= 0.5;
    heat += `<div class="rv-c${d.d === bigD ? ' rv-big' : ''}" style="background:rgba(26,77,46,${a.toFixed(2)});color:${light ? '#1a4d2e' : '#fafaf8'}">
               <span class="rv-dnum">${d.d}${d.asterisk ? ' ✱' : ''}</span><span class="rv-dpct">${rvPct(f)}%</span></div>`;
  });

  const keyLines = ['Lighter means less done'];
  if (R.biggest) keyLines.push(`<b>Biggest day:</b> ${reviewShortDate(R.biggest.key)} · ${R.biggest.done} of ${R.biggest.total} done`);
  (R.trips || []).forEach(t => keyLines.push(`<span class="trip-swatch trip-bg-${t.color}"></span>${escHtml(t.place)}, ${reviewShortDate(t.start)}–${
    t.end.slice(0, 7) === t.start.slice(0, 7) ? Number(t.end.slice(8)) : reviewShortDate(t.end)}${t.paused ? ` · ${t.paused} habit${t.paused === 1 ? '' : 's'} paused` : ''}`));
  const astLine = asteriskText(R.asterisks);
  if (astLine) keyLines.push(astLine);

  const T = R.totals, g = R.gym, r = R.reading, dr = R.drawing, ck = R.cooking;
  let h = `<div class="rv-in">
    <div class="rv-top"><span class="rv-kicker">Month in review</span>
      <button class="rv-close" onclick="closeReview()" aria-label="Close">×</button></div>

    <div class="rv-hero">
      <div class="rv-month">${name}</div>
      <div class="rv-year">${y}</div>
      <div class="rv-headline">${R.headline}</div>
      <div class="rv-heat">${heat}</div>
      ${keyLines.map(l => `<div class="rv-key">${l}</div>`).join('')}
    </div>`;

  if (R.highlights.length){
    h += `<div class="rv-sec"><div class="section-label">Highlights</div>
            ${R.highlights.map(l => `<div class="rv-hl"><span class="rv-hl-mark">✦</span><span>${l}</span></div>`).join('')}
          </div>`;
  }

  const stat = (n, label, attrs) => `<div class="rv-stat"><div class="rv-stat-n" ${attrs}>${n}</div><div class="rv-stat-l">${label}</div></div>`;
  h += `<div class="rv-stats">
          ${stat(T.comp + '%', 'completion', `data-count="${T.comp}" data-suffix="%" style="color:${getProgressColor(T.comp)}"`)}
          ${v2 && T.habits != null
            ? stat(T.habits + '%', 'habits', `data-count="${T.habits}" data-suffix="%" style="color:${getProgressColor(T.habits)}"`)
            : stat(T.tpd, 'tasks a day', `data-count="${T.tpd}" data-dec="1"`)}
          ${stat(T.full, '100% days', `data-count="${T.full}"`)}
        </div>`;

  // habits: the heart of it
  if (v2 && R.habits && R.habits.length){
    h += `<div class="rv-sec"><div class="section-label">Habits</div>
      ${R.habits.map(x => {
        const p = Math.min(100, rvPct(x.done / Math.max(1, x.target))), c = getProgressColor(p);
        const verb = x.avoid ? 'held' : '';
        const sub = [];
        if (x.weeks) sub.push(`${x.weeks[0]} of ${x.weeks[1]} weeks on target`);
        if (x.run >= 2) sub.push(`best run ${x.run} days`);
        return `<div class="rv-habit">
          <div class="rv-plan-head"><span class="rv-plan-txt"><b>${escHtml(x.name)}</b> · ${verb ? verb + ' ' : ''}${x.done} of ${x.target}</span>
            <span class="rv-plan-pct" style="color:${c}">${p}%</span></div>
          <div class="rv-track"><div class="rv-fill" data-w="${p}" style="width:${p}%;background:${c}"></div></div>
          ${sub.length ? `<div class="rv-habit-sub">${sub.join(' · ')}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }
  if (v2 && R.tasks && R.tasks.all){
    h += `<div class="rv-sec"><div class="section-label">Tasks</div>
            ${rvRow('Done', `${R.tasks.done} of ${R.tasks.all}`)}
          </div>`;
  }

  // hobbies: depth only (v1 reviews still show their planned-session bars)
  if (g && (g.prs.length || g.bw || g.planned)){
    h += `<div class="rv-sec"><div class="section-label">Gym</div>
            ${g.planned ? rvPlan(`${g.sessions} of ${g.planned} planned sessions`, g.sessions, g.planned) : ''}
            ${rvRow('New bests', g.prs.length)}
            ${g.bw ? rvRow('Morning weight', `${g.bw[0]} → ${g.bw[1]} kg`) : ''}
          </div>`;
  }
  if (r){
    h += `<div class="rv-sec"><div class="section-label">Reading</div>
            ${r.planned ? rvPlan(`Read on ${r.days} of ${r.planned} days`, r.days, r.planned) : ''}
            ${r.books.length ? `<div class="rv-books">${r.books.map(b =>
              `<div class="rv-book"><span class="rv-spine" style="background:${b.color}"></span><span>${escHtml(b.title)} <em>${escHtml(b.author)}</em></span></div>`).join('')}</div>` : ''}
            ${rvRow('Pages, from finished books', r.pages)}
            ${rvRow('Quotes saved', r.quotes)}
          </div>`;
  }
  if (dr){
    h += `<div class="rv-sec"><div class="section-label">Drawing</div>
            ${dr.planned ? rvPlan(`${dr.sessions} of ${dr.planned} planned sessions`, dr.sessions, dr.planned) : ''}
            ${rvRow('Time drawing', dr.hours + ' hours')}
            ${rvRow('Sketches', dr.sketches)}
            ${dr.tags.length ? `<div class="rv-tags">${dr.tags.map(t => `<span class="rv-tag">${escHtml(t[0])} <b>${t[1]}</b></span>`).join('')}</div>` : ''}
          </div>`;
  }
  if (ck){
    h += `<div class="rv-sec"><div class="section-label">Cooking</div>
            ${rvRow('Times cooked', ck.cooks)}
            ${rvRow('New dishes', ck.fresh)}
            ${ck.best ? rvRow('Best cook', `${escHtml(ck.best.name)} <span class="rv-stars">${'★'.repeat(ck.best.stars)}</span>`) : ''}
          </div>`;
  }
  if (R.aims.length){
    h += `<div class="rv-sec"><div class="section-label">${name}'s aims</div>
            ${R.aims.map(a => `<div class="rv-aim${a.done ? '' : ' rv-miss'}"><span class="rv-tick${a.done ? ' on' : ''}">${a.done ? '✓' : ''}</span>
              <span>${escHtml(a.title)}${a.count ? ` <em>${a.count}</em>` : ''}</span></div>`).join('')}
            <div class="rv-note">${R.aims.filter(a => a.done).length} of ${R.aims.length} done</div>
          </div>`;
  }

  const Y = R.year;
  h += `<div class="rv-sec"><div class="section-label">${y}${Y.partial ? '*' : ''} so far</div>
          <div class="rv-bars">${Y.values.map((v, i) => v == null
            ? `<div class="rv-col"><span class="rv-val"></span><div class="rv-bar rv-blank"></div></div>`
            : `<div class="rv-col"><span class="rv-val" style="color:${getProgressColor(v)}">${v}%</span>
                 <div class="rv-bar${i === m0 ? ' rv-cur' : ''}" data-h="${Math.round(v * 0.78)}" style="height:${Math.round(v * 0.78)}px"></div></div>`).join('')}</div>
          <div class="rv-bar-lbl">${REVIEW_MONTHS.map(x => `<span>${x[0]}</span>`).join('')}</div>
          <div class="rv-note" style="margin-bottom:10px">Hold the chart to see each month's %</div>
          ${rvRow('Average completion', Y.comp + '%')}
          ${Y.habits != null ? rvRow('Habits', Y.habits + '%') : ''}
          ${rvRow('100% days', Y.full)}
          ${Y.tpd != null && !v2 ? rvRow('Tasks a day', Y.tpd) : ''}
          ${Y.asterisks ? rvRow('Asterisk days', Y.asterisks) : ''}
        </div>

        <div class="rv-cta">
          ${isLatest ? `<button class="btn btn-add" onclick="reviewSetAims()">Set ${REVIEW_MONTHS[(m0 + 1) % 12]}'s aims</button>` : ''}
          <button class="btn rv-ghost" onclick="closeReview()">Done</button>
        </div>
        <div class="rv-frozen">Saved as it stood on ${reviewShortDate(R.frozenOn)}</div>
      </div>`;

  const sheet = document.getElementById('reviewSheet');
  sheet.innerHTML = h;
  sheet.classList.add('open');
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  // hold the year chart to read the figures
  const bars = sheet.querySelector('.rv-bars');
  const off = () => bars.classList.remove('show');
  bars.addEventListener('pointerdown', () => bars.classList.add('show'));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => bars.addEventListener(t, off));
  bars.addEventListener('contextmenu', e => e.preventDefault());

  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (firstOpen && !calm) playReviewReveal(sheet, R.hadRecord);
  renderReviewSlot();
}

// first open only: bars fill, numbers count up, confetti if a record fell
function playReviewReveal(sheet, hadRecord){
  const fills = sheet.querySelectorAll('.rv-fill'), bars = sheet.querySelectorAll('.rv-bar[data-h]'), nums = sheet.querySelectorAll('[data-count]');
  fills.forEach(f => f.style.width = '0%');
  bars.forEach(b => b.style.height = '2px');
  nums.forEach(n => { n.dataset.final = n.textContent; n.textContent = '0' + (n.dataset.suffix || ''); });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fills.forEach(f => f.style.width = f.dataset.w + '%');
    bars.forEach(b => b.style.height = b.dataset.h + 'px');
    const t0 = performance.now(), dur = 900;
    (function tick(t){
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      nums.forEach(n => { const v = +n.dataset.count * e; n.textContent = p < 1 ? (n.dataset.dec ? v.toFixed(1) : Math.round(v)) + (n.dataset.suffix || '') : n.dataset.final; });
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }));
  if (hadRecord) setTimeout(launchConfetti, 350);
}

function closeReview(){
  const sheet = document.getElementById('reviewSheet');
  sheet.classList.remove('open');
  sheet.innerHTML = '';
  document.body.style.overflow = '';
  renderReviewSlot();
}

// straight from the review to this month's aims, opened
function reviewSetAims(){
  closeReview();
  localStorage.setItem('theosAimsOpen-month', 'open');
  openMonthAims();
  const input = document.getElementById('goalInput-month');
  if (input) setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
}
