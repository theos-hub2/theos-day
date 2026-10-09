// theo's day — app-core.js
// Part of the app. Loaded by index.html in order; every function is global.

  // Normalize task name for streak comparison
  function normalizeTaskName(name) {
    return name.toLowerCase().trim();
  }

  // Streaks and habits live in app-habits.js.

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
    renderTodayAsterisk();
    if (typeof renderTodayTrip === 'function') renderTodayTrip();
    const day=getDay(todayKey);
    const list=document.getElementById('taskList');
    list.innerHTML='';
    
    // Sort tasks: incomplete first, then completed
    const sortedTasks = [...day.tasks].map((t, originalIndex) => ({...t, originalIndex}));
    sortedTasks.sort((a, b) => {
      if (a.done === b.done) return 0;
      return a.done ? 1 : -1;
    });
    
    // A day with nothing scheduled stays small: one line until you need it.
    const addRow = document.getElementById('todayAddRow');
    if (addRow) addRow.style.display = (sortedTasks.length || taskAddOpen) ? '' : 'none';
    if(sortedTasks.length===0){
      list.innerHTML = taskAddOpen ? '' : `<button class="task-add-line" onclick="openTaskAdd()">+ Add task</button>`;
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
    if (typeof renderHabits === 'function') renderHabits();
    renderStreaks();
  }

  let taskAddOpen = false;
  function openTaskAdd(){
    taskAddOpen = true;
    document.getElementById('todayAddRow').style.display = '';
    document.getElementById('taskList').innerHTML = '';
    document.getElementById('taskInput').focus();
  }

  // tasks plus the habits due today (see dayCounts in app-habits.js)
  function updateProgress(day){
    const c = dayCounts(todayKey);
    const total=c.total,done=c.done;
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

  // Only habits get suggested: tasks ticked on at least STREAK_MIN_COUNT
  // separate days — the same bar the streak editor uses. One-offs like
  // "buy socks" never show up.
  function pastTaskNames(){
    const data = loadData();
    const counts = new Map();
    Object.values(data).forEach(day => {
      if (!day.tasks) return;
      const seen = new Set();
      day.tasks.forEach(t => {
        const name = (t.text || '').trim();
        if (!name || !t.done) return;
        const norm = normalizeTaskName(name);
        if (seen.has(norm)) return;
        seen.add(norm);
        if (!counts.has(norm)) counts.set(norm, { name, n: 0 });
        counts.get(norm).n++;
      });
    });
    // habits have their own list now, so they're never suggested as tasks
    return [...counts.values()]
      .filter(x => x.n >= STREAK_MIN_COUNT)
      .filter(x => !(typeof activeHabitNamed === 'function' && activeHabitNamed(x.name)))
      .sort((a,b) => b.n - a.n).map(x => x.name);
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
    // typing a habit's name ticks the habit instead of adding a duplicate task
    const habit = typeof activeHabitNamed === 'function' ? activeHabitNamed(t) : null;
    if (habit) {
      setHabitTick(habit.id, todayKey, true);
      inp.value=''; det.value='';
      document.getElementById('autocompleteDropdown').style.display = 'none';
      currentSuggestions = [];
      renderToday();
      return;
    }
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
    afterTaskToggle(todayKey, day.tasks[i]);
    renderToday();
  }

  // Some tasks mirror a hobby — ticking Read on a day counts as a reading day.
  // The hobby file defines the handler; this just passes the change along.
  function afterTaskToggle(key, task){
    if (task && task.text.trim().toLowerCase() === 'read' && typeof readTaskToggled === 'function') {
      readTaskToggled(key, task.done);
    }
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
    const trips = typeof tripsSorted === 'function' ? tripsSorted() : [];
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
      const counts = dayCounts(key, data);
      if(counts.total>0)el.classList.add('has-tasks');
const dayData = data[key];
let content = `<div class="cal-day-number">${d}</div>`;
const trip = trips.length ? tripOn(key, trips) : null;
if (trip) el.classList.add('trip', 'trip-' + tripColor(trip, trips));
if (dayData && dayData.asterisk) {
  el.classList.add('asterisk');
  content += `<span class="cal-asterisk">✱</span>`;
}

if (counts.total > 0) {
  const total = counts.total;
  const done = counts.done;
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
    if (typeof renderReviewSlot === 'function') renderReviewSlot();
    if (typeof renderTripKey === 'function') { renderTripKey(); renderTripSlot(); }
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
    if (typeof renderDayHabits === 'function') renderDayHabits(key);
    renderAsterisk(key);
  }

  // ── ASTERISK ──
  // A day that didn't count — sick, or an emergency. (Travel moved to trips,
  // app-travel.js; old travel asterisks keep their label.) It shades the
  // calendar and explains the gap. It deliberately does NOT protect streaks:
  // the break stays, the asterisk is context. Stored on the day itself
  // (theosDayData[key].asterisk = {reason, note}) so export and sync carry it.
  // Used a few times a year, so it lives at the bottom of the day view only.
  const ASTERISK_REASONS = [['sick','Sick'],['emergency','Emergency']];
  const ASTERISK_LABELS = { sick: 'Sick', travel: 'Travel', emergency: 'Emergency' };
  let asteriskEditing = null;   // key of the day whose editor is open
  let asteriskDraft = null;

  function asteriskOf(key){ const d = loadData()[key]; return (d && d.asterisk) || null; }
  function asteriskLabel(a){ return ASTERISK_LABELS[a.reason] || 'Asterisk'; }

  function renderAsterisk(key){
    const banner = document.getElementById('dayAsteriskBanner');
    const ctl = document.getElementById('dayAsteriskCtl');
    if (!banner || !ctl) return;
    const a = asteriskOf(key);
    if (asteriskEditing === key) {
      banner.innerHTML = '';
      ctl.innerHTML = asteriskEditorHtml(key);
      return;
    }
    banner.innerHTML = a ? `<div class="asterisk-banner">
        <span class="asterisk-mark">✱</span>
        <div><div class="asterisk-reason">${asteriskLabel(a)}</div>
        ${a.note ? `<div class="asterisk-note">${escHtml(a.note)}</div>` : ''}</div>
      </div>` : '';
    ctl.innerHTML = `<button class="asterisk-link" onclick="openAsteriskEditor('${key}')">${a ? 'Edit asterisk' : 'Mark with an asterisk'}</button>`;
  }

  function asteriskEditorHtml(key){
    const d = asteriskDraft, existing = asteriskOf(key);
    return `<div class="asterisk-editor">
      <div class="asterisk-editor-label">✱ Asterisk this day</div>
      <div class="asterisk-reasons">${ASTERISK_REASONS.map(([v,l]) =>
        `<button class="asterisk-chip${d.reason === v ? ' active' : ''}" onclick="pickAsteriskReason('${v}')">${l}</button>`).join('')}</div>
      <input type="text" id="asteriskNote" class="asterisk-input" maxlength="120"
        placeholder="Note (optional) — e.g. flight to LA"
        value="${escHtml(d.note || '')}" oninput="asteriskDraft.note = this.value"/>
      <div class="asterisk-hint">Shades the day on the calendar and keeps notifications quiet. Streaks aren't changed.</div>
      <div class="asterisk-actions">
        ${existing ? `<button class="asterisk-remove" onclick="removeAsterisk('${key}')">Remove</button>` : ''}
        <button class="asterisk-cancel" onclick="closeAsteriskEditor()">Cancel</button>
        <button class="asterisk-save" ${d.reason ? '' : 'disabled'} onclick="saveAsterisk('${key}')">Save</button>
      </div>
    </div>`;
  }

  function openAsteriskEditor(key){
    const a = asteriskOf(key);
    asteriskEditing = key;
    asteriskDraft = { reason: a ? a.reason : null, note: a ? (a.note || '') : '' };
    renderAsterisk(key);
  }

  function pickAsteriskReason(reason){
    if (!asteriskEditing) return;
    const inp = document.getElementById('asteriskNote');
    if (inp) asteriskDraft.note = inp.value;
    asteriskDraft.reason = reason;
    renderAsterisk(asteriskEditing);
  }

  function closeAsteriskEditor(){
    const key = asteriskEditing;
    asteriskEditing = null; asteriskDraft = null;
    if (key) renderAsterisk(key);
  }

  function writeAsterisk(key, value){
    const data = loadData();
    if (!data[key]) data[key] = { tasks: [] };
    if (value) data[key].asterisk = value; else delete data[key].asterisk;
    saveData(data);
    asteriskEditing = null; asteriskDraft = null;
    renderCalendar();
    renderAsterisk(key);
    if (key === todayKey) renderToday();
  }

  function saveAsterisk(key){
    if (!asteriskDraft || !asteriskDraft.reason) return;
    const inp = document.getElementById('asteriskNote');
    const note = (inp ? inp.value : asteriskDraft.note || '').trim();
    writeAsterisk(key, { reason: asteriskDraft.reason, note });
  }

  function removeAsterisk(key){ writeAsterisk(key, null); }

  function renderTodayAsterisk(){
    const el = document.getElementById('todayAsterisk');
    if (!el) return;
    const a = asteriskOf(todayKey);
    el.innerHTML = a ? `✱ ${asteriskLabel(a)}${a.note ? ' — ' + escHtml(a.note) : ''}` : '';
    el.style.display = a ? 'block' : 'none';
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
    afterTaskToggle(key, day.tasks[i]);
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
    if (scope === 'week' || scope === 'month') renderTodayAims();

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

  // ── AIMS ON TODAY ──
  // The same aims as Month, not a copy — read straight from this week's and
  // this month's keys. Always the current period, whatever week Month is on.

  function currentAimsKey(scope){
    const now = new Date();
    return scope === 'week'
      ? 'theosGoals-week-' + ymd(weekStartOf(now))
      : 'theosGoals-month-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  function loadCurrentAims(scope){
    try { return JSON.parse(localStorage.getItem(currentAimsKey(scope)) || '[]'); }
    catch { return []; }
  }

  function tickTodayAim(scope, i, delta){
    const key = currentAimsKey(scope);
    const arr = loadCurrentAims(scope);
    const g = arr[i];
    if (!g) return;
    if (g.type === 'recurring') {
      g.current = Math.max(0, Math.min(g.target, g.current + (delta || 1)));
      g.done = g.current >= g.target;
    } else {
      g.done = !g.done;
    }
    localStorage.setItem(key, JSON.stringify(arr));
    queueSync();
    renderTodayAims();
    // keep Month in step if it's showing the same period
    renderGoals('week');
    renderGoals('month');
  }

  function openMonthAims(){
    const now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth();
    selKey = null;
    const dv = document.getElementById('dayView');
    if (dv) dv.style.display = 'none';
    localStorage.setItem('theosAimsOpen-week', 'open');
    switchTab('month', document.querySelector('.tabbtn[aria-label="Month"]'));
  }

  function renderTodayAims(){
    const list = document.getElementById('todayAimsList');
    if (!list) return;
    const week = loadCurrentAims('week');
    const month = loadCurrentAims('month');
    const doneOf = a => a.filter(g => g.done).length;

    const meta = document.getElementById('aimsMeta-today');
    if (meta) {
      meta.textContent = (week.length ? doneOf(week) + ' of ' + week.length : 'none this week')
        + (month.length ? ' · month ' + doneOf(month) + ' of ' + month.length : '');
    }

    const rows = (scope, arr) => arr.map((g, i) => {
      const rec = g.type === 'recurring';
      return `<div class="today-aim${g.done ? ' done' : ''}">
        <div class="res-cb" onclick="tickTodayAim('${scope}',${i}${rec ? ',1' : ''})">${g.done ? '✓' : ''}</div>
        <span class="today-aim-title"${rec ? '' : ` onclick="tickTodayAim('${scope}',${i})"`}>${escHtml(g.title)}</span>
        ${rec ? `<span class="today-aim-count">${g.current}/${g.target}</span>
          <button class="res-btn" onclick="tickTodayAim('${scope}',${i},-1)" aria-label="One less">−</button>
          <button class="res-btn" onclick="tickTodayAim('${scope}',${i},1)" aria-label="One more">+</button>` : ''}
      </div>`;
    }).join('');

    let h = '';
    if (month.length) h += '<div class="today-aims-sub">This week</div>';
    h += week.length
      ? rows('week', week)
      : '<p class="today-aims-empty">Nothing set for this week. <button class="today-aims-link" onclick="openMonthAims()">Add aims in Month</button></p>';
    if (month.length) h += '<div class="today-aims-sub">This month</div>' + rows('month', month);
    list.innerHTML = h;
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
  
