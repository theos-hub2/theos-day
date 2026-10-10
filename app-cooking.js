// theo's day — app-cooking.js
// Three jobs, three screens:
//   Recipe book  — browse and plan (the list, and each dish's page)
//   Cook mode    — doing it: big checkable ingredients and steps, screen kept on
//   Groceries    — shopping: one checklist, fed by hand or from any dish
// A dish can exist as just a name and pick up links, ingredients, steps and
// details later. Finishing a cook logs an attempt — date, stars, what you'd
// change — which is where times cooked and the average come from.

const COOK_QUICK_MINS = [15, 20, 30, 45, 60];
const COOK_FAST = 20;   // the "under 20 min" filter

// ── STORAGE ──

function loadDishes(){
  let list;
  try { list = JSON.parse(localStorage.getItem('theosDishes') || '[]'); }
  catch { return []; }
  // the first version had one recipe box; it becomes the steps
  list.forEach(d => {
    if (d.recipe !== undefined) {
      if (d.recipe && !d.steps) d.steps = d.recipe;
      delete d.recipe;
    }
  });
  return list;
}
function saveDishes(list){
  localStorage.setItem('theosDishes', JSON.stringify(list));
  if (typeof queueSync === 'function') queueSync();
}

function loadGroceries(){
  try { return JSON.parse(localStorage.getItem('theosGroceries') || '[]'); }
  catch { return []; }
}
function saveGroceries(list){
  localStorage.setItem('theosGroceries', JSON.stringify(list));
  if (typeof queueSync === 'function') queueSync();
}

// things you've put on the list before, newest first — feeds autocomplete
function loadGroceryPast(){
  try { return JSON.parse(localStorage.getItem('theosGroceryPast') || '[]'); }
  catch { return []; }
}
function rememberGrocery(text){
  const past = loadGroceryPast().filter(x => x.toLowerCase() !== text.toLowerCase());
  past.unshift(text);
  localStorage.setItem('theosGroceryPast', JSON.stringify(past.slice(0, 300)));
}

// checks made during a cook — a guide, not history. Kept per dish until you
// finish or stop, so leaving the screen mid-cook loses nothing.
function loadCookProgress(){
  try { return JSON.parse(localStorage.getItem('theosCookProgress') || '{}'); }
  catch { return {}; }
}
function saveCookProgress(p){ localStorage.setItem('theosCookProgress', JSON.stringify(p)); }
function dishProgress(id){
  const p = loadCookProgress()[id];
  return p ? { ing: p.ing || [], steps: p.steps || [] } : null;
}
function clearDishProgress(id){
  const p = loadCookProgress();
  delete p[id];
  saveCookProgress(p);
}

// ── STATE ──

let cookState = {
  view: 'book',          // 'book' · 'groceries' · 'dish' · 'cook'
  dishId: null,
  adding: false,
  filter: { fast:false, diff:'', tag:'' },
  cooking: false,        // the log panel (finish, or a past cook)
  cookForm: {},
  editing: '',           // 'ingredients' · 'steps' · 'details' on the dish page
  more: false,
  groEdit: null,         // grocery item being edited
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

function fmtAvg(avg){ return (Math.round(avg * 10) / 10).toString(); }

function hasRecipe(d){
  return (d.links && d.links.length) || (d.ingredients || '').trim() || (d.steps || '').trim();
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
function dishOrder(d){ return dishStats(d).last || d.added || ''; }

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

// One line is one item. A short line ending in a colon ("Rice:") starts a
// new box, which is how a multi-pot meal splits into parts. Pasted bullets
// and numbers are stripped — cook mode numbers steps itself.
function parseRecipeLines(text){
  const groups = [];
  let cur = { title:'', items:[] };
  let i = 0;
  (text || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    if (/:$/.test(line) && line.length <= 40) {
      if (cur.title || cur.items.length) groups.push(cur);
      cur = { title: line.slice(0, -1).trim(), items:[] };
      return;
    }
    const clean = line.replace(/^([-•*·]|\d+[.)]|step\s*\d+[:.)]?)\s*/i, '').trim();
    if (clean) cur.items.push({ text: clean, i: i++ });
  });
  if (cur.title || cur.items.length) groups.push(cur);
  return groups;
}
function recipeItemCount(text){
  return parseRecipeLines(text).reduce((n, g) => n + g.items.length, 0);
}

