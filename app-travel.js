// theo's day — app-travel.js
// Part of the app. Loaded by index.html in order; every function is global.
//
// ── TRIPS ──
// A trip explains the record; it never changes the score.
//  · A trip has a place, a start, an optional end, and a list of habits paused
//    for it. Stored in theosTrips.
//  · A paused habit isn't expected on those days: it doesn't count against the
//    day's bar. Tick it anyway and it counts as done, like a flexible habit.
//  · Streaks ignore trips completely. A run that breaks while you travel stays
//    broken; streak history names the trip it broke in.
//  · Trips can't overlap. Starting a trip after an open one (no end date)
//    closes the open one the day before.
//  · Colours come from date order, rotating amber / blue / purple, so trips
//    next to each other never share one. Red and green are taken.
//  · An open trip covers days up to today, not the future.

const TRIPS_KEY = 'theosTrips';
const TRIP_COLORS = ['amber', 'blue', 'purple'];

function loadTrips(){
  try { const v = JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveTrips(list){
  list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  localStorage.setItem(TRIPS_KEY, JSON.stringify(list));
  if (typeof queueSync === 'function') queueSync();
}
function tripsSorted(){ return loadTrips().sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0); }

// read-only copy for lookups — the calendar and review ask about every day
// for every habit, so parse once per change rather than once per question
let tripCache = { raw: undefined, list: [] };
function tripsCached(){
  const raw = localStorage.getItem(TRIPS_KEY);
  if (raw !== tripCache.raw) tripCache = { raw, list: tripsSorted() };
  return tripCache.list;
}

function tripLastDay(t){ return t.end || getTodayKey(); }
function tripOn(key, trips){
  return (trips || tripsCached()).find(t => key >= t.start && key <= tripLastDay(t)) || null;
}
function tripColor(t, trips){
  const list = trips || tripsCached();
  const i = list.findIndex(x => x.id === t.id);
  return TRIP_COLORS[(i < 0 ? 0 : i) % TRIP_COLORS.length];
}

// used by app-habits.js: is this habit paused on this day?
function habitPausedOn(h, key){
  const t = tripOn(key);
  return !!(t && (t.paused || []).includes(h.id));
}

function tripDate(key, withYear){
  const opts = { month: 'short', day: 'numeric' };
  if (withYear) opts.year = 'numeric';
  return new Date(key + 'T00:00:00').toLocaleDateString('en-US', opts);
}

// ── TODAY ──

function renderTodayTrip(){
  const el = document.getElementById('todayTrip');
  if (!el) return;
  const trips = tripsSorted();
  const t = tripOn(getTodayKey(), trips);
  if (!t) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const until = t.end ? ` · until ${tripDate(t.end)}` : '';
  el.className = 'today-trip trip-text-' + tripColor(t, trips);
  el.innerHTML = `<span class="trip-swatch trip-bg-${tripColor(t, trips)}"></span>${escHtml(t.place)} · since ${tripDate(t.start)}${until}`;
  el.style.display = 'flex';
}

// ── MONTH: the key above the aims, and the trip editor at the bottom ──

function renderTripKey(){
  const box = document.getElementById('tripKey');
  if (!box) return;
  const first = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
  const last = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(new Date(calYear, calMonth + 1, 0).getDate()).padStart(2, '0')}`;
  const trips = tripsSorted();
  const here = trips.filter(t => t.start <= last && tripLastDay(t) >= first);
  box.innerHTML = here.map(t =>
    `<button class="trip-key-item" onclick="openTripEditor('${t.id}')"><span class="trip-swatch trip-bg-${tripColor(t, trips)}"></span>${escHtml(t.place)}</button>`
  ).join('');
  box.style.display = here.length ? 'flex' : 'none';
}

let tripDraft = null;     // the trip being edited, or null when the editor is shut
let tripError = '';

function renderTripSlot(){
  const slot = document.getElementById('tripSlot');
  if (!slot) return;
  if (!tripDraft) {
    slot.innerHTML = `<button class="trip-start-btn" onclick="openTripEditor()">Start a trip</button>`;
    return;
  }
  const d = tripDraft;
  const habits = activeHabits();
  const chips = habits.map(h => {
    const paused = d.paused.includes(h.id);
    return `<button class="habit-row${paused ? ' off' : ''}" data-hid="${escHtml(h.id)}" onclick="toggleTripHabit(this)">
      <span class="habit-name">${escHtml(h.name)}</span>
      <span class="habit-meta">${paused ? 'paused' : 'keep'}</span>
    </button>`;
  }).join('');
  slot.innerHTML = `<div class="trip-editor">
    <div class="trip-editor-label">${d.id ? 'Edit trip' : 'Start a trip'}</div>
    <input type="text" id="tripPlace" class="trip-input" maxlength="40" placeholder="Where to, e.g. Japan"
      value="${escHtml(d.place)}" oninput="tripDraft.place = this.value"/>
    <div class="trip-dates">
      <label class="trip-date"><span>Starts</span>
        <input type="date" id="tripStart" value="${d.start}" onchange="tripDraft.start = this.value"/></label>
      <label class="trip-date"><span>Ends</span>
        <input type="date" id="tripEnd" value="${d.end || ''}" onchange="tripDraft.end = this.value || null"/></label>
    </div>
    <div class="trip-hint">Leave the end empty if you don't know it yet.</div>
    ${habits.length ? `<div class="trip-habits-label">Habits on this trip</div>
    <div class="habit-list">${chips}</div>
    <div class="trip-hint">Tap to pause. Paused habits don't count against your day; tick one anyway and it counts. Streaks run as normal.</div>` : ''}
    ${tripError ? `<div class="trip-error">${escHtml(tripError)}</div>` : ''}
    <div class="trip-actions">
      ${d.id ? `<button class="trip-delete" onclick="deleteTrip()">Delete</button>` : ''}
      <button class="trip-cancel" onclick="closeTripEditor()">Cancel</button>
      <button class="trip-save" onclick="saveTrip()">Save</button>
    </div>
  </div>`;
}

function openTripEditor(id){
  const t = id ? loadTrips().find(x => x.id === id) : null;
  tripDraft = t
    ? { id: t.id, place: t.place, start: t.start, end: t.end || null, paused: (t.paused || []).slice() }
    : { id: null, place: '', start: selKey && selKey <= getTodayKey() ? selKey : getTodayKey(), end: null, paused: [] };
  tripError = '';
  renderTripSlot();
  const slot = document.getElementById('tripSlot');
  if (slot && slot.scrollIntoView) slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTripEditor(){
  tripDraft = null; tripError = '';
  renderTripSlot();
}

// read the inputs back first, so a re-render never loses what was typed
function pullTripInputs(){
  const p = document.getElementById('tripPlace'), s = document.getElementById('tripStart'), e = document.getElementById('tripEnd');
  if (p) tripDraft.place = p.value;
  if (s) tripDraft.start = s.value;
  if (e) tripDraft.end = e.value || null;
}

function toggleTripHabit(el){
  if (!tripDraft) return;
  pullTripInputs();
  const id = el.dataset.hid;
  const set = new Set(tripDraft.paused);
  if (set.has(id)) set.delete(id); else set.add(id);
  tripDraft.paused = [...set];
  renderTripSlot();
}

function saveTrip(){
  if (!tripDraft) return;
  pullTripInputs();
  const d = tripDraft;
  const place = (d.place || '').trim();
  const fail = msg => { tripError = msg; renderTripSlot(); };
  if (!place) return fail('Add where you are going.');
  if (!d.start) return fail('Pick a start date.');
  if (d.end && d.end < d.start) return fail('The end is before the start.');

  const others = loadTrips().filter(t => t.id !== d.id);
  // a new trip after an open one closes it the day before
  others.forEach(t => { if (!t.end && t.start < d.start) t.end = addDaysKey(d.start, -1); });
  const myEnd = d.end || '9999-12-31';
  const clash = others.find(t => d.start <= (t.end || '9999-12-31') && t.start <= myEnd);
  if (clash) {
    return fail(!d.end && clash.start > d.start
      ? `This runs into ${clash.place}. Give it an end date.`
      : `This overlaps ${clash.place} (${tripDate(clash.start)} – ${clash.end ? tripDate(clash.end) : 'now'}).`);
  }

  // keep pauses for removed habits too, so the record of an old trip stays whole
  const old = d.id ? (loadTrips().find(t => t.id === d.id) || {}) : {};
  const activeIds = new Set(activeHabits().map(h => h.id));
  const kept = (old.paused || []).filter(id => !activeIds.has(id));
  const trip = { id: d.id || 't' + Date.now(), place, start: d.start, end: d.end || null, paused: [...new Set([...kept, ...d.paused])] };
  saveTrips([...others, trip]);
  tripDraft = null; tripError = '';
  afterTripChange();
}

function deleteTrip(){
  if (!tripDraft || !tripDraft.id) return;
  const t = loadTrips().find(x => x.id === tripDraft.id);
  if (!t || !confirm(`Delete the ${t.place} trip? Your ticks aren't touched.`)) return;
  saveTrips(loadTrips().filter(x => x.id !== t.id));
  tripDraft = null; tripError = '';
  afterTripChange();
}

function afterTripChange(){
  renderCalendar();   // also redraws the key and the editor slot
  renderToday();
}
