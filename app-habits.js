// theo's day — app-habits.js
// Part of the app. Loaded by index.html in order; every function is global.
//
// ── HABITS ──
// Tasks are what a particular day asks of you. Habits are the fixed list that's
// there every day, one tap each. Definitions live in theosHabits; ticks live on
// the day itself (theosDayData[key].habits = [id, …]) so export and sync carry
// them with no extra work.
//
// Rules:
//  · A habit counts toward a day's bar only on days it's due. Daily: every day.
//    Fixed days: the weekdays picked. Flexible (N× a week, once a fortnight):
//    never due — it counts on the days you tick it, so rest days cost nothing.
//  · "Avoid" habits (no drinking) are ticked too. The tick means "held the line
//    today". A blank day means not reported yet — nothing is assumed.
//  · Today and yesterday never break a streak. Fill yesterday in the morning.
//  · Streaks come from habits. Days before habits existed still count: a task
//    with the habit's name, ticked on a past day, reads as a tick. Old task
//    history is never rewritten.
//  · since / ended keep history true: adding a habit doesn't make last month
//    look worse, and removing one doesn't erase what it recorded.

const HABITS_KEY = 'theosHabits';
const STREAK_MIN_COUNT = 3;   // done fewer times than this? not a habit yet
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function loadHabits(){
  try { const v = JSON.parse(localStorage.getItem(HABITS_KEY) || 'null'); return Array.isArray(v) ? v : null; }
  catch { return null; }
}
function saveHabits(list){
  localStorage.setItem(HABITS_KEY, JSON.stringify(list));
  if (typeof queueSync === 'function') queueSync();
}
function allHabits(){ return loadHabits() || []; }
function activeHabits(){ return allHabits().filter(h => !h.ended); }

// matches by id or by name, so "Read", "read" and the habit with id read agree
function habitNamed(name, list){
  const n = normalizeTaskName(name || '');
  return (list || allHabits()).find(h => h.id === n || normalizeTaskName(h.name) === n) || null;
}
function activeHabitNamed(name){ return habitNamed(name, activeHabits()); }

