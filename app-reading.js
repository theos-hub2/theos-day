// theo's day — app-reading.js
// Part of the app. Loaded by index.html in order; every function is global.

  // ── READING ──
  // Three screens: what you're reading now, a Year page you browse, and a
  // Manage page for imports and dates. Page counts come from finished books
  // rather than daily logging.

  function loadBooks(){
    try { return JSON.parse(localStorage.getItem('theosBooks') || '[]'); }
    catch { return []; }
  }
  function saveBooks(b){ localStorage.setItem('theosBooks', JSON.stringify(b)); queueSync(); }

  function loadQuotes(){
    try { return JSON.parse(localStorage.getItem('theosQuotes') || '[]'); }
    catch { return []; }
  }
  function saveQuotes(q){ localStorage.setItem('theosQuotes', JSON.stringify(q)); queueSync(); }

  let readingState = { view:'shelf', bookId:null, results:[], searching:false, msg:'',
                       adding:false, finishing:null, quoting:null, shelfQuery:'' };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // days you actually read a book — older entries stored page numbers, which we
  // no longer ask for, so fall back to just their dates
  function bookSessions(b){
    if (Array.isArray(b.sessions)) return b.sessions;
    return (b.progress || []).map(p => p.date);
  }

  function readToday(b){ return bookSessions(b).includes(getTodayKey()); }

  function daysAgo(dateKey){
    const n = Math.round((new Date(getTodayKey()) - new Date(dateKey)) / 86400000);
    if (n <= 0) return 'today';
    if (n === 1) return 'yesterday';
    return n + ' days ago';
  }

  function markRead(id){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    const s = bookSessions(b).slice();
    const today = getTodayKey();
    if (s.includes(today)) s.splice(s.indexOf(today), 1);
    else { s.push(today); s.sort(); tickReadTask(); }
    b.sessions = s;
    delete b.progress;
    if (!b.started) b.started = s[0] || today;
    saveBooks(books);
    renderHobbies();
  }

  function tickReadTask(){
    const key = getTodayKey();
    const day = getDay(key);
    const task = day.tasks.find(t => t.text.trim().toLowerCase() === 'read');
    if (task) task.done = true;
    else day.tasks.push({ text:'Read', detail:'', done:true });
    saveDay(key, day);
    renderToday();
  }

  // ── ADDING ──

  async function searchBooks(){
    const q = (document.getElementById('bookSearch') || {}).value || '';
    if (!q.trim()) return;
    readingState.searching = true;
    readingState.msg = '';
    renderHobbies();
    try {
      const url = 'https://openlibrary.org/search.json?limit=6&fields=key,title,author_name,number_of_pages_median,first_publish_year,cover_i&q='
                + encodeURIComponent(q.trim());
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      readingState.results = (data.docs || []).map(d => ({
        title: d.title,
        author: (d.author_name || [])[0] || '',
        pages: d.number_of_pages_median || 0,
        year: d.first_publish_year || '',
        cover: d.cover_i || 0
      }));
      if (!readingState.results.length) readingState.msg = 'Nothing found — add it by hand.';
    } catch (e) {
      readingState.results = [];
      readingState.msg = "Couldn't reach Open Library — add it by hand.";
    }
    readingState.searching = false;
    renderHobbies();
  }

  function addBookFrom(i){
    const r = readingState.results[i];
    if (!r) return;
    addBook(r.title, r.author, r.pages, '', '', { cover: r.cover });
    readingState.results = [];
    readingState.adding = false;
    renderHobbies();
  }

  function addBookManual(){
    const v = id => (document.getElementById(id) || {}).value || '';
    const t = v('bookTitle');
    if (!t.trim()) return;
    addBook(t.trim(), v('bookAuthor').trim(), parseInt(v('bookPages')) || 0,
            v('bookStarted'), v('bookFinished'));
    readingState.adding = false;
    renderHobbies();
  }

  function addBook(title, author, pages, started, finished, extra){
    const books = loadBooks();
    const b = {
      id: uid(), title, author, pages: pages || 0,
      status: 'reading', started: started || getTodayKey(),
      sessions: [], rating: 0, takeaways: ''
    };
    if (extra && extra.cover) b.cover = extra.cover;
    if (extra && extra.isbn) b.isbn = extra.isbn;
    if (finished) { b.status = 'finished'; b.finished = finished; }
    books.push(b);
    saveBooks(books);
  }

  function toggleAdding(){
    readingState.adding = !readingState.adding;
    readingState.results = [];
    readingState.msg = '';
    renderHobbies();
  }

  // ── BOOK EDITS ──

  function setBookDate(id, field, value){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    if (value) b[field] = value; else delete b[field];
    if (field === 'finished' && value && b.status === 'reading') b.status = 'finished';
    saveBooks(books);
    renderHobbies();
  }

  // "I read this, but I've no idea when I started" — keeps it off the calendar
  // and out of the list of dates still to fill in
  function toggleUntracked(id){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    if (b.noStart) { delete b.noStart; if (!b.started) b.started = b.finished || ''; }
    else { b.noStart = true; b.started = ''; }
    saveBooks(books);
    renderHobbies();
  }

  // everything finished before 2026 in one go
  function markPre2026(){
    const books = loadBooks();
    let n = 0;
    books.forEach(b => {
      if (b.status !== 'finished') return;
      if (b.noStart) return;
      if (b.finished && b.finished >= '2026-01-01') return;
      b.noStart = true;
      b.started = '';
      n++;
    });
    saveBooks(books);
    readingState.msg = `Marked ${n} book${n === 1 ? '' : 's'} as untracked.`;
    renderHobbies();
  }

  function setBookStatus(id, status){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.status = status;
    if (status === 'finished' && !b.finished) b.finished = getTodayKey();
    if (status === 'reading') {
      delete b.finished;
      if (!b.started) b.started = getTodayKey();
    }
    if (status === 'toread') { delete b.finished; b.started = ''; }
    saveBooks(books);
    renderHobbies();
  }

  // Finishing opens an optional panel. You can rate it now or walk away —
  // books without takeaways are marked in the shelf so you can come back.
  function finishBook(id){
    setBookStatusQuiet(id, 'finished');
    readingState.finishing = id;
    renderHobbies();
  }

  function setBookStatusQuiet(id, status){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.status = status;
    if (status === 'finished' && !b.finished) b.finished = getTodayKey();
    saveBooks(books);
  }

  function closeFinish(){
    readingState.finishing = null;
    renderHobbies();
  }

  function saveFinishNotes(id){
    const el = document.getElementById('finishNotes');
    if (el) saveTakeaways(id, el.value);
    readingState.finishing = null;
    renderHobbies();
  }

  function startQuote(id){
    readingState.quoting = readingState.quoting === id ? null : id;
    renderHobbies();
  }

  function saveCardQuote(id){
    const t = (document.getElementById('cardQuote') || {}).value || '';
    if (!t.trim()) { readingState.quoting = null; renderHobbies(); return; }
    const pageEl = document.getElementById('cardQuotePage');
    const q = loadQuotes();
    q.push({
      id: uid(), text: t.trim(), bookId: id,
      page: pageEl && pageEl.value ? parseInt(pageEl.value) : null,
      date: getTodayKey()
    });
    saveQuotes(q);
    readingState.quoting = null;
    renderHobbies();
  }

  function setBookPages(id, value){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.pages = parseInt(value) || 0;
    saveBooks(books);
  }

  function rateBook(id, n){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.rating = (b.rating === n ? 0 : n);
    saveBooks(books);
    renderHobbies();
  }

  function saveTakeaways(id, text){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.takeaways = text;
    saveBooks(books);
  }

  function deleteBook(id){
    saveBooks(loadBooks().filter(x => x.id !== id));
    readingState.view = 'shelf';
    renderHobbies();
  }

  // ── QUOTES ──

  function addQuote(){
    const t = (document.getElementById('newQuoteText') || {}).value || '';
    if (!t.trim()) return;
    const bookSel = document.getElementById('newQuoteBook');
    const pageEl = document.getElementById('newQuotePage');
    const q = loadQuotes();
    q.push({
      id: uid(), text: t.trim(),
      bookId: bookSel && bookSel.value ? bookSel.value : null,
      page: pageEl && pageEl.value ? parseInt(pageEl.value) : null,
      date: getTodayKey()
    });
    saveQuotes(q);
    renderHobbies();
  }

  function deleteQuote(id){
    saveQuotes(loadQuotes().filter(x => x.id !== id));
    renderHobbies();
  }

  // ── GOODREADS CSV IMPORT ──

  function parseCSV(text){
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i+1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1);
  }

  function grDate(s){
    const m = String(s || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!m) return '';
    return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  }

  function importGoodreads(input){
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { applyGoodreads(String(reader.result)); }
      catch (e) { readingState.msg = 'Could not read that file — ' + e.message; renderHobbies(); }
    };
    reader.onerror = () => { readingState.msg = 'Could not read that file.'; renderHobbies(); };
    reader.readAsText(file);
  }

  function applyGoodreads(text){
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('empty file');
    const head = rows[0].map(s => s.trim());
    const col = name => head.indexOf(name);
    const iTitle = col('Title'), iAuthor = col('Author'), iPages = col('Number of Pages');
    const iRead = col('Date Read'), iAdded = col('Date Added'), iShelf = col('Exclusive Shelf');
    const iRating = col('My Rating'), iReview = col('My Review');
    const iIsbn13 = col('ISBN13'), iIsbn = col('ISBN');
    const cleanIsbn = s => String(s || '').replace(/[^0-9Xx]/g, '');
    if (iTitle < 0) throw new Error('that does not look like a Goodreads export');

    const books = loadBooks();
    const seen = new Set(books.map(b => (b.title + '|' + (b.author || '')).toLowerCase()));
    let added = 0, skipped = 0;

    rows.slice(1).forEach(r => {
      const title = (r[iTitle] || '').trim();
      if (!title) return;
      const author = iAuthor >= 0 ? (r[iAuthor] || '').trim() : '';
      const shelf = iShelf >= 0 ? (r[iShelf] || '').trim() : 'read';
      const dedupe = (title + '|' + author).toLowerCase();
      if (seen.has(dedupe)) { skipped++; return; }
      seen.add(dedupe);

      const b = {
        id: uid(), title, author,
        pages: iPages >= 0 ? parseInt(r[iPages]) || 0 : 0,
        status: shelf === 'currently-reading' ? 'reading'
              : shelf === 'to-read' ? 'toread' : 'finished',
        started: '', sessions: [],
        rating: iRating >= 0 ? parseInt(r[iRating]) || 0 : 0,
        takeaways: iReview >= 0 ? (r[iReview] || '').trim() : ''
      };
      const isbn = cleanIsbn(iIsbn13 >= 0 ? r[iIsbn13] : '') || cleanIsbn(iIsbn >= 0 ? r[iIsbn] : '');
      if (isbn.length >= 10) b.isbn = isbn;
      const readOn = iRead >= 0 ? grDate(r[iRead]) : '';
      const addedOn = iAdded >= 0 ? grDate(r[iAdded]) : '';
      if (b.status === 'finished') {
        // Goodreads exports no start date, and its shelving date is when you
        // wanted the book, not when you opened it. Leave start = finish and
        // correct it in Manage.
        b.finished = readOn || addedOn || getTodayKey();
        b.started = b.finished;
      } else if (b.status === 'reading') {
        b.started = addedOn || getTodayKey();
      }
      books.push(b);
      added++;
    });

    saveBooks(books);
    readingState.msg = `Imported ${added} book${added === 1 ? '' : 's'}` +
                       (skipped ? `, skipped ${skipped} already here` : '') +
                       ". Goodreads doesn't export start dates — set them in Edit dates.";
    renderHobbies();
  }

  // ── COLOURS & CALENDAR ──

  const BOOK_COLORS = ['#dbeadf','#e8e2cf','#dfe4ee','#f0e2de','#e6e0ea','#dcebe8','#efe8d4','#e4e9da'];
  function bookColor(id){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (b && b.color) return b.color;
    const i = books.findIndex(x => x.id === id);
    return BOOK_COLORS[(i < 0 ? 0 : i) % BOOK_COLORS.length];
  }

  function setBookColor(id, color){
    const books = loadBooks();
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.color = color;
    saveBooks(books);
    renderHobbies();
  }

  // Covers live on Open Library's servers, so the app stores a link rather than
  // an image. No cover, no problem — the spine falls back to its colour.
  function coverUrl(b){
    if (b.cover) return `https://covers.openlibrary.org/b/id/${b.cover}-M.jpg`;
    if (b.isbn)  return `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg`;
    return '';
  }

  function booksOn(dateKey){
    const today = getTodayKey();
    return loadBooks().filter(b => {
      if (!b.started || b.status === 'toread') return false;
      const end = b.finished || (b.status === 'reading' ? today : b.started);
      return dateKey >= b.started && dateKey <= end;
    });
  }

  let readCalYear = null, readCalMonth = null;
  function readCalShift(d){
    const x = new Date(readCalYear, readCalMonth + d, 1);
    readCalYear = x.getFullYear();
    readCalMonth = x.getMonth();
    renderHobbies();
  }

  function readingCalendarHTML(){
    const now = new Date();
    if (readCalYear == null) { readCalYear = now.getFullYear(); readCalMonth = now.getMonth(); }
    const MONTHS = ['January','February','March','April','May','June','July',
                    'August','September','October','November','December'];
    const first = new Date(readCalYear, readCalMonth, 1);
    const days = new Date(readCalYear, readCalMonth + 1, 0).getDate();
    const lead = first.getDay();

    let h = `<div class="cal-header" style="padding-top:0">
               <button class="cal-nav" onclick="readCalShift(-1)" aria-label="Previous month">&lsaquo;</button>
               <span class="cal-title">${MONTHS[readCalMonth]} ${readCalYear}</span>
               <button class="cal-nav" onclick="readCalShift(1)" aria-label="Next month">&rsaquo;</button>
             </div>
             <div class="cal-grid">`;
    ['S','M','T','W','T','F','S'].forEach(n => h += `<div class="cal-day-name">${n}</div>`);
    for (let i = 0; i < lead; i++) h += '<div></div>';

    const seen = new Map();
    for (let d = 1; d <= days; d++) {
      const key = `${readCalYear}-${String(readCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const on = booksOn(key);
      on.forEach(b => seen.set(b.id, b));
      let style = '';
      if (on.length === 1) style = `background:${bookColor(on[0].id)};`;
      else if (on.length > 1) {
        const c = on.slice(0,2).map(b => bookColor(b.id));
        style = `background:linear-gradient(to bottom, ${c[0]} 0 50%, ${c[1]} 50% 100%);`;
      }
      h += `<div class="cal-day read-day" style="${style}"><div class="cal-day-number">${d}</div></div>`;
    }
    h += '</div>';

    if (seen.size) {
      h += '<div class="chart-legend" style="margin-top:10px">' +
        [...seen.values()].map(b =>
          `<span class="legend-item"><i style="background:${bookColor(b.id)}"></i>${escHtml(b.title)}</span>`).join('') +
        '</div>';
    }
    return h;
  }

  // ── STATS ──

  function finishedInYear(year){
    return loadBooks().filter(b => b.status === 'finished' && b.finished &&
                                   Number(b.finished.slice(0,4)) === year);
  }

  // pages come from books you finished, not from anything you had to log
  function byMonth(year){
    const books = Array(12).fill(0), pages = Array(12).fill(0);
    finishedInYear(year).forEach(b => {
      const m = Number(b.finished.slice(5,7)) - 1;
      books[m]++;
      pages[m] += b.pages || 0;
    });
    return { books, pages };
  }

  // ── RENDER ──

  function renderReading(body){
    if (readingState.view === 'book')    return renderBookDetail(body);
    if (readingState.view === 'year')    return renderReadingYear(body);
    if (readingState.view === 'manage')  return renderReadingManage(body);
    if (readingState.view === 'shelves') return renderShelves(body);

    const books = loadBooks();
    const reading = books.filter(b => b.status === 'reading');
    const counts = {
      toread: books.filter(b => b.status === 'toread').length,
      finished: books.filter(b => b.status === 'finished').length,
      abandoned: books.filter(b => b.status === 'abandoned').length
    };

    let h = '';

    if (readingState.finishing) {
      const fb = books.find(x => x.id === readingState.finishing);
      if (fb) {
        h += `<div class="finish-panel">
          <div class="finish-title">Finished ${escHtml(fb.title)}</div>
          <div class="star-row" style="margin-top:10px">${[1,2,3,4,5].map(n =>
            `<button class="star${fb.rating >= n ? ' on' : ''}" onclick="rateBook('${fb.id}',${n})">★</button>`
          ).join('')}</div>
          <textarea id="finishNotes" class="takeaway" rows="4" style="margin-top:12px"
                    placeholder="What you took from it — or leave this for later">${escHtml(fb.takeaways || '')}</textarea>
          <div class="finish-actions">
            <button class="sync-btn" onclick="closeFinish()">Later</button>
            <button class="btn btn-add" onclick="saveFinishNotes('${fb.id}')">Save</button>
          </div>
        </div>`;
      }
    }

    h += '<div class="section-label" style="margin-top:18px">Reading now</div>';

    if (!reading.length) {
      h += '<p class="sync-blurb">Nothing on the go.</p>';
    } else {
      reading.forEach(b => {
        const done = readToday(b);
        const days = bookSessions(b).length;
        h += `<div class="book-card" style="border-left-color:${bookColor(b.id)}">
          <div class="book-head" onclick="openBook('${b.id}')">
            <div>
              <div class="book-title">${escHtml(b.title)}</div>
              ${b.author ? `<div class="book-author">${escHtml(b.author)}</div>` : ''}
            </div>
            <span class="gym-ex-chev">&rsaquo;</span>
          </div>
          <div class="book-meta">${
            (b.started ? 'started ' + daysAgo(b.started) : 'not started') +
            (days ? ' · ' + days + ' day' + (days === 1 ? '' : 's') + ' read' : '')
          }</div>
          <div class="book-foot">
            <button class="read-today${done ? ' done' : ''}" onclick="markRead('${b.id}')">
              ${done ? '✓ Read today' : 'Read today'}
            </button>
            <button class="card-btn" onclick="startQuote('${b.id}')">Quote</button>
            <button class="card-btn" onclick="finishBook('${b.id}')">Finished</button>
          </div>
          ${readingState.quoting === b.id ? `
            <div class="card-panel">
              <textarea id="cardQuote" rows="3" placeholder="Something worth keeping…"></textarea>
              <div class="res-add-line2" style="margin-top:8px">
                <input type="number" id="cardQuotePage" placeholder="page" style="flex:1;min-width:0"/>
                <button class="btn btn-add" onclick="saveCardQuote('${b.id}')">Save</button>
              </div>
            </div>` : ''}
        </div>`;
      });
    }

    // add a book, behind a single control
    h += `<button class="add-book-btn" onclick="toggleAdding()">${readingState.adding ? '– Close' : '+ Add a book'}</button>`;
    if (readingState.adding) {
      h += `<div class="add-book-panel">
        <div class="book-search">
          <input type="text" id="bookSearch" placeholder="Search by title…" autocomplete="off"/>
          <button class="btn btn-add" onclick="searchBooks()">${readingState.searching ? '…' : 'Find'}</button>
        </div>
        ${readingState.msg ? `<p class="sync-blurb">${escHtml(readingState.msg)}</p>` : ''}
        ${readingState.results.length ? '<div class="book-results">' + readingState.results.map((r, i) =>
          `<div class="book-result" onclick="addBookFrom(${i})">
             <div class="book-result-title">${escHtml(r.title)}</div>
             <div class="book-result-meta">${escHtml(r.author)}${r.year ? ' · ' + r.year : ''}${r.pages ? ' · ' + r.pages + 'pp' : ''}</div>
           </div>`).join('') + '</div>' : ''}
        <div class="goal-add" style="margin-top:12px">
          <input type="text" id="bookTitle" placeholder="Or type the title"/>
          <div class="res-add-line2">
            <input type="text" id="bookAuthor" placeholder="Author" style="flex:1;min-width:0"/>
            <input type="number" id="bookPages" placeholder="Pages" style="width:88px"/>
          </div>
          <div class="date-pair">
            <label>Started<input type="date" id="bookStarted"/></label>
            <label>Finished<input type="date" id="bookFinished"/></label>
          </div>
          <button class="btn btn-add" style="width:100%" onclick="addBookManual()">Add</button>
        </div>
      </div>`;
    }

    // one quiet line for the shelves
    h += `<button class="shelf-line" onclick="readingGo('shelves')">
            ${counts.toread} to read · ${counts.finished} read · ${counts.abandoned} abandoned
          </button>`;

    h += `<div class="reading-nav">
            <button class="sync-btn" onclick="readingGo('year')">Year</button>
            <button class="sync-btn" onclick="readingGo('manage')">Manage</button>
          </div>`;

    body.innerHTML = h;
  }

  function readingGo(view){
    readingState.view = view;
    if (view === 'shelves') readingState.shelfQuery = '';
    renderHobbies();
  }
  function readingBack(){
    readingState.view = 'shelf';
    renderHobbies();
  }
  function openBook(id){
    readingState.view = 'book';
    readingState.bookId = id;
    renderHobbies();
  }

  // ── SHELVES ──

  function renderShelves(body){
    const books = loadBooks();
    const q = readingState.shelfQuery.trim().toLowerCase();
    const match = b => !q || b.title.toLowerCase().includes(q) ||
                       (b.author || '').toLowerCase().includes(q);

    let h = `<button class="gym-back" onclick="readingBack()">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Shelves</div>
             <input type="text" class="streak-search" id="shelfSearch" placeholder="Search title or author…"
                    value="${escHtml(readingState.shelfQuery)}" autocomplete="off"
                    oninput="shelfSearch(this.value)"/>
             <div id="shelfResults"></div>`;
    body.innerHTML = h;
    renderShelfGrids();
  }

  function shelfSearch(v){
    readingState.shelfQuery = v;
    renderShelfGrids();   // leaves the search box alone so the keyboard stays up
  }

  function renderShelfGrids(){
    const box = document.getElementById('shelfResults');
    if (!box) return;
    const books = loadBooks();
    const q = readingState.shelfQuery.trim().toLowerCase();
    const match = b => !q || b.title.toLowerCase().includes(q) ||
                       (b.author || '').toLowerCase().includes(q);

    const groups = [
      ['reading', 'Reading now'],
      ['toread', 'To read'],
      ['finished', 'Finished'],
      ['abandoned', 'Abandoned']
    ];

    let h = '';
    let any = false;
    const shown = [];
    groups.forEach(([status, label]) => {
      const list = books.filter(b => b.status === status && match(b))
        .sort((a, b2) => (b2.finished || b2.started || '').localeCompare(a.finished || a.started || ''));
      if (!list.length) return;
      any = true;
      const key = 'sh-' + status;
      shown.push(key);
      h += `<button class="aims-toggle" onclick="toggleAims('${key}')">
              <span class="aims-label">${label}</span>
              <span class="aims-meta">${list.length}</span>
              <span class="aims-chev" id="aimsChev-${key}">&rsaquo;</span>
            </button>
            <div class="aims-body" id="aimsBody-${key}">
              <div class="shelf-grid">${list.map(b => spineHTML(b)).join('')}</div>
            </div>`;
    });

    box.innerHTML = any ? h : `<p class="sync-blurb">${q ? 'Nothing matches that.' : 'No books yet.'}</p>`;
    shown.forEach(applyAimsState);
  }

  // a spine: the cover if Open Library has one, otherwise the book's colour
  function spineHTML(b){
    const url = coverUrl(b);
    const needsNote = b.status === 'finished' && !(b.takeaways || '').trim();
    return `<button class="spine" onclick="openBook('${b.id}')">
      <div class="spine-art" style="background:${bookColor(b.id)}">
        ${url ? `<img src="${url}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : ''}
        ${b.rating ? `<span class="spine-rating">${'★'.repeat(b.rating)}</span>` : ''}
        ${needsNote ? '<span class="spine-note" title="No takeaways yet"></span>' : ''}
      </div>
      <div class="spine-title">${escHtml(b.title)}</div>
    </button>`;
  }

  // ── YEAR ──

  function renderReadingYear(body){
    const year = new Date().getFullYear();
    const done = finishedInYear(year);
    const { books: perMonth, pages: pagesMonth } = byMonth(year);
    const totalPages = pagesMonth.reduce((a, b) => a + b, 0);
    const rated = done.filter(b => b.rating);
    const avg = rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1) : '—';
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let h = `<button class="gym-back" onclick="readingBack()">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">${year}</div>`;

    h += `<div class="read-stats" style="margin-top:14px">
            <div class="read-stat"><span class="rs-n">${done.length}</span><span class="rs-l">books</span></div>
            <div class="read-stat"><span class="rs-n">${totalPages.toLocaleString()}</span><span class="rs-l">pages</span></div>
            <div class="read-stat"><span class="rs-n">${avg}</span><span class="rs-l">avg rating</span></div>
          </div>`;

    if (done.length) {
      h += `<div class="chart-block">
              <div class="chart-title">By month</div>
              ${lineChart({
                labels: MON.map((m, i) => `${year}-${String(i+1).padStart(2,'0')}-01`),
                series: [
                  { name:'Books', color:'#1a4d2e', values: perMonth },
                  { name:'Pages', color:'#b07d3a', values: pagesMonth, axis:'right' }
                ],
                yLabel:'books', y2Label:'pages', monthLabels:true
              })}
            </div>
            <div class="chart-legend">
              <span class="legend-item"><i style="background:#1a4d2e"></i>Books</span>
              <span class="legend-item"><i style="background:#b07d3a"></i>Pages</span>
            </div>`;
    }

    h += `<div class="section-label" style="margin-top:24px">Reading calendar</div>${readingCalendarHTML()}`;

    // quotes live here — added rarely, read in bulk
    const quotes = loadQuotes();
    const books = loadBooks();
    h += `<button class="aims-toggle" onclick="toggleAims('quotes')">
            <span class="aims-label">Quotes</span>
            <span class="aims-meta">${quotes.length || ''}</span>
            <span class="aims-chev" id="aimsChev-quotes">&rsaquo;</span>
          </button>
          <div class="aims-body collapsed" id="aimsBody-quotes">
            <div class="goal-add">
              <textarea id="newQuoteText" rows="3" placeholder="Something worth keeping…"></textarea>
              <div class="res-add-line2">
                <select id="newQuoteBook" style="flex:1;min-width:0">
                  <option value="">No book</option>
                  ${books.map(b => `<option value="${b.id}">${escHtml(b.title)}</option>`).join('')}
                </select>
                <input type="number" id="newQuotePage" placeholder="p." style="width:70px"/>
                <button class="btn btn-add" onclick="addQuote()">Save</button>
              </div>
            </div>
            ${quotes.length ? [...quotes].reverse().map(q => {
              const bk = books.find(b => b.id === q.bookId);
              return `<div class="quote-card">
                <div class="quote-text">${escHtml(q.text)}</div>
                <div class="quote-meta">${bk ? escHtml(bk.title) : 'Unattributed'}${q.page ? ' · p.' + q.page : ''}
                  <button class="gym-set-del" onclick="deleteQuote('${q.id}')">✕</button></div>
              </div>`;
            }).join('') : '<p class="sync-blurb">Nothing saved yet.</p>'}
          </div>`;

    body.innerHTML = h;
    applyAimsState('quotes');
  }

  // ── MANAGE ──

  function renderReadingManage(body){
    const books = loadBooks();
    const dated = books.filter(b => b.status === 'finished' || b.status === 'reading')
                       .sort((a, b2) => (b2.finished || b2.started || '').localeCompare(a.finished || a.started || ''));
    const needsDate = b => !b.noStart && (!b.started || b.started === b.finished);
    const unset = dated.filter(needsDate).length;
    const prePending = books.filter(b => b.status === 'finished' && !b.noStart &&
                                         (!b.finished || b.finished < '2026-01-01')).length;

    let h = `<button class="gym-back" onclick="readingBack()">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Manage</div>`;

    h += `<button class="aims-toggle" onclick="toggleAims('grimport')">
            <span class="aims-label">Import from Goodreads</span>
            <span class="aims-meta"></span>
            <span class="aims-chev" id="aimsChev-grimport">&rsaquo;</span>
          </button>
          <div class="aims-body collapsed" id="aimsBody-grimport">
            <p class="sync-blurb">On goodreads.com go to <em>My Books → Import and export → Export Library</em>, then pick the file here. It's read on your phone; nothing is uploaded.</p>
            <input type="file" accept=".csv,text/csv" class="gr-file" onchange="importGoodreads(this)"/>
            ${readingState.msg ? `<p class="sync-blurb">${escHtml(readingState.msg)}</p>` : ''}
          </div>`;

    h += `<button class="aims-toggle" onclick="toggleAims('dates')">
            <span class="aims-label">Edit dates</span>
            <span class="aims-meta">${unset ? unset + ' to check' : ''}</span>
            <span class="aims-chev" id="aimsChev-dates">&rsaquo;</span>
          </button>
          <div class="aims-body collapsed" id="aimsBody-dates">
            ${dated.length ? `<p class="sync-blurb">When did you actually start each one? If you weren't tracking back then, mark it untracked and it'll stop asking.</p>
              ${prePending ? `<button class="sync-btn" style="width:100%;margin-bottom:12px" onclick="markPre2026()">Mark ${prePending} pre-2026 book${prePending === 1 ? '' : 's'} as untracked</button>` : ''}`
              + dated.map(b => `
              <div class="date-edit-row${needsDate(b) ? ' needs' : ''}${b.noStart ? ' untracked' : ''}">
                <div class="date-edit-head">
                  <div class="book-title">${escHtml(b.title)}</div>
                  <button class="untrack-btn${b.noStart ? ' on' : ''}" onclick="toggleUntracked('${b.id}')">
                    ${b.noStart ? 'untracked' : "didn't track"}
                  </button>
                </div>
                ${b.noStart ? `<div class="book-meta">${b.finished ? 'Finished ' + shortDate(b.finished) : 'No dates'}</div>` : `
                <div class="date-pair" style="margin-top:6px">
                  <label>Started<input type="date" value="${b.started || ''}"
                         onchange="setBookDate('${b.id}','started',this.value)"/></label>
                  <label>Finished<input type="date" value="${b.finished || ''}"
                         onchange="setBookDate('${b.id}','finished',this.value)"/></label>
                </div>`}
              </div>`).join('') : '<p class="sync-blurb">Nothing to edit yet.</p>'}
          </div>`;

    h += `<a class="goodreads-link" href="https://www.goodreads.com" target="_blank" rel="noopener">Open Goodreads</a>`;

    body.innerHTML = h;
    applyAimsState('grimport');
    applyAimsState('dates');
  }

  // ── BOOK PAGE ──

  function renderBookDetail(body){
    const b = loadBooks().find(x => x.id === readingState.bookId);
    if (!b) { readingBack(); return; }
    const quotes = loadQuotes().filter(q => q.bookId === b.id);
    const sessions = bookSessions(b);
    const readDays = b.started
      ? Math.max(1, Math.round(((b.finished ? new Date(b.finished) : new Date()) - new Date(b.started)) / 86400000) + 1)
      : null;

    let h = `<button class="gym-back" onclick="readingBack()">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">${escHtml(b.title)}</div>
             ${b.author ? `<div class="book-author" style="margin-bottom:14px">${escHtml(b.author)}</div>` : ''}`;

    h += `<div class="read-stats" style="margin-top:10px">
            <div class="read-stat"><span class="rs-n">${b.pages || '—'}</span><span class="rs-l">pages</span></div>
            ${readDays ? `<div class="read-stat"><span class="rs-n">${readDays}</span><span class="rs-l">days</span></div>` : ''}
            ${sessions.length ? `<div class="read-stat"><span class="rs-n">${sessions.length}</span><span class="rs-l">days read</span></div>` : ''}
          </div>`;

    h += `<div class="date-pair" style="margin-top:14px">
            <label>Started<input type="date" value="${b.started || ''}"
                   onchange="setBookDate('${b.id}','started',this.value)"/></label>
            <label>Finished<input type="date" value="${b.finished || ''}"
                   onchange="setBookDate('${b.id}','finished',this.value)"/></label>
          </div>
          <div class="date-pair" style="margin-top:8px">
            <label>Pages<input type="number" inputmode="numeric" value="${b.pages || ''}"
                   onchange="setBookPages('${b.id}',this.value)"/></label>
          </div>`;

    h += `<div class="book-status">
            ${[['toread','To read'],['reading','Reading'],['finished','Finished'],['abandoned','Abandoned']].map(([s,l]) =>
              `<button class="gym-variant${b.status === s ? ' active' : ''}" onclick="setBookStatus('${b.id}','${s}')">${l}</button>`
            ).join('')}
          </div>`;

    if (b.status === 'finished') {
      h += `<div class="section-label" style="margin-top:20px">Rating</div>
            <div class="star-row">${[1,2,3,4,5].map(n =>
              `<button class="star${b.rating >= n ? ' on' : ''}" onclick="rateBook('${b.id}',${n})">★</button>`
            ).join('')}</div>
            <div class="section-label" style="margin-top:18px">What you took from it</div>
            <textarea class="takeaway" rows="5" placeholder="A few lines…"
                      onchange="saveTakeaways('${b.id}',this.value)">${escHtml(b.takeaways || '')}</textarea>`;
    }

    h += `<div class="section-label" style="margin-top:20px">Calendar colour</div>
          <div class="swatch-row">
            ${BOOK_COLORS.map(c => `<button class="swatch${bookColor(b.id) === c ? ' active' : ''}"
                style="background:${c}" onclick="setBookColor('${b.id}','${c}')"></button>`).join('')}
          </div>`;

    if (quotes.length) {
      h += '<div class="section-label" style="margin-top:22px">Quotes</div>';
      h += [...quotes].reverse().map(q => `<div class="quote-card">
              <div class="quote-text">${escHtml(q.text)}</div>
              <div class="quote-meta">${q.page ? 'p.' + q.page : ''}
                <button class="gym-set-del" onclick="deleteQuote('${q.id}')">✕</button></div>
            </div>`).join('');
    }

    const gr = 'https://www.goodreads.com/search?q=' + encodeURIComponent(b.title + ' ' + (b.author || ''));
    h += `<a class="goodreads-link" href="${gr}" target="_blank" rel="noopener">Find on Goodreads</a>`;
    h += `<button class="sync-btn gym-drop" style="width:100%;margin-top:14px"
            onclick="deleteBook('${b.id}')">Remove this book</button>`;

    body.innerHTML = h;
  }
