// theo's day — app-cooking.js
// A recipe book first. A dish can exist as just a name ("keema noodles") and
// pick up links, a pasted recipe, tags and a time later. Cooking it logs an
// attempt — date, stars, and what you'd change — which is where the times
// cooked and the average come from. Never typed, always derived.

const COOK_QUICK_MINS = [15, 20, 30, 45, 60];
const COOK_FAST = 20;   // the "under 20 min" filter

function loadDishes(){
  try { return JSON.parse(localStorage.getItem('theosDishes') || '[]'); }
  catch { return []; }
}
function saveDishes(list){
  localStorage.setItem('theosDishes', JSON.stringify(list));
  if (typeof queueSync === 'function') queueSync();
}

let cookState = {
  view: 'book',          // 'book' (the list) or 'dish'
  dishId: null,
  adding: false,
  filter: { fast:false, diff:'', tag:'' },
  cooking: false,        // the "Cooked it" panel
  cookForm: {},
  editingRecipe: false,
  more: false,
  tagList: []            // tags rendered on screen, so chips can pass an index
};

function cookId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function getDish(id){ return loadDishes().find(d => d.id === id); }

function updateDish(id, fn){
  const list = loadDishes();
  const d = list.find(x => x.id === id);
  if (!d) return;
  fn(d);
  saveDishes(list);
}

// ── DERIVED ──

function dishStats(d){
  const a = d.attempts || [];
  const rated = a.filter(x => x.stars);
  const avg = rated.length ? rated.reduce((s, x) => s + x.stars, 0) / rated.length : 0;
  const last = a.length ? a.map(x => x.date).sort().slice(-1)[0] : null;
  return { count: a.length, avg, last };
}

function fmtAvg(avg){
  return (Math.round(avg * 10) / 10).toString();
}

function hasRecipe(d){
  return (d.links && d.links.length) || (d.recipe || '').trim();
}

// every technique you've made, kept even when no dish uses it right now
function allCookTags(){
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('theosCookTags') || '[]'); } catch {}
  const seen = new Set(saved);
  loadDishes().forEach(d => (d.tags || []).forEach(t => seen.add(t)));
  return [...seen].sort((a, b) => a.localeCompare(b));
}
// the filter row only offers techniques some dish actually has
function usedCookTags(){
  const seen = new Set();
  loadDishes().forEach(d => (d.tags || []).forEach(t => seen.add(t)));
  return [...seen].sort((a, b) => a.localeCompare(b));
}

// most recent activity first: last cooked, else when it was added
function dishOrder(d){
  return dishStats(d).last || d.added || '';
}

function linkLabel(url){
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').replace(/^m\./, ''); } catch { return 'Link'; }
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'YouTube';
  if (/tiktok\.com$/.test(host)) return 'TikTok';
  if (/instagram\.com$/.test(host)) return 'Instagram';
  return host;
}

function cookDaysAgo(key){
  const n = Math.round((new Date(getTodayKey() + 'T00:00:00') - new Date(key + 'T00:00:00')) / 86400000);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return n + ' days ago';
}

// ── NAVIGATION ──

function cookGo(view, id){
  if (view !== 'dish') cookReleaseWake();
  cookState.view = view;
  cookState.dishId = id || null;
  cookState.cooking = false;
  cookState.editingRecipe = false;
  cookState.more = false;
  renderHobbies();
  window.scrollTo(0, 0);
}
function openDish(id){ cookGo('dish', id); }
function cookBack(){ cookGo('book'); }

// ── RECIPE BOOK (the list) ──

function toggleAddDish(){
  cookState.adding = !cookState.adding;
  renderHobbies();
  if (cookState.adding) {
    const el = document.getElementById('dishName');
    if (el) el.focus();
  }
}

function addDish(){
  const el = document.getElementById('dishName');
  const name = el ? el.value.trim() : '';
  if (!name) return;
  const list = loadDishes();
  list.push({ id: cookId(), name, added: getTodayKey(), links: [], recipe: '',
              difficulty: '', mins: '', tags: [], notes: '', attempts: [] });
  saveDishes(list);
  cookState.adding = false;
  renderHobbies();
}

