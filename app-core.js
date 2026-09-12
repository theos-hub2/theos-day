// theo's day — app-core.js
// Part of the app. Loaded by index.html in order; every function is global.

  // Normalize task name for streak comparison
  function normalizeTaskName(name) {
    return name.toLowerCase().trim();
  }

  // Calculate streaks
  // ── STREAKS ──
  // Each habit carries its own schedule. Daily habits break the moment you miss
  // a day; frequency habits are judged per week (or per fortnight), so rest days
  // don't count against you.

  function loadSchedules(){
    try { return JSON.parse(localStorage.getItem('theosStreakSchedules') || '{}'); }
    catch { return {}; }
  }
  function saveSchedules(s){ localStorage.setItem('theosStreakSchedules', JSON.stringify(s)); }

  function medianOf(nums){
    if (!nums.length) return 0;
    const s = nums.slice().sort((a,b) => a-b);
    const m = Math.floor(s.length/2);
    return s.length % 2 ? s[m] : Math.round((s[m-1] + s[m]) / 2);
  }

  // weeks since a fixed Sunday, so fortnights line up consistently
  function weekIndex(d){
    const ws = weekStartOf(d);
    return Math.round((ws - new Date(1970,0,4)) / (7*86400000));
  }

  // How the run is shown. The schedule decides whether a streak survives; the
  // unit only decides how it reads. A daily habit can be counted in days, weeks
  // or months; a weekly one can't sensibly be shown in days.
  function defaultUnit(sch){ return sch.type === 'daily' ? 'days' : 'weeks'; }

  function unitOptions(sch){
    if (sch.type === 'none') return [];
    return sch.type === 'daily' ? ['days','weeks','months'] : ['weeks','months'];
  }

  function streakDisplay(n, sch){
    const unit = sch.unit || defaultUnit(sch);
    const perNative = sch.type === 'daily' ? 1 : (sch.type === 'biweekly' ? 14 : 7);
    const spanDays = n * perNative;

    if (unit === 'months') {
      const m = Math.floor(spanDays / 30.44);
      if (m >= 1) return { v: m, u: 'month' };
    }
    if (unit === 'months' || unit === 'weeks') {
      const wk = Math.floor(spanDays / 7);
      if (wk >= 1) return { v: wk, u: 'week' };
    }
    if (sch.type === 'daily') return { v: n, u: 'day' };
    return { v: n, u: sch.type === 'biweekly' ? 'block' : 'week' };
  }

  function scheduleLabel(sch){
    if (sch.type === 'none') return 'not tracked';
    if (sch.type === 'daily') return 'every day';
    if (sch.type === 'biweekly') return 'once every 2 weeks';
    return sch.times === 1 ? 'once a week' : sch.times + '× per week';
  }

  function scheduleCode(sch){
    if (sch.type === 'none') return 'none';
    if (sch.type === 'daily') return 'daily';
    if (sch.type === 'biweekly') return 'b1';
    return 'w' + sch.times;
  }

  function codeToSchedule(code){
    if (code === 'none') return { type:'none' };
    if (code === 'daily') return { type:'daily' };
    if (code === 'b1') return { type:'biweekly', times:1 };
    return { type:'weekly', times: parseInt(code.slice(1)) || 1 };
  }

  // Everything starts as a daily streak. Guessing from history was clever but
  // opaque — you couldn't tell what the app had decided or why.
  function inferSchedule(){ return { type: 'daily' }; }

  // every completed task, bucketed by day and by week
  function streakData(){
    const data = loadData();
    const map = {};
    Object.entries(data).forEach(([dateKey, day]) => {
      if (!day.tasks) return;
      const wk = ymd(weekStartOf(new Date(dateKey + 'T00:00:00')));
      day.tasks.forEach(t => {
        if (!t.done) return;
        const norm = normalizeTaskName(t.text);
        if (!map[norm]) map[norm] = { display: t.text, days: new Set(), weeks: {}, total: 0 };
        map[norm].days.add(dateKey);
        map[norm].weeks[wk] = (map[norm].weeks[wk] || 0) + 1;
        map[norm].total++;
      });
    });
    return map;
  }

  function scheduleFor(norm, info){
    return loadSchedules()[norm] || inferSchedule();
  }

  function runLength(info, sch){
    const today = getTodayKey();

    if (sch.type === 'daily') {
      const d = new Date();
      let n = 0, guard = 0;
      while (guard++ < 2000) {
        const k = ymd(d);
        if (info.days.has(k)) n++;
        else if (k === today) { /* today isn't a miss yet */ }
        else break;
        d.setDate(d.getDate() - 1);
      }
      return n;
    }

    const size = sch.type === 'biweekly' ? 2 : 1;
    const need = sch.times || 1;
    const perPeriod = {};
    Object.entries(info.weeks).forEach(([wk, c]) => {
      const idx = Math.floor(weekIndex(new Date(wk + 'T00:00:00')) / size);
      perPeriod[idx] = (perPeriod[idx] || 0) + c;
    });

    const current = Math.floor(weekIndex(new Date()) / size);
    let p = current, n = 0, guard = 0;
    while (guard++ < 520) {
      const c = perPeriod[p] || 0;
      if (c >= need) n++;
      else if (p === current) { /* period still in progress */ }
      else break;
      p--;
    }
    return n;
  }

  function calculateStreaks(){
    const map = streakData();
    const out = {};
    Object.entries(map).forEach(([norm, info]) => {
      const sch = scheduleFor(norm, info);
      if (sch.type === 'none') return;          // deliberately not tracked
      const n = runLength(info, sch);
      const min = sch.type === 'daily' ? 3 : 2;
      if (n >= min) {
        const disp = streakDisplay(n, sch);
        out[info.display] = { n, sch, label: scheduleLabel(sch), value: disp.v, unit: disp.u };
      }
    });
    return out;
  }

  let streakEditMode = false;

  function toggleStreakEdit(){
    streakEditMode = !streakEditMode;
    streakEditExpanded = false;
    streakEditQuery = '';
    renderStreaks();
  }

  function setSchedule(norm, code){
    const s = loadSchedules();
    const prevUnit = s[norm] && s[norm].unit;
    const sch = codeToSchedule(code);
    if (prevUnit && unitOptions(sch).includes(prevUnit)) sch.unit = prevUnit;
    s[norm] = sch;
    saveSchedules(s);
    if (streakEditMode) renderStreakRows(); else renderStreaks();
  }

  function setStreakUnit(norm, unit){
    const s = loadSchedules();
    if (!s[norm]) {
      const map = streakData();
      s[norm] = scheduleFor(norm, map[norm] || { weeks:{} });
    }
    s[norm].unit = unit;
    saveSchedules(s);
    if (streakEditMode) renderStreakRows(); else renderStreaks();
  }

  function renderStreaks(){
    const list = document.getElementById('streakList');
    if (!list) return;
    const btn = document.getElementById('streakEditBtn');
    if (btn) btn.textContent = streakEditMode ? 'Done' : 'Edit';

    if (streakEditMode) return renderStreakEditor(list);

    const streaks = calculateStreaks();
    const entries = Object.entries(streaks).sort((a,b) => b[1].n - a[1].n);
    list.innerHTML = '';

    if (!entries.length) {
      list.innerHTML = '<div class="streak-empty">No streaks going yet — tap Edit to set how often each habit should happen</div>';
      return;
    }

    entries.forEach(([name, s]) => {
      const div = document.createElement('div');
      div.className = 'streak-item';
      div.innerHTML = `
        <span class="streak-name">${escHtml(name)}<span class="streak-sched">${s.label}</span></span>
        <span class="streak-count">${s.value} ${s.value === 1 ? s.unit : s.unit + 's'}</span>
      `;
      list.appendChild(div);
    });
  }

  let streakEditExpanded = false;
  let streakEditQuery = '';

  const STREAK_OPTIONS = [
    ['daily','Every day'],
    ['w6','6× per week'], ['w5','5× per week'], ['w4','4× per week'],
    ['w3','3× per week'], ['w2','2× per week'], ['w1','Once a week'],
    ['b1','Once every 2 weeks'],
    ['none','No streak']
  ];

  const STREAK_MIN_COUNT = 3;   // done fewer times than this? not a habit yet

  function streakEditable(){
    const map = streakData();
    return Object.entries(map)
      .filter(([, info]) => info.total >= STREAK_MIN_COUNT)
      .sort((a, b) => b[1].total - a[1].total);
  }

  function renderStreakEditor(list){
    list.innerHTML = `
      <input type="text" class="streak-search" id="streakSearch" placeholder="Search tasks…"
             value="${escHtml(streakEditQuery)}" autocomplete="off"
             oninput="streakSearch(this.value)"/>
      <div id="streakEditRows"></div>`;
    renderStreakRows();
  }

  // rows live in their own container so typing in the search box doesn't
  // rebuild — and steal focus from — the input itself
  function renderStreakRows(){
    const box = document.getElementById('streakEditRows');
    if (!box) return;

    const all = streakEditable();
    const q = streakEditQuery.trim().toLowerCase();
    const matching = q ? all.filter(([, info]) => info.display.toLowerCase().includes(q)) : all;

    if (!all.length) {
      box.innerHTML = `<div class="streak-empty">Nothing done ${STREAK_MIN_COUNT} times yet</div>`;
      return;
    }
    if (!matching.length) {
      box.innerHTML = '<div class="streak-empty">No tasks match that</div>';
      return;
    }

    const showAll = streakEditExpanded || !!q;
    const shown = showAll ? matching : matching.slice(0, 7);
    const hidden = matching.length - shown.length;

    box.innerHTML = shown.map(([norm, info]) => {
      const sch = scheduleFor(norm, info);
      const code = scheduleCode(sch);
      const median = medianOf(Object.values(info.weeks));
      const units = unitOptions(sch);
      return `
        <div class="streak-edit-row">
          <div class="streak-edit-top">
            <span class="streak-edit-name">${escHtml(info.display)}</span>
            <span class="streak-edit-obs">${info.total}× · ~${median}/wk</span>
          </div>
          <select class="streak-select" onchange="setSchedule('${norm.replace(/'/g,"\\'")}',this.value)">
            ${STREAK_OPTIONS.map(([v,l]) => `<option value="${v}"${v === code ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          ${units.length ? `<div class="streak-unit-row">
            <span class="streak-unit-label">Count in</span>
            ${units.map(u => `<button class="streak-unit${(sch.unit || defaultUnit(sch)) === u ? ' active' : ''}"
              onclick="setStreakUnit('${norm.replace(/'/g,"\\'")}','${u}')">${u[0].toUpperCase() + u.slice(1)}</button>`).join('')}
          </div>` : ''}
        </div>`;
    }).join('');

    if (hidden > 0) {
      box.innerHTML += `<button class="streak-more" onclick="expandStreakEditor()">See ${hidden} more</button>`;
    }
  }

  function streakSearch(v){
    streakEditQuery = v;
    renderStreakRows();
  }

  function expandStreakEditor(){
    streakEditExpanded = true;
    renderStreakRows();
  }

  const quotes = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" }
  ];

  function getTodayKey(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function loadData(){try{return JSON.parse(localStorage.getItem('theosDayData')||'{}');}catch{return{};}}
  function saveData(data){localStorage.setItem('theosDayData',JSON.stringify(data));queueSync();}
  function getDay(key){const data=loadData();if(!data[key])data[key]={tasks:[]};return data[key];}
  function saveDay(key,day){const data=loadData();data[key]=day;saveData(data);}
  const todayKey=getTodayKey();

  const now=new Date();
  document.getElementById('dateFull').textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();

  function closeQuote() {
    document.getElementById('quoteOverlay').style.display = 'none';
  }

  function showQuote() {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quoteText').textContent = `"${quote.text}"`;
    document.getElementById('quoteAuthor').textContent = `— ${quote.author}`;
    document.getElementById('quoteOverlay').style.display = 'flex';
  }

  // Function to get color based on percentage
  function getProgressColor(pct) {
    if (pct < 50) {
      // Red to Yellow (0-50%)
      const ratio = pct / 50;
      const r = 220;
      const g = Math.round(50 + (200 * ratio)); // 50 to 250
      const b = 50;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Green (50-100%)
      const ratio = (pct - 50) / 50;
      const r = Math.round(220 - (194 * ratio)); // 220 to 26
      const g = Math.round(250 - (173 * ratio)); // 250 to 77
      const b = Math.round(50 - (4 * ratio)); // 50 to 46
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function makeEditable(textEl, detailEl, taskIndex, dayKey) {
    textEl.contentEditable = true;
    textEl.focus();
    
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const save = () => {
      textEl.contentEditable = false;
      const newText = textEl.textContent.trim();
      const newDetail = detailEl ? detailEl.textContent.trim() : '';
      
      if (newText) {
        const day = getDay(dayKey);
        day.tasks[taskIndex].text = newText;
        if (detailEl) day.tasks[taskIndex].detail = newDetail;
        saveDay(dayKey, day);
      }
      if (dayKey === todayKey) renderToday();
      else renderDayView(dayKey);
    };

    textEl.addEventListener('blur', save, {once: true});
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
    }, {once: true});
  }

  // Drag and drop state
  let draggedTaskIndex = null;
  let currentDayKey = null;

  function setupDragAndDrop(taskEl, taskIndex, dayKey) {
    taskEl.draggable = true;
    
    taskEl.addEventListener('dragstart', (e) => {
      draggedTaskIndex = taskIndex;
      currentDayKey = dayKey;
      taskEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    taskEl.addEventListener('dragend', (e) => {
      taskEl.classList.remove('dragging');
      document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    });
    
    taskEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (draggedTaskIndex !== taskIndex) {
        taskEl.classList.add('drag-over');
      }
    });
    
    taskEl.addEventListener('dragleave', (e) => {
      taskEl.classList.remove('drag-over');
    });
    
    taskEl.addEventListener('drop', (e) => {
      e.preventDefault();
      taskEl.classList.remove('drag-over');
      
      if (draggedTaskIndex !== null && draggedTaskIndex !== taskIndex) {
        const day = getDay(currentDayKey);
        const draggedTask = day.tasks[draggedTaskIndex];
        
        // Remove from old position
        day.tasks.splice(draggedTaskIndex, 1);
        
        // Insert at new position
        const newIndex = draggedTaskIndex < taskIndex ? taskIndex - 1 : taskIndex;
        day.tasks.splice(newIndex, 0, draggedTask);
        
        saveDay(currentDayKey, day);
        
        if (currentDayKey === todayKey) renderToday();
        else renderDayView(currentDayKey);
      }
      
      draggedTaskIndex = null;
      currentDayKey = null;
    });
  }

  function renderToday(){
    const day=getDay(todayKey);
    const list=document.getElementById('taskList');
    list.innerHTML='';
    
    // Sort tasks: incomplete first, then completed
    const sortedTasks = [...day.tasks].map((t, originalIndex) => ({...t, originalIndex}));
    sortedTasks.sort((a, b) => {
      if (a.done === b.done) return 0;
      return a.done ? 1 : -1;
    });
    
    if(sortedTasks.length===0){
      list.innerHTML=`<div class="empty-state"><span class="e-icon">○</span><p>No tasks yet — add one above</p></div>`;
    } else {
      sortedTasks.forEach((t)=>{
        const i = t.originalIndex;
        const div=document.createElement('div');
        div.className='task-item'+(t.done?' done':'');
        div.innerHTML=`
          <span class="task-num">${String(i+1).padStart(2,'0')}</span>
          <div class="custom-cb" onclick="toggleTask(${i})">${t.done?'✓':''}</div>
          <div class="task-content">
            <span class="task-text" data-idx="${i}">${escHtml(t.text)}</span>
            ${t.detail?`<div class="task-detail" data-idx="${i}">${escHtml(t.detail)}</div>`:''}
          </div>
          <button class="btn-del" onclick="deleteTask(${i})">✕</button>`;
        list.appendChild(div);
        
        // Setup drag and drop
        setupDragAndDrop(div, i, todayKey);
        
        const textEl = div.querySelector('.task-text');
        const detailEl = div.querySelector('.task-detail');
        textEl.addEventListener('click', () => makeEditable(textEl, detailEl, i, todayKey));
        if (detailEl) {
          detailEl.addEventListener('click', () => {
            detailEl.contentEditable = true;
            detailEl.focus();
            const range = document.createRange();
            range.selectNodeContents(detailEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            
            const saveDetail = () => {
              detailEl.contentEditable = false;
              const day = getDay(todayKey);
              day.tasks[i].detail = detailEl.textContent.trim();
              saveDay(todayKey, day);
            };
            detailEl.addEventListener('blur', saveDetail, {once: true});
            detailEl.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveDetail();
              }
            }, {once: true});
          });
        }
      });
    }
   updateProgress(day);
    renderStreaks();
  }

  function updateProgress(day){
    const total=day.tasks.length,done=day.tasks.filter(t=>t.done).length;
    const pct=total===0?0:Math.round((done/total)*100);
    const barEl = document.getElementById('progressBar');
    const pctEl = document.getElementById('pctLabel');
    
    barEl.style.width=pct+'%';
    pctEl.textContent=pct+'%';
    
    // Update colors based on percentage
    if (pct < 100) {
      const color = getProgressColor(pct);
      barEl.style.background = color;
      pctEl.style.color = color;
      barEl.classList.remove('celebrating', 'rainbow');
      pctEl.classList.remove('celebrating', 'rainbow');
    }
    
    const msg=document.getElementById('completionMsg');
    if(pct===100&&total>0){
      msg.style.display='block';
      if(!msg.dataset.c){
        barEl.classList.add('celebrating', 'rainbow');
        pctEl.classList.add('celebrating', 'rainbow');
        launchConfetti();
        setTimeout(() => {
          showQuote();
        }, 1000);
        msg.dataset.c='1';
      }
    } else {
      msg.style.display='none';
      delete msg.dataset.c;
    }
  }

  // ── TASK AUTOCOMPLETE ──
  // Suggests task names you've used before, for the Today input and the
  // calendar day view. Shared logic, two sets of elements.

  let currentSuggestions = [];
  let calCurrentSuggestions = [];
  let suggestIndex = -1;
  let calSuggestIndex = -1;

  function pastTaskNames(){
    const data = loadData();
    const counts = new Map();
    Object.values(data).forEach(day => {
      if (!day.tasks) return;
      day.tasks.forEach(t => {
        const name = (t.text || '').trim();
        if (!name) return;
        const norm = normalizeTaskName(name);
        if (!counts.has(norm)) counts.set(norm, { name, n: 0 });
        counts.get(norm).n++;
      });
    });
    return [...counts.values()].sort((a,b) => b.n - a.n).map(x => x.name);
  }

  function suggestionsFor(query, dayKey){
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const day = dayKey ? loadData()[dayKey] : null;
    const already = new Set((day && day.tasks ? day.tasks : []).map(t => normalizeTaskName(t.text)));
    return pastTaskNames()
      .filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .filter(n => !already.has(normalizeTaskName(n)))
      .slice(0, 5);
  }

  function highlight(name, query){
    const i = name.toLowerCase().indexOf(query.trim().toLowerCase());
    if (i < 0) return escHtml(name);
    const q = query.trim();
    return escHtml(name.slice(0, i)) + '<strong>' + escHtml(name.slice(i, i + q.length)) + '</strong>' + escHtml(name.slice(i + q.length));
  }

  function paintDropdown(dropId, list, query, index, pickFn){
    const box = document.getElementById(dropId);
    if (!box) return;
    if (!list.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = list.map((n, i) =>
      `<div class="autocomplete-item${i === index ? ' selected' : ''}" onmousedown="event.preventDefault()" onclick="${pickFn}(${i})">${highlight(n, query)}</div>`
    ).join('');
    box.style.display = 'block';
  }

  // ── Today input ──

  function handleTaskInputChange(){
    const inp = document.getElementById('taskInput');
    currentSuggestions = suggestionsFor(inp.value, todayKey);
    suggestIndex = -1;
    paintDropdown('autocompleteDropdown', currentSuggestions, inp.value, suggestIndex, 'pickSuggestion');
  }

  function pickSuggestion(i){
    const inp = document.getElementById('taskInput');
    if (currentSuggestions[i]) inp.value = currentSuggestions[i];
    closeAutocomplete();
    inp.focus();
  }

  function closeAutocomplete(){
    currentSuggestions = [];
    suggestIndex = -1;
    const box = document.getElementById('autocompleteDropdown');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  }

  function handleTaskInputKeydown(e){
    if (!currentSuggestions.length) {
      if (e.key === 'Enter') { e.preventDefault(); addTask(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestIndex = (suggestIndex + 1) % currentSuggestions.length;
      paintDropdown('autocompleteDropdown', currentSuggestions, document.getElementById('taskInput').value, suggestIndex, 'pickSuggestion');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      paintDropdown('autocompleteDropdown', currentSuggestions, document.getElementById('taskInput').value, suggestIndex, 'pickSuggestion');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestIndex >= 0) pickSuggestion(suggestIndex);
      else { closeAutocomplete(); addTask(); }
    } else if (e.key === 'Escape') {
      closeAutocomplete();
    }
  }

  // ── Calendar day view input ──

  function handleCalTaskInputChange(){
    const inp = document.getElementById('calTaskInput');
    calCurrentSuggestions = suggestionsFor(inp.value, selKey);
    calSuggestIndex = -1;
    paintDropdown('calAutocompleteDropdown', calCurrentSuggestions, inp.value, calSuggestIndex, 'pickCalSuggestion');
  }

  function pickCalSuggestion(i){
    const inp = document.getElementById('calTaskInput');
    if (calCurrentSuggestions[i]) inp.value = calCurrentSuggestions[i];
    closeCalAutocomplete();
    inp.focus();
  }

  function closeCalAutocomplete(){
    calCurrentSuggestions = [];
    calSuggestIndex = -1;
    const box = document.getElementById('calAutocompleteDropdown');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  }

  function handleCalTaskInputKeydown(e){
    if (!calCurrentSuggestions.length) {
      if (e.key === 'Enter') { e.preventDefault(); addCalTask(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      calSuggestIndex = (calSuggestIndex + 1) % calCurrentSuggestions.length;
      paintDropdown('calAutocompleteDropdown', calCurrentSuggestions, document.getElementById('calTaskInput').value, calSuggestIndex, 'pickCalSuggestion');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      calSuggestIndex = (calSuggestIndex - 1 + calCurrentSuggestions.length) % calCurrentSuggestions.length;
      paintDropdown('calAutocompleteDropdown', calCurrentSuggestions, document.getElementById('calTaskInput').value, calSuggestIndex, 'pickCalSuggestion');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (calSuggestIndex >= 0) pickCalSuggestion(calSuggestIndex);
      else { closeCalAutocomplete(); addCalTask(); }
    } else if (e.key === 'Escape') {
      closeCalAutocomplete();
    }
  }

  // tapping elsewhere dismisses either dropdown
  document.addEventListener('click', e => {
    const ti = document.getElementById('taskInput');
    const ci = document.getElementById('calTaskInput');
    if (currentSuggestions.length && e.target !== ti) closeAutocomplete();
    if (calCurrentSuggestions.length && e.target !== ci) closeCalAutocomplete();
  });

// Set up input event listeners
  function bindTaskInputs(){
    const taskInput = document.getElementById('taskInput');
    const calTaskInput = document.getElementById('calTaskInput');
    if (taskInput) {
      taskInput.addEventListener('input', handleTaskInputChange);
      taskInput.addEventListener('keydown', handleTaskInputKeydown);
    }
    if (calTaskInput) {
      calTaskInput.addEventListener('input', handleCalTaskInputChange);
      calTaskInput.addEventListener('keydown', handleCalTaskInputKeydown);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTaskInputs);
  } else {
    bindTaskInputs();
  }

  function addTask(){
    const inp=document.getElementById('taskInput');
    const det=document.getElementById('taskDetail');
    const t=inp.value.trim();
    if(!t)return;
    const day=getDay(todayKey);
    day.tasks.push({text:t,detail:det.value.trim(),done:false});
    saveDay(todayKey,day);
    inp.value='';det.value='';
    document.getElementById('autocompleteDropdown').style.display = 'none';
    currentSuggestions = [];
    renderToday();
  }
  
  function toggleTask(i){
    const day=getDay(todayKey);
    day.tasks[i].done=!day.tasks[i].done;
    saveDay(todayKey,day);
    renderToday();
  }
  
  function deleteTask(i){
    const day=getDay(todayKey);
    day.tasks.splice(i,1);
    saveDay(todayKey,day);
    renderToday();
  }

  function switchTab(name,el){
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.tabbtn').forEach(t=>t.classList.remove('active'));
    document.getElementById('panel-'+name).classList.add('active');
    el.classList.add('active');
    window.scrollTo(0,0);
    if(name==='hobbies')renderHobbies();
    if(name==='month')renderCalendar();
    if(name==='resolutions')renderGoals('year');
    if(name==='gym')renderGym();
  }

  let calYear=new Date().getFullYear(),calMonth=new Date().getMonth(),selKey=null;
  function changeMonth(dir){
    calMonth+=dir;
    if(calMonth<0){calMonth=11;calYear--;}
    if(calMonth>11){calMonth=0;calYear++;}
    renderCalendar();
  }

  function renderCalendar(){
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('calMonthLabel').textContent=`${months[calMonth]} ${calYear}`;
    const grid=document.getElementById('calGrid');grid.innerHTML='';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{
      const e=document.createElement('div');
      e.className='cal-day-name';
      e.textContent=d;
      grid.appendChild(e);
    });
    const fd=new Date(calYear,calMonth,1).getDay(),dim=new Date(calYear,calMonth+1,0).getDate();
    const data=loadData(),today=new Date();
    for(let i=0;i<fd;i++){
      const e=document.createElement('div');
      e.className='cal-day empty';
      grid.appendChild(e);
    }
    for(let d=1;d<=dim;d++){
      const key=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const el=document.createElement('div');
      el.className='cal-day';
      if(d===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear())el.classList.add('today');
      if(key===selKey)el.classList.add('selected');
      if(data[key]&&data[key].tasks.length>0)el.classList.add('has-tasks');
const dayData = data[key];
let content = `<div class="cal-day-number">${d}</div>`;

if (dayData && dayData.tasks && dayData.tasks.length > 0) {
  const total = dayData.tasks.length;
  const done = dayData.tasks.filter(t => t.done).length;
  const pct = Math.round((done / total) * 100);
  const color = getProgressColor(pct);
  
  content += `<div class="cal-completion" style="color: ${color}">${pct}%</div>`;
  content += `<div class="cal-ratio">${done}/${total}</div>`;
}

el.innerHTML = content;
      el.dataset.key = key;
      el.onclick=()=>{openDay(key,'monthDaySlot');renderCalendar();};
      grid.appendChild(el);
    }
    if(selKey){
      document.getElementById('monthDaySlot').appendChild(document.getElementById('dayView'));
      renderDayView(selKey);
    }

    const now=new Date();
    const isThisMonth=(calYear===now.getFullYear()&&calMonth===now.getMonth());

    // Weekly aims follow whichever day is selected — tap a date and the aims
    // below flip to that week. With nothing selected, use the current week when
    // you're on this month, otherwise the month's first week.
    let anchor;
    if (selKey) anchor = new Date(selKey + 'T00:00:00');
    else if (isThisMonth) anchor = new Date();
    else anchor = new Date(calYear, calMonth, 1);
    weekViewStart = ymd(weekStartOf(anchor));

    const wkStart = new Date(weekViewStart + 'T00:00:00');
    [...grid.querySelectorAll('.cal-day')].forEach(cell => {
      const k = cell.dataset.key;
      if (k && ymd(weekStartOf(new Date(k + 'T00:00:00'))) === weekViewStart) {
        cell.classList.add('in-week');
      }
    });

    const fmt = { month:'short', day:'numeric' };
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate()+6);
    document.getElementById('aimsLabel-week').textContent =
      weekViewStart === ymd(weekStartOf(new Date()))
        ? "This Week's Aims"
        : `${wkStart.toLocaleDateString('en-US',fmt)} – ${wkEnd.toLocaleDateString('en-US',fmt)}`;
    renderGoals('week');

    document.getElementById('monthAimsLabel').textContent=
      isThisMonth?"This Month's Aims":`${months[calMonth]} Aims`;
    renderGoals('month');
  }

  function renderDayView(key){
    document.getElementById('dayView').style.display='block';
    const[y,m,d]=key.split('-');
    const dateObj=new Date(parseInt(y),parseInt(m)-1,parseInt(d));
    document.getElementById('dayViewTitle').textContent=dateObj.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();
    document.getElementById('calAddRow').style.display=key<todayKey?'none':'flex';
    const dayData=getDay(key);
    const list=document.getElementById('calTaskList');
    list.innerHTML='';
    
    // Sort tasks: incomplete first, then completed
    const sortedTasks = [...dayData.tasks].map((t, originalIndex) => ({...t, originalIndex}));
    sortedTasks.sort((a, b) => {
      if (a.done === b.done) return 0;
      return a.done ? 1 : -1;
    });
    
    if(sortedTasks.length===0){
      list.innerHTML=`<div class="empty-state"><p>No tasks for this day</p></div>`;
    } else {
      sortedTasks.forEach((t)=>{
        const i = t.originalIndex;
        const div=document.createElement('div');
        div.className='task-item'+(t.done?' done':'');
        const fn=key===todayKey?`onclick="toggleCalTask('${key}',${i})"`:'';
        div.innerHTML=`
          <span class="task-num">${String(i+1).padStart(2,'0')}</span>
          <div class="custom-cb" ${fn}>${t.done?'✓':''}</div>
          <div class="task-content">
            <span class="task-text" data-idx="${i}">${escHtml(t.text)}</span>
            ${t.detail?`<div class="task-detail" data-idx="${i}">${escHtml(t.detail)}</div>`:''}
          </div>
          <button class="btn-del" onclick="deleteCalTask('${key}',${i})">✕</button>`;
        list.appendChild(div);
        
        // Setup drag and drop
        setupDragAndDrop(div, i, key);
        
        const textEl = div.querySelector('.task-text');
        const detailEl = div.querySelector('.task-detail');
        textEl.addEventListener('click', () => makeEditable(textEl, detailEl, i, key));
        if (detailEl) {
          detailEl.addEventListener('click', () => {
            detailEl.contentEditable = true;
            detailEl.focus();
            const range = document.createRange();
            range.selectNodeContents(detailEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            
            const saveDetail = () => {
              detailEl.contentEditable = false;
              const day = getDay(key);
              day.tasks[i].detail = detailEl.textContent.trim();
              saveDay(key, day);
            };
            detailEl.addEventListener('blur', saveDetail, {once: true});
            detailEl.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveDetail();
              }
            }, {once: true});
          });
        }
      });
    }
  }

 function addCalTask(){
    if(!selKey)return;
    const inp=document.getElementById('calTaskInput');
    const det=document.getElementById('calTaskDetail');
    const t=inp.value.trim();
    if(!t)return;
    const day=getDay(selKey);
    day.tasks.push({text:t,detail:det.value.trim(),done:false});
    saveDay(selKey,day);
    inp.value='';det.value='';
    document.getElementById('calAutocompleteDropdown').style.display = 'none';
    calCurrentSuggestions = [];
    renderDayView(selKey);
    renderCalendar();
    if(selKey===todayKey)renderToday();
  }
  
  function toggleCalTask(key,i){
    const day=getDay(key);
    day.tasks[i].done=!day.tasks[i].done;
    saveDay(key,day);
    renderDayView(key);
    if(key===todayKey)renderToday();
  }
  
  function deleteCalTask(key,i){
    const day=getDay(key);
    day.tasks.splice(i,1);
    saveDay(key,day);
    renderDayView(key);
    renderCalendar();
    if(key===todayKey)renderToday();
  }

  // ── GOAL LISTS (week / month / year) ──
  // One engine, three scopes. Week and month keys include the period, so a new
  // week or month automatically starts blank.

  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Sunday-start week, identified by that Sunday's date
  function weekStartOf(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  // which week the Week tab is showing
  let weekViewStart = null;

  const GOAL_SCOPES = {
    week:  { store: () => 'theosGoals-week-' + (weekViewStart || ymd(weekStartOf(new Date()))) },
    month: { store: () => `theosGoals-month-${calYear}-${String(calMonth+1).padStart(2,'0')}` },
    year:  { store: () => 'theosResolutions2026' }
  };

  function loadGoals(scope) {
    try { return JSON.parse(localStorage.getItem(GOAL_SCOPES[scope].store()) || '[]'); }
    catch { return []; }
  }
  function saveGoals(scope, arr) {
    localStorage.setItem(GOAL_SCOPES[scope].store(), JSON.stringify(arr));
    queueSync();
  }

  function syncTargetVisibility(scope) {
    const type = document.getElementById('goalType-' + scope);
    const target = document.getElementById('goalTarget-' + scope);
    if (!type || !target) return;
    target.style.display = type.value === 'recurring' ? 'block' : 'none';
  }

  function addGoal(scope) {
    const inp = document.getElementById('goalInput-' + scope);
    const type = document.getElementById('goalType-' + scope).value;
    const targetInp = document.getElementById('goalTarget-' + scope);
    const title = inp.value.trim();
    if (!title) return;

    const arr = loadGoals(scope);
    if (type === 'recurring') {
      const target = parseInt(targetInp.value) || 1;
      arr.push({ title, type: 'recurring', current: 0, target, done: false, history: [] });
    } else {
      arr.push({ title, type: 'onetime', done: false, history: [] });
    }
    saveGoals(scope, arr);
    inp.value = '';
    renderGoals(scope);
  }

  function deleteGoal(scope, i) {
    const arr = loadGoals(scope);
    arr.splice(i, 1);
    saveGoals(scope, arr);
    renderGoals(scope);
  }

  function toggleGoal(scope, i) {
    const arr = loadGoals(scope);
    arr[i].done = !arr[i].done;
    saveGoals(scope, arr);
    renderGoals(scope);
  }

  function adjustGoal(scope, i, delta) {
    const arr = loadGoals(scope);
    const g = arr[i];
    g.current = Math.max(0, Math.min(g.target, g.current + delta));
    g.done = g.current >= g.target;
    saveGoals(scope, arr);
    renderGoals(scope);
  }

  // Evolve — raise the bar on a finished goal, old one becomes a subgoal
  let evolveState = { scope: null, index: null };

  function showEvolveForm(scope, i) {
    evolveState = { scope, index: i };
    renderGoals(scope);
  }

  function submitEvolve(scope, i) {
    const arr = loadGoals(scope);
    const g = arr[i];
    const titleEl = document.getElementById('evolveTitle');
    const newTitle = titleEl ? titleEl.value.trim() : '';
    if (!newTitle) return;

    const targetEl = document.getElementById('evolveTarget');
    const newTarget = targetEl ? (parseInt(targetEl.value) || g.target) : 0;

    if (!g.history) g.history = [];
    if (g.type === 'recurring') {
      g.history.push({ title: g.title, target: g.target, current: g.current });
    } else {
      g.history.push({ title: g.title });
    }

    g.title = newTitle;
    g.done = false;
    if (g.type === 'recurring') {
      g.target = newTarget;
      g.current = 0;
    }

    evolveState = { scope: null, index: null };
    saveGoals(scope, arr);
    renderGoals(scope);
  }

  function renderGoals(scope) {
    const arr = loadGoals(scope);
    const list = document.getElementById('goalList-' + scope);
    if (!list) return;
    list.innerHTML = '';

    syncTargetVisibility(scope);

    // summary next to the collapsible header
    const meta = document.getElementById('aimsMeta-' + scope);
    if (meta) {
      meta.textContent = arr.length
        ? arr.filter(g => g.done).length + '/' + arr.length
        : '';
    }
    applyAimsState(scope);

    if (arr.length === 0) {
      const top = document.getElementById('topProgress-' + scope);
      if (top) top.innerHTML = '';
      // nothing in the list — the add form sits straight under the header
      return;
    }

    const total = arr.length;
    const completed = arr.filter(g => g.done).length;
    const pct = Math.round((completed / total) * 100);
    const color = getProgressColor(pct);

    const LABELS = { week: 'Weekly Aims', month: 'Monthly Aims', year: '2026 Resolutions' };
    const top = document.getElementById('topProgress-' + scope);
    if (top) {
      top.innerHTML = `
        <div class="tp-head">
          <span class="tp-label">${LABELS[scope]}</span>
          <span class="tp-pct" style="color:${color}">${completed}/${total} — ${pct}%</span>
        </div>
        <div class="tp-track">
          <div class="tp-fill" style="width:${pct}%;background:${color}"></div>
        </div>`;
    }

    const evolvingHere = evolveState.scope === scope ? evolveState.index : null;

    arr.forEach((g, i) => {
      const el = document.createElement('div');
      el.className = 'res-item' + (g.done ? ' completed' : '');
      const past = g.history || [];
      let html = '';

      if (g.type === 'recurring') {
        const p = Math.round((g.current / g.target) * 100);
        const c = getProgressColor(p);
        html += `
          <div class="res-item-header">
            <div>
              <span class="res-item-title">${escHtml(g.title)}</span>
              <span class="res-type-tag">Recurring</span>
            </div>
            <div class="res-item-actions">
              <button class="res-btn" onclick="adjustGoal('${scope}',${i},-1)">−</button>
              <button class="res-btn" onclick="adjustGoal('${scope}',${i},1)">+</button>
              <button class="res-btn-del" onclick="deleteGoal('${scope}',${i})">✕</button>
            </div>
          </div>
          <div class="res-progress-info">
            <span>${g.current} / ${g.target}</span>
            <span class="res-progress-pct" style="color:${c}">${p}%</span>
          </div>
          <div class="res-bar-track">
            <div class="res-bar-fill" style="width:${p}%;background:${c}"></div>
          </div>`;
      } else {
        html += `
          <div class="res-item-header">
            <div class="res-onetime-row">
              <div class="res-cb" onclick="toggleGoal('${scope}',${i})">${g.done ? '✓' : ''}</div>
              <span class="res-item-title">${escHtml(g.title)}</span>
              <span class="res-type-tag">One-time</span>
            </div>
            <div class="res-item-actions">
              <button class="res-btn-del" onclick="deleteGoal('${scope}',${i})">✕</button>
            </div>
          </div>`;
      }

      if (g.done && evolvingHere !== i) {
        html += `<button class="res-evolve-btn" onclick="showEvolveForm('${scope}',${i})">↑ Set New Goal</button>`;
      }
      if (evolvingHere === i) {
        html += `
          <div class="res-evolve-form">
            <input type="text" id="evolveTitle" placeholder="New goal…"/>
            ${g.type === 'recurring' ? `<input type="number" id="evolveTarget" min="1" value="${g.target}"/>` : ''}
            <button onclick="submitEvolve('${scope}',${i})">Go</button>
          </div>`;
      }

      if (past.length > 0) {
        html += '<div class="res-history">';
        [...past].reverse().forEach(h => {
          html += `<div class="res-history-item">
            <span>${escHtml(h.title)}</span>
            <span class="res-history-target">${h.target ? h.current + '/' + h.target : ''}</span>
          </div>`;
        });
        html += '</div>';
      }

      el.innerHTML = html;
      list.appendChild(el);
    });
  }

  // ── WEEK STRIP ──

  function openDay(key, slotId) {
    const dv = document.getElementById('dayView');
    // tapping the already-selected day closes it
    if (selKey === key) {
      selKey = null;
      dv.style.display = 'none';
      return;
    }
    selKey = key;
    document.getElementById(slotId).appendChild(dv);
    renderDayView(key);
  }

  // ── COLLAPSIBLE AIMS ──
  function aimsOpen(scope) {
    return localStorage.getItem('theosAimsOpen-' + scope) !== 'closed';
  }

  function toggleAims(scope) {
    const open = aimsOpen(scope);
    localStorage.setItem('theosAimsOpen-' + scope, open ? 'closed' : 'open');
    applyAimsState(scope);
  }

  function applyAimsState(scope) {
    const body = document.getElementById('aimsBody-' + scope);
    const chev = document.getElementById('aimsChev-' + scope);
    if (!body) return;
    const open = aimsOpen(scope);
    body.classList.toggle('collapsed', !open);
    if (chev) chev.classList.toggle('open', open);
  }

  function launchConfetti(){
    const c=document.getElementById('confetti');
    const colors=['#1a4d2e','#2d6a4f','#52b788','#95d5b2','#40916c','#1b4332','#081c15'];
    
    for(let i=0;i<200;i++){
      const el=document.createElement('div');
      el.className='confetti-piece';
      el.style.left=Math.random()*100+'vw';
      el.style.animationDuration=(Math.random()*2.5+2)+'s';
      el.style.animationDelay=(Math.random()*1.5)+'s';
      const color=colors[Math.floor(Math.random()*colors.length)];
      const size=Math.random()*10+6;
      const shape=Math.random()>0.5?`width:${size}px;height:${size}px;background:${color};border-radius:50%`:`width:${size}px;height:${size*1.8}px;background:${color}`;
      el.style.cssText+=shape;
      c.appendChild(el);
      el.addEventListener('animationend',()=>el.remove());
    }
  }

  function escHtml(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── CHESS.COM RATING ──
  async function fetchChessRating() {
    const container = document.getElementById('chessContent');
    try {
      const resp = await fetch('https://api.chess.com/pub/player/theokozak/stats');
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      
      const rapid = data.chess_rapid;
      if (!rapid || !rapid.last) {
        container.innerHTML = '<div class="chess-error">No rapid rating found</div>';
        return;
      }
      
      const rating = rapid.last.rating;
      const best = rapid.best ? rapid.best.rating : null;
      const wins = rapid.record ? rapid.record.win : 0;
      const losses = rapid.record ? rapid.record.loss : 0;
      const draws = rapid.record ? rapid.record.draw : 0;
      
      let html = `
        <div class="chess-rating-display">
          <span class="chess-rating-number">${rating}</span>
          <span class="chess-rating-label">Elo</span>
        </div>
        <div class="chess-record">
          <span style="color: var(--green);">${wins}W</span>
          <span style="color: #c0392b;">${losses}L</span>
          <span style="color: var(--muted);">${draws}D</span>
        </div>`;
      
      if (best) {
        html += `<div class="chess-peak">Peak: ${best} &nbsp;&nbsp;&nbsp;&nbsp; Jan 1: 891</div>`;
      }
      
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div class="chess-error">Could not load rating</div>';
    }
  }
  
