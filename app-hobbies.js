// theo's day — app-hobbies.js
// The hobby switcher only. Each hobby lives in its own file:
//   reading  → app-reading.js
//   cooking  → app-cooking.js   (not built yet)
//   drawing  → app-drawing.js   (not built yet)
//   chess    → app-chess.js     (not built yet)
//   writing  → app-writing.js   (not built yet)
// renderHobbies() hands off to the right renderer; nothing hobby-specific
// belongs in here.

  // ── HOBBIES ──
  // Shell for now: the tab, the switcher, and a placeholder per hobby. Each one
  // gets built out on its own rather than all at once.

  const HOBBIES = [
    { key:'chess',   name:'Chess',   note:'Rapid games imported from Chess.com, an archive you can tag and annotate, a study log by phase, and graphs of rating against games played.' },
    { key:'drawing', name:'Drawing', note:'A log per sketch — subject, location, medium, time spent and how it felt — with sketches per week as the progress line.' },
    { key:'cooking', name:'Cooking', note:'Dishes you return to, each with its attempts: rating out of 10, what you would change next time, time taken and the recipe source. Plus a to-try queue.' },
    { key:'reading', name:'Reading', note:'Books with pages as you go, a rating out of 5 and what you took from it on finishing, a separate quote collection, and a link out to Goodreads.' },
    { key:'writing', name:'Writing', note:'Waiting on your Obsidian vault. Fragments captured on the move, pieces tracked and linked out rather than drafted here.' }
  ];

  function currentHobby(){ return localStorage.getItem('theosHobby') || 'cooking'; }

  function pickHobby(key){
    localStorage.setItem('theosHobby', key);
    readingState.view = 'shelf';
    hobbyMenuOpen = false;
    renderHobbies();
  }

  // a hobby in a detail view takes over the screen — no switcher in the way
  function hobbySubview(){
    return currentHobby() === 'reading' && readingState.view !== 'shelf';
  }

  let hobbyMenuOpen = false;
  function toggleHobbyMenu(){ hobbyMenuOpen = !hobbyMenuOpen; renderHobbies(); }

  function renderHobbies(){
    const cur = currentHobby();
    const hb = HOBBIES.find(x => x.key === cur) || HOBBIES[0];
    const header = document.getElementById('hobbyHeader');
    const sub = hobbySubview();

    if (header) {
      header.innerHTML = sub ? '' : `
        <div class="hobby-head">
          <span class="hobby-head-fixed">Hobbies —</span>
          <button class="hobby-pick" onclick="toggleHobbyMenu()">
            ${escHtml(hb.name)}<span class="hobby-caret${hobbyMenuOpen ? ' open' : ''}">&rsaquo;</span>
          </button>
        </div>
        ${hobbyMenuOpen ? `<div class="hobby-menu">
          ${HOBBIES.filter(x => x.key !== cur).map(x =>
            `<button class="hobby-menu-item" onclick="pickHobby('${x.key}')">${escHtml(x.name)}</button>`).join('')}
        </div>` : ''}`;
    }

    const body = document.getElementById('hobbyBody');
    if (!body) return;
    if (cur === 'reading') return renderReading(body);
    body.innerHTML = `
      <div class="hobby-soon">
        <div class="hobby-soon-title">${escHtml(hb.name)}</div>
        <p>${escHtml(hb.note)}</p>
        <div class="hobby-soon-tag">Coming soon</div>
      </div>`;
  }