function onGroceryList(text){
  const t = text.toLowerCase();
  return loadGroceries().some(g => !g.done && g.text.toLowerCase() === t);
}

// ── NAVIGATION ──

function cookGo(view, id){
  if (view !== 'cook') cookReleaseWake();
  cookState.view = view;
  if (id !== undefined) cookState.dishId = id;
  if (view === 'book' || view === 'groceries') cookState.dishId = null;
  cookState.cooking = false;
  cookState.editing = '';
  cookState.more = false;
  cookState.groEdit = null;
  renderHobbies();
  window.scrollTo(0, 0);
}
function openDish(id){ cookGo('dish', id); }
function cookBack(){ cookGo('book'); }

function cookSwitchHTML(){
  const n = loadGroceries().filter(g => !g.done).length;
  return `<div class="cook-switch">
    <button class="${cookState.view === 'book' ? 'on' : ''}" onclick="cookGo('book')">Recipe book</button>
    <button class="${cookState.view === 'groceries' ? 'on' : ''}" onclick="cookGo('groceries')">Groceries${n ? ` <span class="cook-switch-n">${n}</span>` : ''}</button>
  </div>`;
}

function renderCooking(body){
  if (cookState.view === 'dish') return renderDish(body);
  if (cookState.view === 'cook') return renderCookMode(body);
  if (cookState.view === 'groceries') return renderGroceries(body);
  return renderRecipeBook(body);
}

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
  list.push({ id: cookId(), name, added: getTodayKey(), links: [], ingredients: '', steps: '',
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

function renderRecipeBook(body){
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

  let h = cookSwitchHTML();

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

function detailBits(d){
  const bits = [];
  if (d.difficulty) bits.push(d.difficulty === 'easy' ? 'Easy' : 'Stretch');
  if (Number(d.mins) > 0) bits.push(d.mins + ' min');
  return bits;
}

function tagPillsHTML(d){
  const tags = d.tags || [];
  return tags.length ? `<div class="cook-tags">${tags.map(t => `<span class="cook-tag">${escHtml(t)}</span>`).join('')}</div>` : '';
}

function dishRowHTML(d){
  const s = dishStats(d);
  const bits = detailBits(d);
  const right = s.count
    ? `<div class="cook-row-n">Cooked ${s.count}×</div>
       ${s.avg ? `<div class="draw-row-felt">★ ${fmtAvg(s.avg)}</div>` : ''}`
    : `<div class="cook-row-n untried">Untried</div>`;

  return `<div class="draw-row" onclick="openDish('${d.id}')">
    <div class="draw-row-main">
      <div class="draw-row-top">${escHtml(d.name)}</div>
      ${bits.length ? `<div class="draw-row-sub">${escHtml(bits.join(' · '))}</div>` : ''}
      ${tagPillsHTML(d)}
      ${hasRecipe(d) ? '' : `<div class="cook-norecipe">No recipe yet</div>`}
    </div>
    <div class="draw-row-right">${right}</div>
  </div>`;
}

// ── DISH PAGE (planning) ──

function renderDish(body){
  const d = getDish(cookState.dishId);
  if (!d) { cookBack(); return; }
  const s = dishStats(d);
  const tags = allCookTags();
  cookState.tagList = tags;
  const bits = detailBits(d);
  const inProgress = dishProgress(d.id);

  let h = `<button class="gym-back" onclick="cookBack()">&lsaquo; Back</button>
           <div class="screen-title" style="padding-top:6px">${escHtml(d.name)}</div>`;

  // details: set once, so they sit quietly under the title
  if (cookState.editing === 'details') {
    h += detailsEditHTML(d, tags);
  } else if (bits.length || (d.tags || []).length) {
    h += `<div class="cook-details" onclick="cookEdit('details')">
            ${bits.length ? `<span>${escHtml(bits.join(' · '))}</span>` : ''}
            ${tagPillsHTML(d)}
          </div>`;
  } else {
    h += `<button class="cook-addline" onclick="cookEdit('details')">+ Time, difficulty, techniques</button>`;
  }

  if (s.count) {
    h += `<div class="read-stats" style="margin-top:12px">
            <div class="read-stat"><span class="rs-n">${s.count}</span><span class="rs-l">${s.count === 1 ? 'time' : 'times'} cooked</span></div>
            ${s.avg ? `<div class="read-stat"><span class="rs-n">★ ${fmtAvg(s.avg)}</span><span class="rs-l">average</span></div>` : ''}
            <div class="read-stat"><span class="rs-n cook-last">${cookDaysAgo(s.last)}</span><span class="rs-l">last cooked</span></div>
          </div>`;
  }

  if (cookState.cooking) {
    h += logPanelHTML('Log a past cook');
  } else {
    h += `<button class="cook-did" onclick="startCooking()">${inProgress ? 'Continue cooking' : "Let's cook"}</button>`;
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

  h += recipeSectionHTML(d, 'ingredients');
  h += recipeSectionHTML(d, 'steps');

  h += `<div class="section-label" style="margin-top:24px">Notes</div>
        <textarea class="takeaway" rows="3" placeholder="Anything worth remembering"
                  onchange="cookSetNotes(this.value)">${escHtml(d.notes || '')}</textarea>`;

  // ── history ──
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
      <div class="cook-more-row">
        <button class="sync-btn" onclick="cookEdit('details')">Edit details</button>
        <button class="sync-btn" onclick="cookLogPast()">Log a past cook</button>
      </div>
      <div class="book-search">
        <input type="text" id="cookRename" value="${escHtml(d.name)}" autocomplete="off"/>
        <button class="btn btn-add" onclick="cookRename()">Rename</button>
      </div>
      <button class="sync-btn gym-drop" style="width:100%;margin-top:12px" onclick="cookDeleteDish()">Remove this dish</button>
    </div>`;
  }

  body.innerHTML = h;
}

function detailsEditHTML(d, tags){
  return `<div class="add-book-panel" style="margin-top:12px">
    <div class="sync-label">Difficulty</div>
    <div class="bar-row">
      <button class="bar-chip${d.difficulty === 'easy' ? ' active' : ''}" onclick="cookSetDiff('easy')">Easy</button>
      <button class="bar-chip${d.difficulty === 'stretch' ? ' active' : ''}" onclick="cookSetDiff('stretch')">Stretch</button>
    </div>
    <div class="sync-label">Minutes</div>
    <div class="draw-mins" style="margin-bottom:12px">
      <input type="number" inputmode="numeric" id="cookMins" value="${d.mins || ''}" placeholder="0"
             onchange="cookSetMins(this.value, false)"/>
      ${COOK_QUICK_MINS.map(m => `<button class="bar-chip${Number(d.mins) === m ? ' active' : ''}"
          onclick="cookSetMins(${m}, true)">${m}</button>`).join('')}
    </div>
    <div class="sync-label">Techniques</div>
    <div class="bar-row" style="margin-bottom:8px">
      ${tags.map((t, i) => `<button class="bar-chip${(d.tags || []).includes(t) ? ' active' : ''}"
          onclick="cookToggleTag(${i})">${escHtml(t)}</button>`).join('')}
      ${tags.length ? '' : '<span class="cook-hint">None yet — add one below.</span>'}
    </div>
    <div class="book-search" style="margin-top:0">
      <input type="text" id="cookNewTag" placeholder="New technique, e.g. stir-fry" autocomplete="off"
             onkeydown="if(event.key==='Enter')cookAddTag()"/>
      <button class="btn btn-add" onclick="cookAddTag()">Add</button>
    </div>
    <button class="sync-btn" style="width:100%;margin-top:12px" onclick="cookEdit('')">Done</button>
  </div>`;
}

const RECIPE_COPY = {
  ingredients: { title:'Ingredients', add:'+ Add ingredients',
                 hint:'One per line. A line ending in a colon, like "Sauce:", starts a group.' },
  steps:       { title:'Steps', add:'+ Add steps',
                 hint:'One step per line. For a meal with parts, put "Rice:", "Beans:" and so on above each part — cook mode gives each its own box.' }
};

function recipeSectionHTML(d, field){
  const c = RECIPE_COPY[field];
  const text = d[field] || '';
  let h = `<div class="section-label" style="margin-top:24px">${c.title}</div>`;

  if (cookState.editing === field) {
    return h + `<p class="cook-hint" style="margin-bottom:8px">${c.hint}</p>
      <textarea id="cookText" class="takeaway" rows="10">${escHtml(text)}</textarea>
      <div class="finish-actions">
        <button class="sync-btn" onclick="cookEdit('')">Cancel</button>
        <button class="btn btn-add" onclick="cookSaveText('${field}')">Save</button>
      </div>`;
  }

  const groups = parseRecipeLines(text);
  if (!groups.length) {
    return h + `<button class="add-book-btn" style="margin-top:0" onclick="cookEdit('${field}')">${c.add}</button>`;
  }

  if (field === 'ingredients') {
    const all = groups.flatMap(g => g.items);
    const allOn = all.every(it => onGroceryList(it.text));
    h += groups.map(g => `
      ${g.title ? `<div class="cook-group-title">${escHtml(g.title)}</div>` : ''}
      ${g.items.map(it => {
        const on = onGroceryList(it.text);
        return `<div class="cook-ing">
          <span>${escHtml(it.text)}</span>
          <button class="cook-ing-add${on ? ' on' : ''}" onclick="cookAddIngredient(${it.i})"
                  aria-label="Add to groceries">${on ? '✓' : '+'}</button>
        </div>`;
      }).join('')}`).join('');
    h += `<div class="cook-recipe-actions">
      <button class="bar-chip${allOn ? ' active' : ''}" onclick="cookAddAllIngredients()">${allOn ? 'All on the list' : 'Add all to groceries'}</button>
      <button class="bar-chip" onclick="cookEdit('ingredients')">Edit</button>
    </div>`;
  } else {
    h += groups.map(g => `
      ${g.title ? `<div class="cook-group-title">${escHtml(g.title)}</div>` : ''}
      <ol class="cook-steps">${g.items.map(it => `<li>${escHtml(it.text)}</li>`).join('')}</ol>`).join('');
    h += `<div class="cook-recipe-actions">
      <button class="bar-chip" onclick="cookEdit('steps')">Edit</button>
    </div>`;
  }
  return h;
}

function logPanelHTML(title){
  const cf = cookState.cookForm;
  return `<div class="add-book-panel" style="margin-top:14px">
    <div class="finish-title">${title}</div>
    <div class="date-pair" style="margin-top:10px"><label>Date<input type="date" id="cookDate" value="${cf.date}"/></label></div>
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
}

// ── DISH ACTIONS ──

function cookEdit(what){
  cookState.editing = what;
  cookState.more = false;
  renderHobbies();
  const el = document.getElementById(what === 'details' ? 'cookMins' : 'cookText');
  if (el && what !== 'details') el.focus();
}
function cookSaveText(field){
  const el = document.getElementById('cookText');
  const v = el ? el.value.trim() : '';
  updateDish(cookState.dishId, d => { d[field] = v; });
  cookState.editing = '';
  renderHobbies();
}

function cookLogPast(){
  cookState.more = false;
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
  const id = cookState.dishId;
  updateDish(id, d => {
    d.attempts = d.attempts || [];
    d.attempts.push({ id: cookId(), date: cf.date || getTodayKey(), stars: cf.stars || 0, next: (cf.next || '').trim() });
  });
  // finishing from cook mode ends that cook
  if (cookState.view === 'cook') { clearDishProgress(id); cookGo('dish', id); return; }
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
  if (!known.includes(t)) localStorage.setItem('theosCookTags', JSON.stringify(known.concat(t)));
  updateDish(cookState.dishId, d => {
    d.tags = d.tags || [];
    if (!d.tags.includes(t)) d.tags.push(t);
  });
  renderHobbies();
}
function cookSetNotes(v){ updateDish(cookState.dishId, d => { d.notes = v; }); }

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
  clearDishProgress(d.id);
  cookBack();
}

// ingredients → groceries
function ingredientItems(d){ return parseRecipeLines(d.ingredients).flatMap(g => g.items); }

function addToGroceries(text, dish){
  if (onGroceryList(text)) return false;
  const list = loadGroceries();
  list.push({ id: cookId(), text, done:false, dishId: dish ? dish.id : '', dishName: dish ? dish.name : '' });
  saveGroceries(list);
  rememberGrocery(text);
  return true;
}
function cookAddIngredient(i){
  const d = getDish(cookState.dishId);
  const it = d && ingredientItems(d).find(x => x.i === i);
  if (!it) return;
  if (onGroceryList(it.text)) {
    // tapping a ✓ takes it back off
    saveGroceries(loadGroceries().filter(g => g.done || g.text.toLowerCase() !== it.text.toLowerCase()));
  } else {
    addToGroceries(it.text, d);
  }
  renderHobbies();
}
function cookAddAllIngredients(){
  const d = getDish(cookState.dishId);
  if (!d) return;
  ingredientItems(d).forEach(it => addToGroceries(it.text, d));
  renderHobbies();
}

// ── COOK MODE (doing) ──

function startCooking(){
  const id = cookState.dishId;
  const p = loadCookProgress();
  if (!p[id]) { p[id] = { ing:[], steps:[], started: getTodayKey() }; saveCookProgress(p); }
  cookGo('cook', id);
}

function cookTick(kind, i){
  const p = loadCookProgress();
  const cur = p[cookState.dishId] || (p[cookState.dishId] = { ing:[], steps:[] });
  const arr = cur[kind] || (cur[kind] = []);
  const at = arr.indexOf(i);
  if (at >= 0) arr.splice(at, 1); else arr.push(i);
  saveCookProgress(p);
  renderHobbies();
}

function cookFinish(){
  cookState.cooking = true;
  cookState.cookForm = { date: getTodayKey(), stars: 0, next: '' };
  renderHobbies();
  const el = document.querySelector('.cook-finish-anchor');
  if (el && el.scrollIntoView) el.scrollIntoView({ block:'start' });
}

function cookStop(){
  if (!confirm('Stop cooking without logging it?')) return;
  const id = cookState.dishId;
  clearDishProgress(id);
  cookGo('dish', id);
}

function checklistHTML(groups, done, kind, numbered){
  return groups.map(g => `<div class="cook-box">
      ${g.title ? `<div class="cook-box-title">${escHtml(g.title)}</div>` : ''}
      ${g.items.map((it, n) => {
        const on = done.includes(it.i);
        return `<button class="cook-check${on ? ' on' : ''}" onclick="cookTick('${kind}',${it.i})">
          <span class="cook-check-dot">${on ? '✓' : (numbered ? n + 1 : '')}</span>
          <span class="cook-check-text">${escHtml(it.text)}</span>
        </button>`;
      }).join('')}
    </div>`).join('');
}

function renderCookMode(body){
  const d = getDish(cookState.dishId);
  if (!d) { cookBack(); return; }
  cookEnsureWake();
  const prog = dishProgress(d.id) || { ing:[], steps:[] };
  const ing = parseRecipeLines(d.ingredients);
  const steps = parseRecipeLines(d.steps);
  const total = recipeItemCount(d.ingredients) + recipeItemCount(d.steps);
  const done = prog.ing.length + prog.steps.length;

  let h = `<div class="cook-mode-top">
      <button class="gym-back" onclick="cookGo('dish','${d.id}')">&lsaquo; Dish</button>
      ${total ? `<span class="cook-progress">${done} of ${total}</span>` : ''}
    </div>
    <div class="screen-title" style="padding-top:4px">${escHtml(d.name)}</div>
    ${cookWake.on ? '<div class="cook-awake">Screen stays on while you cook</div>' : ''}`;

  if ((d.links || []).length) {
    h += `<div class="cook-mode-links">${d.links.map(u =>
      `<a class="bar-chip" href="${escHtml(u)}" target="_blank" rel="noopener">${escHtml(linkLabel(u))}</a>`).join('')}</div>`;
  }

  if (!total) {
    h += `<p class="sync-blurb" style="margin-top:16px">Nothing to tick off yet. Add ingredients and steps on the dish page, or cook from the link and finish when you're done.</p>`;
  }

  if (ing.length) {
    h += `<div class="section-label" style="margin-top:20px">Ingredients</div>`;
    h += checklistHTML(ing, prog.ing, 'ing', false);
  }
  if (steps.length) {
    h += `<div class="section-label" style="margin-top:22px">Steps</div>`;
    h += checklistHTML(steps, prog.steps, 'steps', true);
  }

  h += '<div class="cook-finish-anchor"></div>';
  if (cookState.cooking) {
    h += logPanelHTML('Finished ' + escHtml(d.name));
  } else {
    h += `<button class="cook-did" style="margin-top:22px" onclick="cookFinish()">Finish</button>
          <button class="cook-more" style="margin-top:14px" onclick="cookStop()">Stop without logging</button>`;
  }

  body.innerHTML = h;
}

// ── GROCERIES (shopping) ──

function addGroceryManual(){
  const el = document.getElementById('groceryNew');
  const v = el ? el.value.trim() : '';
  if (!v) return;
  addToGroceries(v, null);
  renderHobbies();
  const again = document.getElementById('groceryNew');
  if (again) again.focus();
}

function groceryToggle(id){
  const list = loadGroceries();
  const g = list.find(x => x.id === id);
  if (!g) return;
  g.done = !g.done;
  saveGroceries(list);
  renderHobbies();
}
function groceryStartEdit(id){
  cookState.groEdit = id;
  renderHobbies();
  const el = document.getElementById('groceryEditInput');
  if (el) { el.focus(); el.select && el.select(); }
}
function grocerySaveEdit(){
  const el = document.getElementById('groceryEditInput');
  const v = el ? el.value.trim() : '';
  if (!v) return groceryDelete();
  const list = loadGroceries();
  const g = list.find(x => x.id === cookState.groEdit);
  if (g) { g.text = v; rememberGrocery(v); }
  saveGroceries(list);
  cookState.groEdit = null;
  renderHobbies();
}
function groceryDelete(){
  saveGroceries(loadGroceries().filter(x => x.id !== cookState.groEdit));
  cookState.groEdit = null;
  renderHobbies();
}
function groceryClearChecked(){
  saveGroceries(loadGroceries().filter(x => !x.done));
  renderHobbies();
}

function groceryDishLabel(g){
  if (!g.dishId) return '';
  const d = getDish(g.dishId);
  return d ? d.name : (g.dishName || '');
}

function renderGroceries(body){
  const list = loadGroceries();
  const open = list.filter(g => !g.done);
  const got = list.filter(g => g.done);
  const past = loadGroceryPast().filter(p => !open.some(g => g.text.toLowerCase() === p.toLowerCase())).slice(0, 80);

  let h = cookSwitchHTML();
  h += `<div class="book-search" style="margin-top:18px">
      <input type="text" id="groceryNew" list="groceryPast" placeholder="Add something" autocomplete="off"
             onkeydown="if(event.key==='Enter')addGroceryManual()"/>
      <button class="btn btn-add" onclick="addGroceryManual()">Add</button>
    </div>
    <datalist id="groceryPast">${past.map(p => `<option value="${escHtml(p)}"></option>`).join('')}</datalist>`;

  if (!list.length) {
    h += `<p class="sync-blurb" style="margin-top:16px">Nothing on the list. Add things as you think of them, or tap + next to a dish's ingredients.</p>`;
    body.innerHTML = h;
    return;
  }

  h += `<div class="gro-list">${open.map(groceryRowHTML).join('')}</div>`;
  if (got.length) {
    h += `<div class="section-label" style="margin-top:22px">Got it</div>
          <div class="gro-list">${got.map(groceryRowHTML).join('')}</div>
          <button class="sync-btn" style="width:100%;margin-top:12px" onclick="groceryClearChecked()">Clear checked</button>`;
  }
  h += `<p class="cook-hint" style="margin-top:16px;text-align:center">Tap to tick · press and hold to edit</p>`;

  body.innerHTML = h;
  bindGroceryRows(body);
}

function groceryRowHTML(g){
  if (cookState.groEdit === g.id) {
    return `<div class="gro-edit">
      <input type="text" id="groceryEditInput" value="${escHtml(g.text)}" autocomplete="off"
             onkeydown="if(event.key==='Enter')grocerySaveEdit()"/>
      <div class="gro-edit-actions">
        <button class="sync-btn gym-drop" onclick="groceryDelete()">Delete</button>
        <button class="btn btn-add" onclick="grocerySaveEdit()">Save</button>
      </div>
    </div>`;
  }
  const label = groceryDishLabel(g);
  return `<div class="gro-row${g.done ? ' done' : ''}" data-gid="${g.id}">
    <span class="gro-dot">${g.done ? '✓' : ''}</span>
    <span class="gro-text">${escHtml(g.text)}${label ? `<span class="gro-for">for ${escHtml(label)}</span>` : ''}</span>
  </div>`;
}

// tap ticks, press-and-hold edits. Moving your thumb (scrolling) cancels both.
const GRO_HOLD_MS = 450;
function bindGroceryRows(root){
  root.querySelectorAll('.gro-row').forEach(row => {
    const id = row.dataset.gid;
    let timer = null, held = false, startY = null;
    const cancel = () => { clearTimeout(timer); timer = null; row.classList.remove('pressing'); };
    row.addEventListener('pointerdown', e => {
      held = false;
      startY = typeof e.clientY === 'number' ? e.clientY : null;
      row.classList.add('pressing');
      timer = setTimeout(() => {
        held = true;
        row.classList.remove('pressing');
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
        groceryStartEdit(id);
      }, GRO_HOLD_MS);
    });
    row.addEventListener('pointermove', e => {
      if (timer && startY !== null && typeof e.clientY === 'number' && Math.abs(e.clientY - startY) > 8) cancel();
    });
    row.addEventListener('pointerup', cancel);
    row.addEventListener('pointercancel', cancel);
    row.addEventListener('pointerleave', cancel);
    row.addEventListener('contextmenu', e => e.preventDefault());
    row.addEventListener('click', () => {
      if (held) { held = false; return; }
      groceryToggle(id);
    });
  });
}

// ── KEEP SCREEN ON ──
// Automatic in cook mode, released on leaving it. The phone drops the lock
// itself when the app is hidden, so it's re-requested on return.

let cookWake = { on:false, lock:null };

function cookWakeSupported(){ return typeof navigator !== 'undefined' && 'wakeLock' in navigator; }

function cookEnsureWake(){
  if (!cookWakeSupported() || cookWake.on) return;
  cookWake.on = true;
  cookRequestWake();
}

async function cookRequestWake(){
  try {
    cookWake.lock = await navigator.wakeLock.request('screen');
    if (cookWake.lock && cookWake.lock.addEventListener)
      cookWake.lock.addEventListener('release', () => { cookWake.lock = null; });
  } catch { cookWake.lock = null; }
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
  // leaving for another tab ends it; coming back to cook mode starts it again
  document.addEventListener('click', e => {
    if (cookWake.on && e.target.closest && e.target.closest('.tabbtn')) cookReleaseWake();
  }, true);
}
