// theo's day — app-drawing.js
// Urban sketching. One entry per sitting, with a sketch count. Time is the
// headline number: hours invested tells the truth about a craft in a way a
// count of finished pieces doesn't.

const MEDIUMS = ['Pen', 'Pencil', 'Watercolour', 'Ink', 'Marker', 'Digital'];
const QUICK_MINS = [15, 30, 45, 60, 90];

function loadSketches(){
  try { return JSON.parse(localStorage.getItem('theosSketches') || '[]'); }
  catch { return []; }
}
function saveSketches(list){
  localStorage.setItem('theosSketches', JSON.stringify(list));
  queueSync();
}

let drawState = { view:'home', logging:false, editId:null, form:{} };

// ── HELPERS ──

function sortedSessions(){
  return loadSketches().slice().sort((a, b) => b.date.localeCompare(a.date));
}

function lastDrawDate(){
  const s = sortedSessions();
  return s.length ? s[0].date : null;
}

function daysSinceLastDraw(){
  const last = lastDrawDate();
  if (!last) return null;
  return Math.round((new Date(getTodayKey()) - new Date(last)) / 86400000);
}

function drawTotals(list){
  return list.reduce((a, s) => ({
    mins: a.mins + (Number(s.minutes) || 0),
    sketches: a.sketches + (Number(s.sketches) || 0),
    sessions: a.sessions + 1
  }), { mins:0, sketches:0, sessions:0 });
}

function inThisWeek(s){
  return ymd(weekStartOf(new Date(s.date + 'T00:00:00'))) === ymd(weekStartOf(new Date()));
}