function addDaysKey(key, n){
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function yesterdayKey(){ return addDaysKey(getTodayKey(), -1); }

// weeks since a fixed Sunday, so fortnights line up consistently
function weekIndex(d){
  const ws = weekStartOf(d);
  return Math.round((ws - new Date(1970,0,4)) / (7*86400000));
}

// ── SCHEDULES ──
// type: daily | days (with days: [0–6]) | weekly (times) | biweekly
// The old per-task streak rules (theosStreakSchedules) are only read during the
// one-time move and by the review for names that aren't habits.

function loadSchedules(){
  try { return JSON.parse(localStorage.getItem('theosStreakSchedules') || '{}'); }
  catch { return {}; }
}

function habitSch(h){ return (h && h.sch) || { type: 'daily' }; }
function isFlexible(sch){ return sch.type === 'weekly' || sch.type === 'biweekly'; }

function habitDue(h, key){
  const s = habitSch(h);
  if (s.type === 'daily') return true;
  if (s.type === 'days') return (s.days || []).includes(new Date(key + 'T00:00:00').getDay());
  return false;
}
// Due, and not paused by a trip on that day. This decides the day's bar.
// Streaks use habitDue alone: a trip never freezes or protects a streak.
function habitPaused(h, key){ return typeof habitPausedOn === 'function' && habitPausedOn(h, key); }
function habitExpected(h, key){ return habitDue(h, key) && !habitPaused(h, key); }
function habitInRange(h, key){ return key >= (h.since || '0000') && (!h.ended || key < h.ended); }

function scheduleLabel(sch){
  if (sch.type === 'daily') return 'every day';
  if (sch.type === 'days') return (sch.days || []).slice().sort((a,b) => ((a+6)%7) - ((b+6)%7)).map(d => DAY_ABBR[d]).join(', ');
  if (sch.type === 'biweekly') return 'once every 2 weeks';
  return sch.times === 1 ? 'once a week' : sch.times + '× per week';
}
function scheduleCode(sch){
  if (sch.type === 'daily') return 'daily';
  if (sch.type === 'days') return 'days';
  if (sch.type === 'biweekly') return 'b1';
  return 'w' + (sch.times || 1);
}

const HABIT_SCHEDULE_OPTIONS = [
  ['daily','Every day'], ['days','Specific days'],
  ['w6','6× per week'], ['w5','5× per week'], ['w4','4× per week'],
  ['w3','3× per week'], ['w2','2× per week'], ['w1','Once a week'],
  ['b1','Once every 2 weeks']
];

// ── TICKS ──

function dayHabitIds(day){ return (day && Array.isArray(day.habits)) ? day.habits : []; }

// a task with the habit's name, ticked — how habits were recorded before
function legacyTaskDone(h, day){
  if (!day || !day.tasks) return false;
  const a = h.id, b = normalizeTaskName(h.name);
  return day.tasks.some(t => t.done && t.text && (normalizeTaskName(t.text) === a || normalizeTaskName(t.text) === b));
}
function habitDoneOn(h, key, data){
  const day = (data || loadData())[key];
  return dayHabitIds(day).includes(h.id) || legacyTaskDone(h, day);
}

function setHabitTick(id, key, on, fromHobby){
  const h = allHabits().find(x => x.id === id);
  const data = loadData();
  const day = data[key] || (data[key] = { tasks: [] });
  const ids = new Set(dayHabitIds(day));
  if (on) ids.add(id); else ids.delete(id);
  if (ids.size) day.habits = [...ids]; else delete day.habits;
  // unticking also clears an old-style task of the same name, or it would
  // still read as done
  if (!on && h && day.tasks) day.tasks.forEach(t => {
    if (t.done && (normalizeTaskName(t.text) === h.id || normalizeTaskName(t.text) === normalizeTaskName(h.name))) t.done = false;
  });
  saveData(data);
  // Read mirrors the reading hobby, both ways. Hobbies pass fromHobby so the
  // change isn't bounced straight back to them.
  if (!fromHobby && h && h.id === 'read' && typeof readTaskToggled === 'function') readTaskToggled(key, on);
}

// Hobbies tick their habit: Read today, Finish session, logging a drawing.
// Returns false when there's no such habit, so the caller keeps the old task
// behaviour.
function markHabitFromHobby(name, key, on){
  const h = activeHabitNamed(name);
  if (!h) return false;
  setHabitTick(h.id, key, on, true);
  return true;
}

// ── A DAY'S COUNT ──
// Used by the progress bar, the calendar, the review and the sync snapshot.
// Habits only count up to today; a task named like a habit that's being
// counted that day folds into the habit rather than counting twice.

function dayCounts(key, data){
  data = data || loadData();
  const day = data[key] || {};
  const ticks = dayHabitIds(day);
  const habits = [];
  if (key <= getTodayKey()) {
    allHabits().forEach(h => {
      const ticked = ticks.includes(h.id);
      const inRange = habitInRange(h, key);
      if (!ticked && !(inRange && habitExpected(h, key))) return;
      habits.push({ h, done: ticked || (inRange && legacyTaskDone(h, day)) });
    });
  }
  const folded = new Set();
  habits.forEach(x => { folded.add(x.h.id); folded.add(normalizeTaskName(x.h.name)); });
  const tasks = (day.tasks || []).filter(t => !folded.has(normalizeTaskName(t.text || '')));
  const done = tasks.filter(t => t.done).length + habits.filter(x => x.done).length;
  return { done, total: tasks.length + habits.length, tasks, habits };
}

// ── STREAKS ──

function habitDays(h, data){
  data = data || loadData();
  const set = new Set();
  Object.keys(data).forEach(k => { if (habitDoneOn(h, k, data)) set.add(k); });
  return set;
}

function runLength(h, data){
  const sch = habitSch(h);
  const days = habitDays(h, data);
  const today = getTodayKey(), yest = yesterdayKey();

  if (!isFlexible(sch)) {
    if (sch.type === 'days' && !(sch.days || []).length) return 0;
    const d = new Date();
    let n = 0, guard = 0;
    while (guard++ < 3000) {
      const k = ymd(d);
      if (habitDue(h, k)) {
        if (days.has(k)) n++;
        else if (k === today || k === yest) { /* not reported yet */ }
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  const size = sch.type === 'biweekly' ? 2 : 1;
  const need = sch.times || 1;
  const perPeriod = {};
  days.forEach(k => {
    const idx = Math.floor(weekIndex(new Date(k + 'T00:00:00')) / size);
    perPeriod[idx] = (perPeriod[idx] || 0) + 1;
  });
  const current = Math.floor(weekIndex(new Date()) / size);
  const yIdx = Math.floor(weekIndex(new Date(yest + 'T00:00:00')) / size);
  let p = current, n = 0, guard = 0;
  while (guard++ < 520) {
    const c = perPeriod[p] || 0;
    if (c >= need) n++;
    else if (p === current || p === yIdx) { /* still open */ }
    else break;
    p--;
  }
  return n;
}

// How the run is shown. The schedule decides whether a streak survives; the
// unit only decides how it reads.
function defaultUnit(sch){ return isFlexible(sch) ? 'weeks' : 'days'; }
function unitOptions(sch){ return isFlexible(sch) ? ['weeks','months'] : ['days','weeks','months']; }

function streakDisplay(n, sch){
  const unit = sch.unit || defaultUnit(sch);
  let perNative = 1;
  if (sch.type === 'days') perNative = 7 / Math.max(1, (sch.days || []).length);
  if (sch.type === 'weekly') perNative = 7;
  if (sch.type === 'biweekly') perNative = 14;
  const spanDays = n * perNative;

  if (unit === 'months') {
    const m = Math.floor(spanDays / 30.44);
    if (m >= 1) return { v: m, u: 'month' };
  }
  if (unit === 'months' || unit === 'weeks') {
    const wk = Math.floor(spanDays / 7);
    if (wk >= 1) return { v: wk, u: 'week' };
  }
  if (!isFlexible(sch)) return { v: n, u: 'day' };
  return { v: n, u: sch.type === 'biweekly' ? 'block' : 'week' };
}

function calculateStreaks(){
  const data = loadData();
  const out = {};
  activeHabits().forEach(h => {
    const sch = habitSch(h);
    const n = runLength(h, data);
    const min = isFlexible(sch) ? 2 : 3;
    if (n >= min) {
      const disp = streakDisplay(n, sch);
      out[h.name] = { n, sch, label: scheduleLabel(sch), value: disp.v, unit: disp.u };
    }
  });
  return out;
}

function renderStreaks(){
  const list = document.getElementById('streakList');
  if (!list) return;
  renderStreakHistory();
  const entries = Object.entries(calculateStreaks()).sort((a,b) => b[1].n - a[1].n);
  if (!entries.length) {
    list.innerHTML = '<div class="streak-empty">No streaks going yet. A daily habit shows here after 3 days in a row.</div>';
    return;
  }
  list.innerHTML = entries.map(([name, s]) => `
    <div class="streak-item">
      <span class="streak-name">${escHtml(name)}<span class="streak-sched">${s.label}</span></span>
      <span class="streak-count">${s.value} ${s.value === 1 ? s.unit : s.unit + 's'}</span>
    </div>`).join('');
}

// ── STREAK HISTORY ──
// Past runs, worked out from the ticks each time, so it covers everything
// already recorded and can't drift from it. Only runs worth remembering:
// 7+ for day-based habits, 3+ weeks for weekly ones. The run still going is
// in Active Streaks, not here. If a run broke during a trip, the trip is named.

let streakHistoryOpen = false;

function periodStartKey(p, size){ return ymd(new Date(1970, 0, 4 + p * size * 7)); }

function pastRuns(h, data){
  const sch = habitSch(h);
  const days = habitDays(h, data);
  if (!days.size) return [];
  const today = getTodayKey(), yest = yesterdayKey();
  const stop = h.ended ? addDaysKey(h.ended, -1) : today;
  const sorted = [...days].sort();
  const runs = [];

  if (!isFlexible(sch)) {
    if (sch.type === 'days' && !(sch.days || []).length) return [];
    let n = 0, start = null, last = null;
    for (let k = sorted[0]; k <= stop; k = addDaysKey(k, 1)) {
      if (!habitDue(h, k)) continue;
      if (days.has(k)) { if (!n) start = k; n++; last = k; }
      else if (!h.ended && (k === today || k === yest)) { /* not reported yet */ }
      else { if (n >= 7) runs.push({ h, n, start, end: last, broke: [k] }); n = 0; }
    }
    if (h.ended && n >= 7) runs.push({ h, n, start, end: last, broke: [] });
    return runs;
  }

  const size = sch.type === 'biweekly' ? 2 : 1;
  const need = sch.times || 1;
  const idxOf = k => Math.floor(weekIndex(new Date(k + 'T00:00:00')) / size);
  const per = {};
  sorted.forEach(k => { (per[idxOf(k)] || (per[idxOf(k)] = [])).push(k); });
  const current = idxOf(stop), yIdx = idxOf(yest);
  let n = 0, start = null, last = null;
  for (let p = idxOf(sorted[0]); p <= current; p++) {
    const ticks = per[p] || [];
    if (ticks.length >= need) { if (!n) start = ticks[0]; n++; last = ticks[ticks.length - 1]; }
    else if (!h.ended && (p === current || p === yIdx)) { /* still open */ }
    else {
      if (n * size >= 3) {
        const from = periodStartKey(p, size), broke = [];
        for (let i = 0; i < size * 7; i++) broke.push(addDaysKey(from, i));
        runs.push({ h, n, start, end: last, broke });
      }
      n = 0;
    }
  }
  if (h.ended && n * size >= 3) runs.push({ h, n, start, end: last, broke: [] });
  return runs;
}

function streakHistory(){
  const data = loadData();
  const trips = typeof tripsSorted === 'function' ? tripsSorted() : [];
  const out = [];
  allHabits().forEach(h => pastRuns(h, data).forEach(r => {
    const t = trips.length ? r.broke.map(k => tripOn(k, trips)).find(Boolean) : null;
    out.push(Object.assign(r, { trip: t || null, color: t ? tripColor(t, trips) : null }));
  }));
  return out.sort((a, b) => a.end < b.end ? 1 : a.end > b.end ? -1 : b.n - a.n);
}

function renderStreakHistory(){
  const box = document.getElementById('streakHistory');
  if (!box) return;
  if (!streakHistoryOpen) {
    box.innerHTML = `<button class="streak-more" onclick="toggleStreakHistory()">Streak history</button>`;
    return;
  }
  const runs = streakHistory();
  const thisYear = getTodayKey().slice(0, 4);
  const fmt = k => new Date(k + 'T00:00:00').toLocaleDateString('en-US',
    Object.assign({ month: 'short', day: 'numeric' }, k.slice(0, 4) !== thisYear ? { year: 'numeric' } : {}));
  const rows = runs.map(r => {
    const sch = habitSch(r.h);
    const disp = streakDisplay(r.n, sch);
    const trip = r.trip ? ` · <span class="trip-text-${r.color}">broke in ${escHtml(r.trip.place)}</span>` : '';
    return `<div class="streak-item">
      <span class="streak-name">${escHtml(r.h.name)}<span class="streak-sched">${fmt(r.start)} – ${fmt(r.end)}${trip}</span></span>
      <span class="streak-count past">${disp.v} ${disp.v === 1 ? disp.u : disp.u + 's'}</span>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="streak-header streak-history-head">Streak history</div>
    <div class="streak-list">${rows || '<div class="streak-empty">No finished streaks yet. Runs of 7+ days, or 3+ weeks for weekly habits, show here once they end.</div>'}</div>
    <button class="streak-more" onclick="toggleStreakHistory()">Hide history</button>`;
}

function toggleStreakHistory(){
  streakHistoryOpen = !streakHistoryOpen;
  renderStreakHistory();
}

// ── TODAY'S HABIT LIST ──

let habitEditMode = false;
let habitViewKey = null;     // null = today; otherwise the day being filled in

// ticks in the current week (or fortnight) for a flexible habit
function periodCount(h, key, data){
  const sch = habitSch(h);
  const size = sch.type === 'biweekly' ? 2 : 1;
  const idx = Math.floor(weekIndex(new Date(key + 'T00:00:00')) / size);
  let c = 0;
  habitDays(h, data).forEach(k => {
    if (Math.floor(weekIndex(new Date(k + 'T00:00:00')) / size) === idx) c++;
  });
  return c;
}

// habits to show for a day: everything active then, plus anything ticked
function habitsForDay(key, data){
  const ticks = dayHabitIds((data || loadData())[key]);
  return allHabits().filter(h => habitInRange(h, key) || ticks.includes(h.id));
}

function unmarkedOn(key, data){
  data = data || loadData();
  return allHabits().filter(h => habitInRange(h, key) && habitExpected(h, key) && !habitDoneOn(h, key, data)).length;
}

function habitRowsHtml(key, data, handler){
  return habitsForDay(key, data).map(h => {
    const sch = habitSch(h);
    const done = habitDoneOn(h, key, data);
    const due = habitDue(h, key);
    const paused = !done && habitPaused(h, key);
    let meta = '', metaCls = '';
    if (paused) {
      meta = 'paused';
    } else if (isFlexible(sch)) {
      const c = periodCount(h, key, data), need = sch.times || 1;
      meta = `${c}/${need}`;
      if (c >= need) metaCls = ' met';
    } else if (!due) {
      meta = 'rest';
    }
    const off = paused || (!due && !isFlexible(sch) && !done);
    // a compact chip: filled green when done, no separate checkbox
    return `<button class="habit-row${done ? ' done' : ''}${off ? ' off' : ''}" data-hid="${escHtml(h.id)}" onclick="${handler}(this)">
      <span class="habit-name">${h.kind === 'avoid' ? '<span class="habit-avoid" aria-label="avoid">⊘</span>' : ''}${escHtml(h.name)}</span>
      ${meta ? `<span class="habit-meta${metaCls}">${meta}</span>` : ''}
    </button>`;
  }).join('');
}

function renderHabits(){
  const body = document.getElementById('habitBody');
  if (!body) return;
  const btn = document.getElementById('habitEditBtn');
  const title = document.getElementById('habitTitle');
  if (btn) btn.textContent = habitEditMode ? 'Done' : 'Edit';

  if (habitEditMode) { if (title) title.textContent = 'Habits'; return renderHabitEditor(body); }

  const today = getTodayKey(), yest = yesterdayKey();
  if (habitViewKey && habitViewKey !== yest) habitViewKey = null;   // the day rolled over
  const key = habitViewKey || today;
  const data = loadData();
  if (title) title.textContent = habitViewKey ? 'Habits · yesterday' : 'Habits';

  if (!activeHabits().length && !habitViewKey) {
    body.innerHTML = `<button class="habit-empty" onclick="toggleHabitEdit()">Add the things you want to do, or avoid, every day</button>`;
    return;
  }

  let foot = '';
  if (habitViewKey) {
    foot = `<button class="habit-nudge" onclick="setHabitView(null)">‹ Back to today</button>`;
  } else {
    const n = unmarkedOn(yest, data);
    if (n) foot = `<button class="habit-nudge" onclick="setHabitView('${yest}')">Yesterday · ${n} unmarked ›</button>`;
  }
  body.innerHTML = `<div class="habit-list">${habitRowsHtml(key, data, 'tapHabit')}</div>${foot}`;
}

function setHabitView(key){
  habitViewKey = key;
  renderHabits();
}

function tapHabit(el){
  const id = el.dataset.hid;
  const key = habitViewKey || getTodayKey();
  const h = allHabits().find(x => x.id === id);
  if (!h) return;
  setHabitTick(id, key, !habitDoneOn(h, key));
  renderToday();
  if (selKey === key && typeof renderCalendar === 'function' && document.getElementById('panel-month').classList.contains('active')) renderCalendar();
}

// the same list inside the calendar's day view — how any older day gets edited
function renderDayHabits(key){
  const box = document.getElementById('dayHabits');
  if (!box) return;
  if (key > getTodayKey()) { box.innerHTML = ''; return; }
  const data = loadData();
  const rows = habitRowsHtml(key, data, 'tapDayHabit');
  box.innerHTML = rows ? `<div class="day-habits-label">Habits</div><div class="habit-list" data-key="${key}">${rows}</div>` : '';
}

function tapDayHabit(el){
  const key = el.closest('.habit-list').dataset.key;
  const id = el.dataset.hid;
  const h = allHabits().find(x => x.id === id);
  if (!h) return;
  setHabitTick(id, key, !habitDoneOn(h, key));
  renderCalendar();
  if (key === getTodayKey() || key === yesterdayKey()) renderToday();
}

// ── EDITING ──

function toggleHabitEdit(){
  habitEditMode = !habitEditMode;
  habitViewKey = null;
  renderHabits();
  if (!habitEditMode) renderToday();
}

function renderHabitEditor(body){
  const list = activeHabits();
  const rows = list.map((h, i) => {
    const sch = habitSch(h);
    const units = unitOptions(sch);
    const unit = sch.unit || defaultUnit(sch);
    return `<div class="streak-edit-row">
      <div class="habit-edit-top">
        <input class="habit-name-input" value="${escHtml(h.name)}" maxlength="40"
          onchange="renameHabit(${i}, this.value)"/>
        <button class="habit-remove" onclick="removeHabit(${i})">Remove</button>
      </div>
      <div class="streak-unit-row">
        <span class="streak-unit-label">Type</span>
        <button class="streak-unit${h.kind !== 'avoid' ? ' active' : ''}" onclick="setHabitKind(${i},'do')">Do</button>
        <button class="streak-unit${h.kind === 'avoid' ? ' active' : ''}" onclick="setHabitKind(${i},'avoid')">Avoid</button>
      </div>
      <select class="streak-select habit-sched" onchange="setHabitSchedule(${i}, this.value)">
        ${HABIT_SCHEDULE_OPTIONS.map(([v,l]) => `<option value="${v}"${v === scheduleCode(sch) ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      ${sch.type === 'days' ? `<div class="habit-days">${[0,1,2,3,4,5,6].map(d =>
        `<button class="habit-day${(sch.days || []).includes(d) ? ' active' : ''}" onclick="toggleHabitDay(${i},${d})">${DAY_ABBR[d].slice(0,2)}</button>`).join('')}</div>` : ''}
      <div class="streak-unit-row">
        <span class="streak-unit-label">Count in</span>
        ${units.map(u => `<button class="streak-unit${unit === u ? ' active' : ''}" onclick="setHabitUnit(${i},'${u}')">${u[0].toUpperCase() + u.slice(1)}</button>`).join('')}
      </div>
    </div>`;
  }).join('');

  body.innerHTML = `${rows}
    <div class="habit-add">
      <input type="text" id="habitNewName" placeholder="New habit, e.g. Cold shower" maxlength="40" autocomplete="off"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addHabit();}"/>
      <button class="btn btn-add" onclick="addHabit()">Add</button>
    </div>
    <div class="habit-hint">Avoid habits get ticked too — the tick means you held the line that day.</div>`;
}

function editHabit(i, fn){
  const all = allHabits();
  const target = activeHabits()[i];
  if (!target) return;
  const h = all.find(x => x.id === target.id);
  fn(h);
  saveHabits(all);
  renderHabits();
}

function renameHabit(i, v){
  const name = (v || '').trim();
  if (!name) return renderHabits();
  editHabit(i, h => { h.name = name; });
}
function setHabitKind(i, kind){ editHabit(i, h => { h.kind = kind; }); }
function setHabitSchedule(i, code){
  editHabit(i, h => {
    const prev = habitSch(h);
    let sch;
    if (code === 'daily') sch = { type: 'daily' };
    else if (code === 'days') sch = { type: 'days', days: (prev.days && prev.days.length) ? prev.days : [1,2,3,4,5] };
    else if (code === 'b1') sch = { type: 'biweekly', times: 1 };
    else sch = { type: 'weekly', times: parseInt(code.slice(1)) || 1 };
    if (prev.unit && unitOptions(sch).includes(prev.unit)) sch.unit = prev.unit;
    h.sch = sch;
  });
}
function toggleHabitDay(i, d){
  editHabit(i, h => {
    const s = habitSch(h);
    const set = new Set(s.days || []);
    if (set.has(d)) { if (set.size > 1) set.delete(d); } else set.add(d);
    h.sch = Object.assign({}, s, { days: [...set].sort() });
  });
}
function setHabitUnit(i, u){ editHabit(i, h => { h.sch = Object.assign({}, habitSch(h), { unit: u }); }); }

function removeHabit(i){
  const h = activeHabits()[i];
  if (!h) return;
  if (!confirm(`Remove "${h.name}"? Days you already ticked stay in your history.`)) return;
  editHabit(i, x => { x.ended = getTodayKey(); });
}

function addHabit(){
  const inp = document.getElementById('habitNewName');
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  const all = allHabits();
  const today = getTodayKey();
  const existing = habitNamed(name, all);
  if (existing && !existing.ended) { inp.value = ''; return; }
  if (existing) {
    // bringing one back keeps its history and streak
    delete existing.ended;
    existing.name = name;
  } else {
    let id = normalizeTaskName(name), n = 2;
    while (all.some(h => h.id === id)) id = normalizeTaskName(name) + '-' + n++;
    all.push({ id, name, kind: /^(no|avoid|don'?t)\b/i.test(name) ? 'avoid' : 'do', sch: { type: 'daily' }, since: today });
  }
  saveHabits(all);
  renderHabits();
  const again = document.getElementById('habitNewName');
  if (again) again.focus();
}

// ── ONE-TIME MOVE FROM TASKS ──
// Anything ticked as a task on 3+ separate days and done in the last 3 weeks
// becomes a habit, unless it was set to "No streak". Its schedule and display
// unit carry over. Past days are left exactly as they were — streaks read the
// old ticks in place. Only today's and future days' copies of those tasks are
// turned into habit ticks, so nothing shows twice.

function migrateHabits(){
  if (loadHabits()) return;
  const data = loadData();
  const sched = loadSchedules();
  const today = getTodayKey();
  const cutoff = addDaysKey(today, -21);

  const seen = {};
  Object.keys(data).sort().forEach(k => {
    (data[k].tasks || []).forEach(t => {
      if (!t.done || !t.text) return;
      const n = normalizeTaskName(t.text);
      if (!n) return;
      const s = seen[n] || (seen[n] = { name: t.text.trim(), days: new Set(), last: k });
      s.days.add(k); s.name = t.text.trim(); s.last = k;
    });
  });

  const list = Object.entries(seen)
    .filter(([n, s]) => s.days.size >= STREAK_MIN_COUNT && s.last >= cutoff && !(sched[n] && sched[n].type === 'none'))
    .sort((a, b) => b[1].days.size - a[1].days.size)
    .map(([n, s]) => {
      let sch = sched[n] ? Object.assign({}, sched[n]) : { type: 'daily' };
      // gym runs on fixed days: rest Tuesday and Saturday
      if (n === 'gym') sch = Object.assign({ type: 'days', days: [0,1,3,4,5] }, sch.unit ? { unit: sch.unit } : {});
      const name = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      return { id: n, name, kind: /^(no|avoid|don'?t)\b/i.test(name) ? 'avoid' : 'do', sch, since: today };
    });

  const ids = new Set(list.map(h => h.id));
  Object.keys(data).forEach(k => {
    if (k < today || !data[k].tasks) return;
    const ticks = new Set(dayHabitIds(data[k]));
    data[k].tasks = data[k].tasks.filter(t => {
      const n = normalizeTaskName(t.text || '');
      if (!ids.has(n)) return true;
      if (t.done) ticks.add(n);
      return false;
    });
    if (ticks.size) data[k].habits = [...ticks];
  });

  saveData(data);
  saveHabits(list);
}