function cookFilter(kind, i){
  const f = cookState.filter;
  if (kind === 'fast') f.fast = !f.fast;
  if (kind === 'easy' || kind === 'stretch') f.diff = f.diff === kind ? '' : kind;
  if (kind === 'tag') {
    const t = cookState.tagList[i];
    f.tag = f.tag === t ? '' : t;
  }
  renderHobbies();
}

function renderCooking(body){
  if (cookState.view === 'dish') return renderDish(body);

  const all = loadDishes();
  const f = cookState.filter;
  const tags = usedCookTags();
  if (f.tag && !tags.includes(f.tag)) f.tag = '';
  cookState.tagList = tags;

  const shown = all
    .filter(d => !f.fast || (Number(d.mins) > 0 && Number(d.mins) <= COOK_FAST))
    .filter(d => !f.diff || d.difficulty === f.diff)
    .filter(d => !f.tag || (d.tags || []).includes(f.tag))
    .sort((a, b) => dishOrder(b).localeCompare(dishOrder(a)));

  let h = '';

  if (all.length) {
    h += `<div class="cook-filters">
      <button class="bar-chip${f.fast ? ' active' : ''}" onclick="cookFilter('fast')">Under ${COOK_FAST} min</button>
      <button class="bar-chip${f.diff === 'easy' ? ' active' : ''}" onclick="cookFilter('easy')">Easy</button>
      <button class="bar-chip${f.diff === 'stretch' ? ' active' : ''}" onclick="cookFilter('stretch')">Stretch</button>
      ${tags.map((t, i) => `<button class="bar-chip cook-tagchip${f.tag === t ? ' active' : ''}"
          onclick="cookFilter('tag',${i})">${escHtml(t)}</button>`).join('')}
    </div>`;
  }

  h += `<button class="add-book-btn" onclick="toggleAddDish()">${cookState.adding ? '– Close' : '+ Add a dish'}</button>`;
  if (cookState.adding) {
    h += `<div class="add-book-panel">
      <div class="book-search" style="margin-top:0">
        <input type="text" id="dishName" placeholder="A dish you want to learn" autocomplete="off"
               onkeydown="if(event.key==='Enter')addDish()"/>
        <button class="btn btn-add" onclick="addDish()">Add</button>
      </div>
    </div>`;
  }

  if (!all.length) {
    h += `<p class="sync-blurb" style="margin-top:16px">Add a dish you want to learn. A name is enough — the recipe can come later.</p>`;
  } else if (!shown.length) {
    h += `<p class="sync-blurb" style="margin-top:16px">No dishes match those filters.</p>`;
  } else {
    h += `<div class="section-label" style="margin-top:22px">Recipe book</div>`;
    h += shown.map(dishRowHTML).join('');
  }

  body.innerHTML = h;
}