function fmtHours(mins){
  if (!mins) return '0';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

// logging a session counts as having drawn that day
function tickDrawTask(dateKey){
  const day = getDay(dateKey);
  const task = day.tasks.find(t => t.text.trim().toLowerCase() === 'draw');
  if (task) task.done = true;
  else day.tasks.push({ text:'Draw', detail:'', done:true });
  saveDay(dateKey, day);
  renderToday();
}

// ── FORM ──

function openLog(id){
  drawState.logging = true;
  drawState.editId = id || null;
  const existing = id ? loadSketches().find(s => s.id === id) : null;
  drawState.form = existing
    ? Object.assign({}, existing)
    : { date: getTodayKey(), minutes: '', sketches: 1, medium: 'Pen', location: '', subject: '', felt: 0 };
  renderHobbies();
}

function closeLog(){
  drawState.logging = false;
  drawState.editId = null;
  renderHobbies();
}

// Tapping a chip or a star re-renders the form, which would blow away anything
// typed but not yet saved. Pull the live values into state first.
function syncFormFromDOM(){
  const v = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const f = drawState.form;
  if (v('drawDate')     !== undefined) f.date     = v('drawDate');
  if (v('drawMins')     !== undefined) f.minutes  = v('drawMins');
  if (v('drawCount')    !== undefined) f.sketches = v('drawCount');
  if (v('drawSubject')  !== undefined) f.subject  = v('drawSubject');
  if (v('drawLocation') !== undefined) f.location = v('drawLocation');
}

function formSet(field, value){
  syncFormFromDOM();
  drawState.form[field] = value;
  renderHobbies();
}

function setMinutes(v){
  syncFormFromDOM();
  drawState.form.minutes = v;
  renderHobbies();
}

function saveSession(){
  syncFormFromDOM();
  const f = drawState.form;
  const entry = {
    id: drawState.editId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    date: f.date || getTodayKey(),
    minutes: parseInt(f.minutes) || 0,
    sketches: parseInt(f.sketches) || 1,
    medium: f.medium || 'Pen',
    location: (f.location || '').trim(),
    subject: (f.subject || '').trim(),
    felt: f.felt || 0
  };

  const list = loadSketches();
  const i = list.findIndex(s => s.id === entry.id);
  if (i >= 0) list[i] = entry; else list.push(entry);
  saveSketches(list);
  tickDrawTask(entry.date);

  drawState.logging = false;
  drawState.editId = null;
  renderHobbies();
}

function deleteSession(id){
  saveSketches(loadSketches().filter(s => s.id !== id));
  drawState.logging = false;
  drawState.editId = null;
  renderHobbies();
}

function drawGo(view){
  drawState.view = view;
  renderHobbies();
}

// ── MAIN SCREEN ──

function renderDrawing(body){
  if (drawState.view === 'summary') return renderDrawSummary(body);

  const all = sortedSessions();
  const week = drawTotals(all.filter(inThisWeek));
  const since = daysSinceLastDraw();

  let h = '';

  // the one line most likely to change what you do today
  if (since === null) {
    h += `<div class="draw-since none">Nothing logged yet</div>`;
  } else if (since === 0) {
    h += `<div class="draw-since today">Drew today</div>`;
  } else {
    h += `<div class="draw-since${since >= 3 ? ' cold' : ''}">${
      since === 1 ? 'Drew yesterday' : since + ' days since you last drew'}</div>`;
  }

  h += `<div class="read-stats" style="margin-top:14px">
          <div class="read-stat"><span class="rs-n">${fmtHours(week.mins)}</span><span class="rs-l">this week</span></div>
          <div class="read-stat"><span class="rs-n">${week.sessions}</span><span class="rs-l">sittings</span></div>
          <div class="read-stat"><span class="rs-n">${week.sketches}</span><span class="rs-l">sketches</span></div>
        </div>`;

  if (drawState.logging) {
    h += logFormHTML();
  } else {
    h += `<button class="add-book-btn" onclick="openLog()">+ Log a session</button>`;
  }

  if (all.length) {
    h += '<div class="section-label" style="margin-top:22px">Recent</div>';
    h += all.slice(0, 6).map(s => sessionRowHTML(s)).join('');
  }

  h += `<div class="reading-nav">
          <button class="sync-btn" onclick="drawGo('summary')">Summary</button>
        </div>`;

  body.innerHTML = h;
}

function sessionRowHTML(s){
  const bits = [fmtHours(s.minutes), s.sketches + (s.sketches === 1 ? ' sketch' : ' sketches'), s.medium]
    .filter(Boolean).join(' · ');
  return `<div class="draw-row" onclick="openLog('${s.id}')">
      <div class="draw-row-main">
        <div class="draw-row-top">${escHtml(s.subject || 'Untitled')}</div>
        <div class="draw-row-sub">${escHtml(bits)}${s.location ? ' · ' + escHtml(s.location) : ''}</div>
      </div>
      <div class="draw-row-right">
        <div class="draw-row-date">${shortDate(s.date)}</div>
        ${s.felt ? `<div class="draw-row-felt">${'★'.repeat(s.felt)}</div>` : ''}
      </div>
    </div>`;
}

function logFormHTML(){
  const f = drawState.form;
  const known = [...new Set(loadSketches().map(s => s.subject).filter(Boolean))].slice(0, 20);
  const places = [...new Set(loadSketches().map(s => s.location).filter(Boolean))].slice(0, 20);

  return `<div class="add-book-panel">
    <div class="date-pair">
      <label>Date<input type="date" id="drawDate" value="${f.date}"/></label>
      <label>Sketches<input type="number" inputmode="numeric" id="drawCount" value="${f.sketches}" min="0"/></label>
    </div>

    <div class="sync-label" style="margin-top:14px">Minutes</div>
    <div class="draw-mins">
      <input type="number" inputmode="numeric" id="drawMins" value="${f.minutes}" placeholder="0"/>
      ${QUICK_MINS.map(m => `<button class="bar-chip" onclick="setMinutes(${m})">${m}</button>`).join('')}
    </div>

    <div class="sync-label" style="margin-top:14px">Medium</div>
    <div class="bar-row">
      ${MEDIUMS.map(m => `<button class="bar-chip${f.medium === m ? ' active' : ''}"
          onclick="formSet('medium','${m}')">${m}</button>`).join('')}
    </div>

    <input type="text" id="drawSubject" class="draw-input" placeholder="What did you draw?"
           value="${escHtml(f.subject || '')}" list="drawSubjects"/>
    <datalist id="drawSubjects">${known.map(n => `<option value="${escHtml(n)}"></option>`).join('')}</datalist>

    <input type="text" id="drawLocation" class="draw-input" placeholder="Where?"
           value="${escHtml(f.location || '')}" list="drawPlaces"/>
    <datalist id="drawPlaces">${places.map(n => `<option value="${escHtml(n)}"></option>`).join('')}</datalist>

    <div class="sync-label" style="margin-top:14px">How did it go?</div>
    <div class="star-row">${[1,2,3,4,5].map(n =>
      `<button class="star${f.felt >= n ? ' on' : ''}" onclick="formSet('felt',${f.felt === n ? 0 : n})">★</button>`
    ).join('')}</div>

    <div class="finish-actions">
      <button class="sync-btn" onclick="closeLog()">Cancel</button>
      <button class="btn btn-add" onclick="saveSession()">${drawState.editId ? 'Save' : 'Log it'}</button>
    </div>
    ${drawState.editId ? `<button class="sync-btn gym-drop" style="width:100%;margin-top:8px"
        onclick="deleteSession('${drawState.editId}')">Delete this session</button>` : ''}
  </div>`;
}

// ── SUMMARY ──

function renderDrawSummary(body){
  const all = sortedSessions();
  const total = drawTotals(all);

  let h = `<button class="gym-back" onclick="drawGo('home')">&lsaquo; Back</button>
           <div class="screen-title" style="padding-top:6px">Drawing</div>`;

  h += `<div class="read-stats" style="margin-top:14px">
          <div class="read-stat"><span class="rs-n">${fmtHours(total.mins)}</span><span class="rs-l">total</span></div>
          <div class="read-stat"><span class="rs-n">${total.sessions}</span><span class="rs-l">sittings</span></div>
          <div class="read-stat"><span class="rs-n">${total.sketches}</span><span class="rs-l">sketches</span></div>
        </div>`;

  if (!all.length) {
    h += '<div class="gym-nochart">Nothing logged yet</div>';
    body.innerHTML = h;
    return;
  }

  // by week — minutes on the left, sketches on the right
  const weeks = {};
  all.forEach(s => {
    const wk = ymd(weekStartOf(new Date(s.date + 'T00:00:00')));
    if (!weeks[wk]) weeks[wk] = { mins:0, sketches:0 };
    weeks[wk].mins += Number(s.minutes) || 0;
    weeks[wk].sketches += Number(s.sketches) || 0;
  });
  const keys = Object.keys(weeks).sort();
  if (keys.length > 1) {
    h += `<div class="chart-block">
            <div class="chart-title">By week</div>
            ${lineChart({
              labels: keys,
              series: [
                { name:'Minutes', color:'#1a4d2e', values: keys.map(k => weeks[k].mins) },
                { name:'Sketches', color:'#b07d3a', values: keys.map(k => weeks[k].sketches), axis:'right' }
              ],
              yLabel:'mins', y2Label:'sketches'
            })}
          </div>
          <div class="chart-legend">
            <span class="legend-item"><i style="background:#1a4d2e"></i>Minutes</span>
            <span class="legend-item"><i style="background:#b07d3a"></i>Sketches</span>
          </div>`;
  }

  h += tallyHTML('What you draw', all, s => s.subject);
  h += tallyHTML('Where', all, s => s.location);
  h += tallyHTML('Medium', all, s => s.medium);

  h += '<div class="section-label" style="margin-top:24px">Every session</div>';
  h += all.map(s => sessionRowHTML(s)).join('');

  body.innerHTML = h;
}

// counts by a field, biggest first — the point is seeing what you avoid
function tallyHTML(label, list, pick){
  const counts = {};
  list.forEach(s => {
    const v = (pick(s) || '').trim();
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  const max = rows[0][1];
  return `<div class="section-label" style="margin-top:22px">${label}</div>
    <div class="tally">${rows.map(([name, n]) => `
      <div class="tally-row">
        <span class="tally-name">${escHtml(name)}</span>
        <span class="tally-bar"><i style="width:${Math.round((n / max) * 100)}%"></i></span>
        <span class="tally-n">${n}</span>
      </div>`).join('')}</div>`;
}