function dishRowHTML(d){
  const s = dishStats(d);
  const bits = [];
  if (d.difficulty) bits.push(d.difficulty === 'easy' ? 'Easy' : 'Stretch');
  if (Number(d.mins) > 0) bits.push(d.mins + ' min');
  const tags = (d.tags || []);

  let right;
  if (s.count) {
    right = `<div class="cook-row-n">Cooked ${s.count}×</div>
             ${s.avg ? `<div class="draw-row-felt">★ ${fmtAvg(s.avg)}</div>` : ''}`;
  } else {
    right = `<div class="cook-row-n untried">Untried</div>`;
  }

  return `<div class="draw-row" onclick="openDish('${d.id}')">
    <div class="draw-row-main">
      <div class="draw-row-top">${escHtml(d.name)}</div>
      ${bits.length ? `<div class="draw-row-sub">${escHtml(bits.join(' · '))}</div>` : ''}
      ${tags.length ? `<div class="cook-tags">${tags.map(t => `<span class="cook-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      ${hasRecipe(d) ? '' : `<div class="cook-norecipe">No recipe yet</div>`}
    </div>
    <div class="draw-row-right">${right}</div>
  </div>`;
}

// ── DISH PAGE ──

function renderDish(body){
  const d = getDish(cookState.dishId);
  if (!d) { cookBack(); return; }
  const s = dishStats(d);
  const tags = allCookTags();
  cookState.tagList = tags;

  let h = `<button class="gym-back" onclick="cookBack()">&lsaquo; Back</button>
           <div class="screen-title" style="padding-top:6px">${escHtml(d.name)}</div>`;

  if (s.count) {
    h += `<div class="read-stats" style="margin-top:12px">
            <div class="read-stat"><span class="rs-n">${s.count}</span><span class="rs-l">${s.count === 1 ? 'time' : 'times'} cooked</span></div>
            ${s.avg ? `<div class="read-stat"><span class="rs-n">★ ${fmtAvg(s.avg)}</span><span class="rs-l">average</span></div>` : ''}
            <div class="read-stat"><span class="rs-n cook-last">${cookDaysAgo(s.last)}</span><span class="rs-l">last cooked</span></div>
          </div>`;
  }

  // ── cooked it ──
  if (cookState.cooking) {
    const cf = cookState.cookForm;
    h += `<div class="add-book-panel" style="margin-top:14px">
      <div class="date-pair"><label>Date<input type="date" id="cookDate" value="${cf.date}"/></label></div>
      <div class="sync-label" style="margin-top:14px">How did it turn out?</div>
      <div class="star-row">${[1,2,3,4,5].map(n =>
        `<button class="star${cf.stars >= n ? ' on' : ''}" onclick="cookSetStars(${cf.stars === n ? 0 : n})">★</button>`
      ).join('')}</div>
      <textarea id="cookNext" class="takeaway" rows="3" style="margin-top:12px"
                placeholder="Next time I'd…">${escHtml(cf.next || '')}</textarea>
      <div class="finish-actions">
        <button class="sync-btn" onclick="cookCancel()">Cancel</button>
        <button class="btn btn-add" onclick="cookSave()">Log it</button>
      </div>
    </div>`;
  } else {
    h += `<button class="cook-did" onclick="cookStart()">Cooked it</button>`;
  }

  // ── links ──
  h += `<div class="section-label" style="margin-top:24px">Links</div>`;
  if (!hasRecipe(d)) h += `<div class="draw-since none" style="margin:0 0 12px">No recipe yet</div>`;
  (d.links || []).forEach((u, i) => {
    h += `<div class="cook-link">
      <a href="${escHtml(u)}" target="_blank" rel="noopener">
        <span class="cook-link-label">${escHtml(linkLabel(u))}</span>
        <span class="cook-link-url">${escHtml(u.replace(/^https?:\/\/(www\.)?/, ''))}</span>
      </a>
      <button class="gym-set-del" onclick="cookRemoveLink(${i})">✕</button>
    </div>`;
  });
  h += `<div class="book-search">
    <input type="url" id="cookLink" placeholder="Paste a recipe or video link" autocomplete="off"
           onkeydown="if(event.key==='Enter')cookAddLink()"/>
    <button class="btn btn-add" onclick="cookAddLink()">Add</button>
  </div>`;

  // ── recipe ──
  h += `<div class="section-label cook-recipe-head" style="margin-top:24px">Recipe</div>`;
  if (cookState.editingRecipe) {
    h += `<textarea id="cookRecipe" class="takeaway" rows="12"
              placeholder="Paste ingredients and steps">${escHtml(d.recipe || '')}</textarea>
          <div class="finish-actions">
            <button class="sync-btn" onclick="cookEditRecipe(false)">Cancel</button>
            <button class="btn btn-add" onclick="cookSaveRecipe()">Save</button>
          </div>`;
  } else if ((d.recipe || '').trim()) {
    h += `<div class="cook-recipe">${escHtml(d.recipe)}</div>
          <div class="cook-recipe-actions">
            ${cookWakeSupported() ? `<button class="bar-chip${cookWake.on ? ' active' : ''}" onclick="cookToggleWake()">
              ${cookWake.on ? 'Screen stays on' : 'Keep screen on'}</button>` : ''}
            <button class="bar-chip" onclick="cookEditRecipe(true)">Edit</button>
          </div>`;
  } else {
    h += `<button class="add-book-btn" style="margin-top:0" onclick="cookEditRecipe(true)">+ Paste a recipe</button>`;
  }

  // ── details ──
  h += `<div class="section-label" style="margin-top:24px">Details</div>`;
  h += `<div class="sync-label">Difficulty</div>
        <div class="bar-row">
          <button class="bar-chip${d.difficulty === 'easy' ? ' active' : ''}" onclick="cookSetDiff('easy')">Easy</button>
          <button class="bar-chip${d.difficulty === 'stretch' ? ' active' : ''}" onclick="cookSetDiff('stretch')">Stretch</button>
        </div>`;
  h += `<div class="sync-label">Minutes</div>
        <div class="draw-mins" style="margin-bottom:12px">
          <input type="number" inputmode="numeric" id="cookMins" value="${d.mins || ''}" placeholder="0"
                 onchange="cookSetMins(this.value, false)"/>
          ${COOK_QUICK_MINS.map(m => `<button class="bar-chip${Number(d.mins) === m ? ' active' : ''}"
              onclick="cookSetMins(${m}, true)">${m}</button>`).join('')}
        </div>`;
  h += `<div class="sync-label">Techniques</div>
        <div class="bar-row" style="margin-bottom:8px">
          ${tags.map((t, i) => `<button class="bar-chip${(d.tags || []).includes(t) ? ' active' : ''}"
              onclick="cookToggleTag(${i})">${escHtml(t)}</button>`).join('')}
          ${tags.length ? '' : '<span class="cook-hint">None yet — add one below.</span>'}
        </div>
        <div class="book-search" style="margin-bottom:12px">
          <input type="text" id="cookNewTag" placeholder="New technique, e.g. stir-fry" autocomplete="off"
                 onkeydown="if(event.key==='Enter')cookAddTag()"/>
          <button class="btn btn-add" onclick="cookAddTag()">Add</button>
        </div>`;
  h += `<div class="sync-label">Notes</div>
        <textarea class="takeaway" rows="3" placeholder="Anything worth remembering"
                  onchange="cookSetNotes(this.value)">${escHtml(d.notes || '')}</textarea>`;

  // ── attempts ──
  const attempts = (d.attempts || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (attempts.length) {
    h += `<div class="section-label" style="margin-top:24px">Every time you've cooked it</div>`;
    h += attempts.map(a => `<div class="cook-attempt">
        <div class="cook-attempt-top">
          <span class="draw-row-date">${shortDate(a.date)}</span>
          <span class="draw-row-felt">${a.stars ? '★'.repeat(a.stars) : ''}</span>
          <button class="gym-set-del" onclick="cookDeleteAttempt('${a.id}')">✕</button>
        </div>
        ${a.next ? `<div class="cook-attempt-next">Next time: ${escHtml(a.next)}</div>` : ''}
      </div>`).join('');
  }

  // ── occasional ──
  h += `<button class="cook-more" onclick="cookToggleMore()">${cookState.more ? 'Less' : 'More'}</button>`;
  if (cookState.more) {
    h += `<div class="add-book-panel">
      <div class="book-search" style="margin-top:0">
        <input type="text" id="cookRename" value="${escHtml(d.name)}" autocomplete="off"/>
        <button class="btn btn-add" onclick="cookRename()">Rename</button>
      </div>
      <button class="sync-btn gym-drop" style="width:100%;margin-top:12px" onclick="cookDeleteDish()">Remove this dish</button>
    </div>`;
  }

  body.innerHTML = h;
}

// ── DISH ACTIONS ──

function cookStart(){
  cookState.cooking = true;
  cookState.cookForm = { date: getTodayKey(), stars: 0, next: '' };
  renderHobbies();
}
function cookCancel(){ cookState.cooking = false; renderHobbies(); }

// re-rendering for a star tap would lose typed text; pull it into state first
function cookSyncForm(){
  const dt = document.getElementById('cookDate');
  const nx = document.getElementById('cookNext');
  if (dt) cookState.cookForm.date = dt.value;
  if (nx) cookState.cookForm.next = nx.value;
}
function cookSetStars(n){
  cookSyncForm();
  cookState.cookForm.stars = n;
  renderHobbies();
}
function cookSave(){
  cookSyncForm();
  const cf = cookState.cookForm;
  updateDish(cookState.dishId, d => {
    d.attempts = d.attempts || [];
    d.attempts.push({ id: cookId(), date: cf.date || getTodayKey(), stars: cf.stars || 0, next: (cf.next || '').trim() });
  });
  cookState.cooking = false;
  renderHobbies();
}
function cookDeleteAttempt(aid){
  if (!confirm('Delete this entry?')) return;
  updateDish(cookState.dishId, d => { d.attempts = (d.attempts || []).filter(a => a.id !== aid); });
  renderHobbies();
}

function cookAddLink(){
  const el = document.getElementById('cookLink');
  let u = el ? el.value.trim() : '';
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { new URL(u); } catch { return; }
  updateDish(cookState.dishId, d => { d.links = d.links || []; d.links.push(u); });
  renderHobbies();
}
function cookRemoveLink(i){
  updateDish(cookState.dishId, d => { d.links.splice(i, 1); });
  renderHobbies();
}

function cookEditRecipe(on){
  cookState.editingRecipe = on;
  renderHobbies();
  if (on) { const el = document.getElementById('cookRecipe'); if (el) el.focus(); }
}
function cookSaveRecipe(){
  const el = document.getElementById('cookRecipe');
  const v = el ? el.value : '';
  updateDish(cookState.dishId, d => { d.recipe = v.trim(); });
  cookState.editingRecipe = false;
  renderHobbies();
}

function cookSetDiff(v){
  updateDish(cookState.dishId, d => { d.difficulty = d.difficulty === v ? '' : v; });
  renderHobbies();
}
function cookSetMins(v, rerender){
  const n = parseInt(v) || '';
  updateDish(cookState.dishId, d => { d.mins = (rerender && Number(d.mins) === n) ? '' : n; });
  if (rerender) renderHobbies();
}
function cookToggleTag(i){
  const t = cookState.tagList[i];
  if (!t) return;
  updateDish(cookState.dishId, d => {
    d.tags = d.tags || [];
    d.tags = d.tags.includes(t) ? d.tags.filter(x => x !== t) : d.tags.concat(t);
  });
  renderHobbies();
}
function cookAddTag(){
  const el = document.getElementById('cookNewTag');
  const raw = el ? el.value.trim() : '';
  if (!raw) return;
  // reuse an existing tag if it only differs by case
  const known = allCookTags();
  const t = known.find(x => x.toLowerCase() === raw.toLowerCase()) || raw.toLowerCase();
  if (!known.includes(t)) {
    localStorage.setItem('theosCookTags', JSON.stringify(known.concat(t)));
  }
  updateDish(cookState.dishId, d => {
    d.tags = d.tags || [];
    if (!d.tags.includes(t)) d.tags.push(t);
  });
  renderHobbies();
}
function cookSetNotes(v){
  updateDish(cookState.dishId, d => { d.notes = v; });
}

function cookToggleMore(){ cookState.more = !cookState.more; renderHobbies(); }
function cookRename(){
  const el = document.getElementById('cookRename');
  const v = el ? el.value.trim() : '';
  if (!v) return;
  updateDish(cookState.dishId, d => { d.name = v; });
  cookState.more = false;
  renderHobbies();
}
function cookDeleteDish(){
  const d = getDish(cookState.dishId);
  if (!d || !confirm(`Remove ${d.name} and everything logged for it?`)) return;
  saveDishes(loadDishes().filter(x => x.id !== d.id));
  cookBack();
}

// ── KEEP SCREEN ON ──
// Only while a dish page is open. The phone drops the lock itself when the app
// is hidden, so it's re-requested on return.

let cookWake = { on:false, lock:null };

function cookWakeSupported(){ return typeof navigator !== 'undefined' && 'wakeLock' in navigator; }

async function cookRequestWake(){
  try {
    cookWake.lock = await navigator.wakeLock.request('screen');
    cookWake.lock.addEventListener && cookWake.lock.addEventListener('release', () => { cookWake.lock = null; });
  } catch { cookWake.on = false; renderHobbies(); }
}

function cookToggleWake(){
  if (cookWake.on) { cookReleaseWake(); renderHobbies(); return; }
  cookWake.on = true;
  cookRequestWake();
  renderHobbies();
}

function cookReleaseWake(){
  cookWake.on = false;
  if (cookWake.lock) { try { cookWake.lock.release(); } catch {} }
  cookWake.lock = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cookWake.on && !cookWake.lock) cookRequestWake();
  });
  // leaving for another tab ends it
  document.addEventListener('click', e => {
    if (cookWake.on && e.target.closest && e.target.closest('.tabbtn')) cookReleaseWake();
  }, true);
}
