// theo's day — app-gym.js
// Part of the app. Loaded by index.html in order; every function is global.

  // ── GYM ──

  const WORKOUT_ORDER = ['Upper','Lower','Push','Pull','Legs'];
  // Sun=0 … Sat=6. Tuesday and Saturday are rest.
  const GYM_SCHEDULE = { 0:'Upper', 1:'Lower', 3:'Push', 4:'Pull', 5:'Legs' };

  // `variants` means one routine entry, several ways of doing it. Each variant
  // keeps its own history, because 40kg on a barbell isn't 40kg on dumbbells.
  const DEFAULT_ROUTINE = {
    Upper: [
      { name:'Bench Press',              sets:4, reps:'6-10' },
      { name:'Row',                      sets:4, reps:'6-10' },
      { name:'Seated DB Shoulder Press', sets:3, reps:'8-12' },
      { name:'Lat Pulldown',             sets:3, reps:'10-12' },
      { name:'Pec Deck',                 sets:3, reps:'12-15' },
      { name:'DB Curl',                  sets:3, reps:'10-12' },
      { name:'Tricep Pushdown',          sets:3, reps:'12-15' }
    ],
    Lower: [
      { name:'Back Squat',          sets:4, reps:'6-10' },
      { name:'Romanian Deadlift',   sets:3, reps:'8-10' },
      { name:'Walking Lunge',       sets:3, reps:'10-12' },
      { name:'Leg Curl',            sets:3, reps:'10-12' },
      { name:'Standing Calf Raise', sets:4, reps:'12-15' },
      { name:'Weighted Plank',      sets:3, reps:'30-60s', mode:'time' }
    ],
    Push: [
      { name:'Incline Press',             sets:4, reps:'6-10' },
      { name:'Overhead Press',            sets:3, reps:'8-12' },
      { name:'Cable Fly',                 sets:3, reps:'12-15' },
      { name:'DB Lateral Raise',          sets:3, reps:'12-15' },
      { name:'Tricep Pushdown',           sets:3, reps:'12-15' },
      { name:'Overhead Tricep Extension', sets:3, reps:'12-15' }
    ],
    Pull: [
      { name:'Row',              sets:4, reps:'6-10' },
      { name:'Lat Pulldown',     sets:4, reps:'8-12' },
      { name:'Seated Cable Row', sets:3, reps:'10-12' },
      { name:'Face Pull',        sets:3, reps:'12-15' },
      { name:'DB Curl',          sets:3, reps:'10-12' },
      { name:'Preacher Curl',    sets:3, reps:'10-12' }
    ],
    Legs: [
      { name:'Deadlift',              sets:4, reps:'5-8' },
      { name:'Hip Thrust',            sets:3, reps:'10-12' },
      { name:'Bulgarian Split Squat', sets:3, reps:'10 ea' },
      { name:'Leg Curl',              sets:3, reps:'10-12' },
      { name:'Seated Calf Raise',     sets:4, reps:'15' },
      { name:'Cable Crunch',          sets:3, reps:'15' }
    ]
  };

  // A broad catalogue so most lifts are searchable without typing them in full.
  // Anything you add yourself gets appended to this list permanently.
  const EXERCISE_LIBRARY = [
    // Chest
    'Bench Press','Incline Press','Decline Press','Chest Press','Floor Press',
    'Push-Up','Dip','Cable Fly','Pec Deck','DB Fly','Incline DB Fly','Cable Crossover',
    'Svend Press','Landmine Press',
    // Back
    'Row','Seated Cable Row','Lat Pulldown','Pull-Up','Chin-Up','Assisted Pull-Up',
    'T-Bar Row','Pendlay Row','Meadows Row','Single-Arm DB Row','Inverted Row',
    'Straight-Arm Pulldown','Shrug','Rack Pull','Back Extension','Good Morning',
    // Shoulders
    'Overhead Press','Seated DB Shoulder Press','Arnold Press','DB Lateral Raise',
    'Cable Lateral Raise','Front Raise','Rear Delt Fly','Face Pull','Upright Row',
    // Arms
    'DB Curl','Barbell Curl','EZ Bar Curl','Preacher Curl','Hammer Curl',
    'Incline DB Curl','Concentration Curl','Cable Curl','Spider Curl',
    'Tricep Pushdown','Overhead Tricep Extension','Skull Crusher','Close-Grip Bench Press',
    'Tricep Kickback','Bench Dip','Wrist Curl','Reverse Curl','Farmer Carry',
    // Legs
    'Back Squat','Front Squat','Goblet Squat','Hack Squat','Leg Press','Split Squat',
    'Bulgarian Split Squat','Walking Lunge','Reverse Lunge','Step-Up','Sissy Squat',
    'Deadlift','Romanian Deadlift','Stiff-Leg Deadlift','Sumo Deadlift','Trap Bar Deadlift',
    'Hip Thrust','Glute Bridge','Leg Curl','Seated Leg Curl','Leg Extension',
    'Standing Calf Raise','Seated Calf Raise','Calf Press','Adductor Machine','Abductor Machine',
    'Nordic Curl','Box Jump',
    // Core
    'Plank','Weighted Plank','Side Plank','Hanging Knee Raise','Hanging Leg Raise',
    'Cable Crunch','Crunch','Sit-Up','Russian Twist','Ab Wheel','Dead Bug',
    'Mountain Climber','Hollow Hold','Pallof Press','Toes to Bar',
    // Conditioning
    'Treadmill','Stationary Bike','Rowing Machine','Elliptical','Stair Climber',
    'Jump Rope','Battle Ropes','Sled Push','Assault Bike'
  ];

  // Logged in seconds rather than reps. Weight stays optional — a weighted
  // plank records both, a bodyweight one just the hold.
  const TIME_BASED = new Set([
    'plank','weighted-plank','side-plank','hollow-hold','wall-sit','dead-hang',
    'farmer-carry','sled-push','battle-ropes','jump-rope',
    'treadmill','stationary-bike','rowing-machine','elliptical','stair-climber','assault-bike'
  ]);

  function exMode(ex){
    if (ex && ex.mode) return ex.mode;
    return (ex && TIME_BASED.has(slug(ex.name))) ? 'time' : 'reps';
  }

  // resolve mode from a storage key, for history views
  function modeForKey(key){
    const base = String(key).split('--')[0];
    let found = null;
    Object.values(loadRoutine()).forEach(l => l.forEach(e => {
      if (!found && slug(e.name) === base && e.mode) found = e.mode;
    }));
    if (found) return found;
    Object.values(loadGymLog()).forEach(s => (s.plan || []).forEach(e => {
      if (!found && slug(e.name) === base && e.mode) found = e.mode;
    }));
    return found || (TIME_BASED.has(base) ? 'time' : 'reps');
  }

  function fmtDur(sec){
    const n = Number(sec) || 0;
    if (n < 60) return n + 's';
    const m = Math.floor(n / 60), s = n % 60;
    return m + ':' + String(s).padStart(2,'0');
  }

  function loadCustomExercises(){
    try { return JSON.parse(localStorage.getItem('theosCustomExercises') || '[]'); }
    catch { return []; }
  }
  function rememberExercise(name){
    const list = loadCustomExercises();
    if (!list.some(n => slug(n) === slug(name))) {
      list.push(name);
      localStorage.setItem('theosCustomExercises', JSON.stringify(list));
    }
  }

  // Display only. Storage keys are built from the raw names, so expanding
  // abbreviations here can never renumber or orphan existing history.
  function pretty(s){
    return String(s || '')
      .replace(/\bdb\b/gi, 'Dumbbell')
      .replace(/\bbb\b/gi, 'Barbell')
      .replace(/\bez\b/gi, 'EZ')
      .replace(/\bor\b/gi, 'or');
  }

  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

  function loadRoutine(){
    try {
      const r = JSON.parse(localStorage.getItem('theosRoutine') || 'null');
      return r || JSON.parse(JSON.stringify(DEFAULT_ROUTINE));
    } catch { return JSON.parse(JSON.stringify(DEFAULT_ROUTINE)); }
  }
  function saveRoutine(r){ localStorage.setItem('theosRoutine', JSON.stringify(r)); }

  function loadGymLog(){
    try { return JSON.parse(localStorage.getItem('theosGymLog') || '{}'); }
    catch { return {}; }
  }
  function saveGymLog(l){ localStorage.setItem('theosGymLog', JSON.stringify(l)); queueSync(); }

  let gymState = {
    view: 'session',
    date: null,
    weekStart: null,
    workout: undefined,   // undefined = not picked yet; null = set to rest
    exercise: null,
    expanded: {},
    barOpen: {},
    moreOpen: {},
    bodyOpen: false,
    optionsOpen: false,
    suggest: []
  };

  function gymInit(){
    if (!gymState.date) gymState.date = getTodayKey();
    if (!gymState.weekStart) gymState.weekStart = ymd(weekStartOf(new Date()));
    if (gymState.workout === undefined) gymState.workout = defaultWorkoutFor(gymState.date);
  }

  function scheduledFor(dateKey){
    const d = new Date(dateKey + 'T00:00:00');
    return GYM_SCHEDULE[d.getDay()] || null;
  }

  function defaultWorkoutFor(dateKey){
    const log = loadGymLog();
    const s = log[dateKey];
    if (s && s.workout && sessionLogged(dateKey)) return s.workout;
    return scheduledFor(dateKey);
  }

  function currentSession(){ return loadGymLog()[gymState.date] || null; }

  function writeSession(mut){
    const log = loadGymLog();
    const k = gymState.date;
    if (!log[k]) log[k] = { workout: gymState.workout, exercises:{}, variants:{}, done:false };
    if (!log[k].variants) log[k].variants = {};
    // snapshot the routine the first time a session is touched, so later routine
    // edits only affect sessions that haven't been opened yet
    if (!log[k].plan || log[k].workout !== gymState.workout) {
      const routine = loadRoutine();
      log[k].plan = JSON.parse(JSON.stringify(routine[gymState.workout] || []));
    }
    log[k].workout = gymState.workout;
    mut(log[k]);
    saveGymLog(log);
  }

  // ── VARIANTS ──
  // storage key is the exercise plus its variant, so each keeps its own history

  // Equipment options per exercise, applied wherever that exercise appears —
  // including routines you saved before these existed. An exercise with its own
  // `variants` overrides this; an explicitly empty list means "no variants".
  const VARIANT_DEFAULTS = {
    // chest
    'bench-press':        ['Barbell','DB','Machine','Smith'],
    'incline-press':      ['Barbell','DB','Machine','Smith'],
    'decline-press':      ['Barbell','DB','Machine'],
    'chest-press':        ['Machine','Smith'],
    'floor-press':        ['Barbell','DB'],
    'dip':                ['Bodyweight','Weighted','Assisted'],
    'push-up':            ['Bodyweight','Weighted','Incline'],
    'cable-fly':          ['High','Mid','Low'],
    'cable-crossover':    ['High','Mid','Low'],
    'db-fly':             ['Flat','Incline'],
    // back
    'row':                ['Barbell','DB','Chest-Supported','Smith','Machine'],
    'seated-cable-row':   ['Wide','Neutral','Close'],
    'lat-pulldown':       ['Wide','Neutral','Close','Reverse'],
    'pull-up':            ['Bodyweight','Weighted','Assisted'],
    'chin-up':            ['Bodyweight','Weighted','Assisted'],
    't-bar-row':          ['Machine','Landmine'],
    'straight-arm-pulldown': ['Bar','Rope'],
    'shrug':              ['Barbell','DB','Machine','Smith'],
    // shoulders
    'overhead-press':     ['Barbell','DB','Machine','Smith'],
    'front-raise':        ['DB','Cable','Plate'],
    'rear-delt-fly':      ['DB','Cable','Machine'],
    'face-pull':          ['Rope','Band'],
    'upright-row':        ['Barbell','EZ Bar','DB','Cable'],
    // arms
    'overhead-tricep-extension': ['Cable','EZ Bar','Barbell','DB'],
    'tricep-pushdown':    ['Rope','Bar','V-Bar','Single-Arm'],
    'skull-crusher':      ['EZ Bar','Barbell','DB'],
    'tricep-kickback':    ['DB','Cable'],
    'preacher-curl':      ['EZ Bar','Barbell','DB','Machine','Cable'],
    'hammer-curl':        ['DB','Cable','Rope'],
    'cable-curl':         ['Bar','Rope','Single-Arm'],
    'concentration-curl': ['DB','Cable'],
    'spider-curl':        ['EZ Bar','DB'],
    'reverse-curl':       ['EZ Bar','Barbell','Cable'],
    'wrist-curl':         ['Barbell','DB','Cable'],
    // legs
    'back-squat':         ['Barbell','Smith','Hack'],
    'front-squat':        ['Barbell','Smith','Goblet'],
    'romanian-deadlift':  ['Barbell','DB'],
    'stiff-leg-deadlift': ['Barbell','DB'],
    'deadlift':           ['Barbell','Trap Bar','Smith'],
    'good-morning':       ['Barbell','Smith'],
    'split-squat':        ['DB','Barbell','Smith','Bodyweight'],
    'bulgarian-split-squat': ['DB','Barbell','Smith','Bodyweight'],
    'walking-lunge':      ['DB','Barbell','Bodyweight'],
    'reverse-lunge':      ['DB','Barbell','Bodyweight'],
    'step-up':            ['DB','Barbell','Bodyweight'],
    'leg-curl':           ['Lying','Seated','Standing'],
    'hip-thrust':         ['Barbell','Machine','Bodyweight'],
    'glute-bridge':       ['Barbell','Bodyweight'],
    'standing-calf-raise':['Machine','Smith','DB'],
    'seated-calf-raise':  ['Machine','Barbell'],
    'calf-press':         ['Leg Press','Machine'],
    // core & carries
    'cable-crunch':       ['Rope','Bar'],
    'crunch':             ['Bodyweight','Weighted','Machine'],
    'sit-up':             ['Bodyweight','Weighted','Decline'],
    'russian-twist':      ['Bodyweight','Weighted'],
    'hanging-knee-raise': ['Bodyweight','Weighted'],
    'hanging-leg-raise':  ['Bodyweight','Weighted'],
    'farmer-carry':       ['DB','Trap Bar','Kettlebell']
  };

  function variantsFor(ex){
    if (!ex) return null;
    if (Array.isArray(ex.variants)) return ex.variants.length ? ex.variants : null;
    return VARIANT_DEFAULTS[slug(ex.name)] || null;
  }

  function exKey(ex, variant){
    if (ex && ex.key) return ex.key;    // recovered entry — its key is fixed
    const base = slug(ex.name);
    const v = variant !== undefined ? variant : chosenVariant(ex);
    return v ? base + '--' + slug(v) : base;
  }

  // last variant used for this exercise, else the first option
  function chosenVariant(ex){
    if (ex.extra) return null;      // recovered from a logged key; leave it alone
    const list = variantsFor(ex);
    if (!list) return null;
    const sess = currentSession();
    const base = slug(ex.name);
    if (sess && sess.variants && sess.variants[base]) return sess.variants[base];
    const log = loadGymLog();
    const keys = Object.keys(log).filter(k => k <= gymState.date).sort().reverse();
    for (const k of keys) {
      const v = log[k].variants && log[k].variants[base];
      if (v && list.includes(v)) return v;
    }
    return list[0];
  }

  function pickVariant(base, variant){
    const ex = sessionPlan().find(e => slug(e.name) === base);
    const oldKey = ex ? exKey(ex) : null;

    writeSession(s => { s.variants[base] = variant; });

    if (ex) {
      const newKey = exKey(ex, variant);
      // keep the panel open across the switch
      if (oldKey && gymState.expanded[oldKey]) {
        delete gymState.expanded[oldKey];
        gymState.expanded[newKey] = true;
      }
      // and give the new variant its own rows, seeded from its own history
      const sess = currentSession();
      const existing = sess && sess.exercises[newKey];
      if (!existing || !existing.length) {
        const prev = lastEntry(newKey);
        const seed = prev
          ? prev.sets.filter(x => x.r).map(x => ({ w: x.w, r: '' }))
          : Array.from({ length: ex.sets || 3 }, () => ({ w: '', r: '' }));
        writeSession(s => { s.exercises[newKey] = seed; });
      }
    }
    renderGym();
  }

  function displayName(ex, variant){
    const v = variant !== undefined ? variant : chosenVariant(ex);
    const name = pretty(ex.name);
    if (!v) return name;
    const pv = pretty(v);
    // "Dumbbell Dumbbell Curl" helps nobody
    if (name.toLowerCase().includes(pv.toLowerCase())) return name;
    return pv + ' ' + name;
  }

  // ── MUSCLE GROUPS ──
  // Each exercise sits in one movement group. The group gives the grey target
  // line, and everything else in the group becomes a substitute — so swaps stay
  // correct without hand-writing pairs for every exercise.

  const MUSCLE_GROUPS = {
    chestPress:  { label: 'Chest, triceps, front delts', names: ['Bench Press','Incline Press','Decline Press','Chest Press','Floor Press','Push-Up','Dip','Landmine Press'] },
    chestFly:    { label: 'Chest',                       names: ['Cable Fly','Pec Deck','DB Fly','Incline DB Fly','Cable Crossover','Svend Press'] },
    backRow:     { label: 'Upper back, lats, biceps',    names: ['Row','Seated Cable Row','T-Bar Row','Pendlay Row','Meadows Row','Single-Arm DB Row','Inverted Row'] },
    backPull:    { label: 'Lats, biceps',                names: ['Lat Pulldown','Pull-Up','Chin-Up','Assisted Pull-Up','Straight-Arm Pulldown'] },
    shoulders:   { label: 'Shoulders, triceps',          names: ['Overhead Press','Seated DB Shoulder Press','Arnold Press'] },
    sideDelts:   { label: 'Side delts',                  names: ['DB Lateral Raise','Cable Lateral Raise','Upright Row'] },
    rearDelts:   { label: 'Rear delts, upper back',      names: ['Rear Delt Fly','Face Pull'] },
    frontDelts:  { label: 'Front delts',                 names: ['Front Raise'] },
    biceps:      { label: 'Biceps',                      names: ['DB Curl','Barbell Curl','EZ Bar Curl','Preacher Curl','Hammer Curl','Incline DB Curl','Concentration Curl','Cable Curl','Spider Curl','Reverse Curl'] },
    triceps:     { label: 'Triceps',                     names: ['Tricep Pushdown','Overhead Tricep Extension','Skull Crusher','Close-Grip Bench Press','Tricep Kickback','Bench Dip'] },
    quads:       { label: 'Quads, glutes',               names: ['Back Squat','Front Squat','Goblet Squat','Hack Squat','Leg Press','Split Squat','Bulgarian Split Squat','Walking Lunge','Reverse Lunge','Step-Up','Sissy Squat','Leg Extension'] },
    hamstrings:  { label: 'Hamstrings',                  names: ['Romanian Deadlift','Stiff-Leg Deadlift','Leg Curl','Seated Leg Curl','Good Morning','Nordic Curl'] },
    hinge:       { label: 'Posterior chain',             names: ['Deadlift','Sumo Deadlift','Trap Bar Deadlift','Rack Pull'] },
    glutes:      { label: 'Glutes',                      names: ['Hip Thrust','Glute Bridge'] },
    calves:      { label: 'Calves',                      names: ['Standing Calf Raise','Seated Calf Raise','Calf Press'] },
    core:        { label: 'Core',                        names: ['Plank','Weighted Plank','Side Plank','Hollow Hold','Dead Bug','Ab Wheel','Cable Crunch','Crunch','Sit-Up','Russian Twist','Hanging Knee Raise','Hanging Leg Raise','Toes to Bar','Mountain Climber','Pallof Press'] },
    lowerBack:   { label: 'Lower back',                  names: ['Back Extension'] },
    traps:       { label: 'Traps',                       names: ['Shrug'] },
    forearms:    { label: 'Forearms, grip',              names: ['Wrist Curl','Farmer Carry'] },
    hips:        { label: 'Hips',                        names: ['Adductor Machine','Abductor Machine'] },
    power:       { label: 'Power',                       names: ['Box Jump'] },
    cardio:      { label: 'Conditioning',                names: ['Treadmill','Stationary Bike','Rowing Machine','Elliptical','Stair Climber','Jump Rope','Battle Ropes','Sled Push','Assault Bike'] }
  };

  const GROUP_OF = (() => {
    const map = {};
    Object.entries(MUSCLE_GROUPS).forEach(([key, g]) => {
      g.names.forEach(n => { map[slug(n)] = key; });
    });
    return map;
  })();

  function exerciseMuscles(name){
    const g = GROUP_OF[slug(name)];
    return g ? MUSCLE_GROUPS[g].label : '';
  }

  // other exercises hitting the same thing, minus anything already in the session
  function exerciseSubs(name, limit){
    const g = GROUP_OF[slug(name)];
    if (!g) return [];
    const inSession = new Set(sessionPlan().map(e => slug(e.name)));
    return MUSCLE_GROUPS[g].names
      .filter(n => slug(n) !== slug(name) && !inSession.has(slug(n)))
      .slice(0, limit || 3);
  }

  // swap in place, this session only — the routine is untouched
  function swapExercise(base, newName){
    const routine = loadRoutine();
    let known = null;
    Object.values(routine).concat(Object.values(DEFAULT_ROUTINE)).forEach(l => {
      l.forEach(e => { if (!known && slug(e.name) === slug(newName)) known = e; });
    });
    writeSession(s => {
      if (!s.plan) s.plan = [];
      const i = s.plan.findIndex(e => slug(e.name) === base);
      const old = i >= 0 ? s.plan[i] : null;
      const timed = TIME_BASED.has(slug(newName));
      const entry = known
        ? JSON.parse(JSON.stringify(known))
        : { name: newName,
            sets: old ? old.sets : 3,
            reps: old ? old.reps : (timed ? '30-60s' : '8-12'),
            mode: timed ? 'time' : 'reps' };
      if (i >= 0) s.plan[i] = entry; else s.plan.push(entry);
      // drop any empty rows seeded against the old exercise
      Object.keys(s.exercises).forEach(k => {
        if ((k === base || k.indexOf(base + '--') === 0) && !s.exercises[k].some(x => x.r)) {
          delete s.exercises[k];
        }
      });
    });
    rememberExercise(newName);
    gymState.expanded = {};
    renderGym();
  }

  // ── MIXED VARIANTS ──
  // Normally an exercise uses one variant for the whole session. Turn on mixing
  // and each set carries its own, so 3 wide + 2 close pulldowns sit in one list
  // while still feeding two separate histories.

  function mixEnabled(ex){
    const vs = variantsFor(ex);
    if (!vs) return false;
    const sess = currentSession();
    if (sess && sess.mix && sess.mix[slug(ex.name)]) return true;
    // more than one variant already has sets? then it's mixed whether you said so or not
    const used = vs.filter(v => (sess && sess.exercises[exKey(ex, v)] || []).some(x => x.r));
    return used.length > 1;
  }

  function toggleMix(base){
    const ex = sessionPlan().find(e => slug(e.name) === base);
    if (!ex) return;
    const on = mixEnabled(ex);
    // stamp the current order onto every set, so retagging one can't reshuffle
    const merged = mergedSets(ex);
    writeSession(s => {
      if (!s.mix) s.mix = {};
      if (on) delete s.mix[base]; else s.mix[base] = true;
      merged.forEach((m, i) => {
        const arr = s.exercises[m.key];
        if (arr && arr[m.idx]) arr[m.idx].o = i;
      });
    });
    renderGym();
  }

  // every set across every variant, in the order they were entered
  function mergedSets(ex){
    const sess = currentSession();
    const vs = variantsFor(ex) || [];
    const out = [];
    vs.forEach((v, vi) => {
      const key = exKey(ex, v);
      (sess && sess.exercises[key] || []).forEach((s, i) => {
        out.push({ ...s, variant: v, key, idx: i, ord: s.o != null ? s.o : (vi * 100 + i) });
      });
    });
    return out.sort((a, b) => a.ord - b.ord);
  }

  function nextOrder(ex){
    const all = mergedSets(ex);
    return all.length ? Math.max(...all.map(s => s.ord)) + 1 : 0;
  }

  function setSetVariant(base, fromKey, idx, toVariant){
    const ex = sessionPlan().find(e => slug(e.name) === base);
    if (!ex) return;
    const toKey = exKey(ex, toVariant);
    if (toKey === fromKey) return;
    // remember where it sat so it stays put after the move
    const here = mergedSets(ex).find(m => m.key === fromKey && m.idx === idx);
    const ord = here ? here.ord : 0;
    writeSession(s => {
      const arr = s.exercises[fromKey];
      if (!arr || !arr[idx]) return;
      const [item] = arr.splice(idx, 1);
      item.o = ord;
      if (!s.exercises[toKey]) s.exercises[toKey] = [];
      s.exercises[toKey].push(item);
      if (!arr.length) delete s.exercises[fromKey];
    });
    renderGym();
  }

  function addMixedSet(base){
    const ex = sessionPlan().find(e => slug(e.name) === base);
    if (!ex) return;
    const v = chosenVariant(ex);
    const key = exKey(ex, v);
    const ord = nextOrder(ex);
    const all = mergedSets(ex);
    const last = all.length ? all[all.length - 1] : null;
    writeSession(s => {
      if (!s.exercises[key]) s.exercises[key] = [];
      s.exercises[key].push({ w: last ? last.w : '', r: '', o: ord });
    });
    renderGym();
  }

  // ── BARS, FAILURE, FORM ──

  const DEFAULT_BARS = { barbell: 20, ez: 7.5, trap: 25, smith: 15 };
  const BAR_LABELS = { barbell: 'Barbell', ez: 'EZ bar', trap: 'Trap bar', smith: 'Smith' };

  function loadBars(){
    try { return Object.assign({}, DEFAULT_BARS, JSON.parse(localStorage.getItem('theosBars') || '{}')); }
    catch { return Object.assign({}, DEFAULT_BARS); }
  }
  function setBarWeight(kind, value){
    const bars = loadBars();
    bars[kind] = parseFloat(value) || 0;
    localStorage.setItem('theosBars', JSON.stringify(bars));
  }

  // Which bar an exercise is on, worked out from the variant you picked. A
  // dumbbell press has no bar; a Smith squat isn't a 20kg barbell.
  const VARIANT_BAR = { 'Barbell':'barbell', 'EZ Bar':'ez', 'Trap Bar':'trap', 'Smith':'smith' };

  // barbell lifts that carry no variants of their own
  const IMPLIED_BAR = {
    'good-morning':'barbell', 'rack-pull':'barbell', 'pendlay-row':'barbell',
    'sumo-deadlift':'barbell', 'landmine-press':'barbell', 'svend-press':'barbell'
  };

  function inferredBar(ex, variant){
    if (variant) return VARIANT_BAR[variant] || '';
    if (variantsFor(ex)) return '';
    return IMPLIED_BAR[slug(ex.name)] || '';
  }

  function sessionBar(base){
    const sess = currentSession();
    return (sess && sess.bars && sess.bars[base]) || '';
  }

  // an explicit 'none' overrides the guess
  function effectiveBar(ex, variant){
    const chosen = sessionBar(slug(ex.name));
    if (chosen === 'none') return '';
    return chosen || inferredBar(ex, variant);
  }

  function pickBar(base, kind){
    writeSession(s => {
      if (!s.bars) s.bars = {};
      s.bars[base] = kind;
    });
    gymState.barOpen[base] = false;
    renderGym();
  }

  function toggleMore(key){
    gymState.moreOpen[key] = !gymState.moreOpen[key];
    renderGym();
  }

  function toggleBarPicker(base){
    gymState.barOpen[base] = !gymState.barOpen[base];
    renderGym();
  }

  // adds the bar's weight to whatever is already in the box
  function addBar(key, idx, base, kind){
    if (!kind) return;
    const add = loadBars()[kind] || 0;
    writeSession(s => {
      if (!s.exercises[key] || !s.exercises[key][idx]) return;
      const cur = Number(s.exercises[key][idx].w) || 0;
      s.exercises[key][idx].w = Math.round((cur + add) * 100) / 100;
    });
    renderGym();
  }

  function toggleFailure(key, idx){
    writeSession(s => {
      const set = s.exercises[key] && s.exercises[key][idx];
      if (!set) return;
      set.f = !set.f;
    });
    renderGym();
  }

  const FORM_CYCLE = ['', 'good', 'ok', 'poor'];
  function cycleForm(key, idx){
    writeSession(s => {
      const set = s.exercises[key] && s.exercises[key][idx];
      if (!set) return;
      const i = FORM_CYCLE.indexOf(set.form || '');
      set.form = FORM_CYCLE[(i + 1) % FORM_CYCLE.length];
      if (!set.form) delete set.form;
    });
    renderGym();
  }

  // ── SESSION CONTENTS ──

  function sessionPlan(){
    const sess = currentSession();
    const routine = loadRoutine();

    const loggedKeys = (sess && sess.exercises)
      ? Object.keys(sess.exercises).filter(k => sess.exercises[k].some(x => x.r))
      : [];

    // What this session should show, in order of preference:
    //  1. its own saved plan, if it matches the workout on screen
    //  2. nothing — because it predates plans but has logged sets, and those
    //     sets ARE the record of what was done. Never overwrite history with
    //     the current routine.
    //  3. the live routine, for a session that hasn't been started
    let base;
    if (sess && sess.plan && sess.workout === gymState.workout) base = sess.plan;
    else if (loggedKeys.length) base = [];
    else base = routine[gymState.workout] || [];

    const list = base.slice();

    // Anything logged that the list doesn't already cover gets appended, so a
    // renamed or removed exercise can never hide data that exists.
    const have = new Set();
    list.forEach(e => {
      const vs = variantsFor(e);
      if (vs) vs.forEach(v => have.add(exKey(e, v)));
      have.add(exKey(e, null));
      have.add(slug(e.name));
    });
    loggedKeys.forEach(k => {
      if (have.has(k)) return;
      list.push({
        name: unslug(k),
        key: k,                // keep the original key so its sets still resolve
        sets: sess.exercises[k].length,
        reps: '—',
        variants: [],
        extra: true
      });
      have.add(k);
    });

    return list;
  }

  function unslug(k){
    const known = allExerciseNames().find(n => slug(n) === k);
    if (known) return known;
    // "bench-press--barbell" reads as "Barbell Bench Press"
    const [base, variant] = String(k).split('--');
    const title = s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const baseName = allExerciseNames().find(n => slug(n) === base) || title(base);
    return variant ? title(variant) + ' ' + baseName : baseName;
  }

  function allExerciseNames(){
    const names = new Set();
    EXERCISE_LIBRARY.forEach(n => names.add(n));
    loadCustomExercises().forEach(n => names.add(n));
    Object.values(DEFAULT_ROUTINE).forEach(l => l.forEach(e => names.add(e.name)));
    Object.values(loadRoutine()).forEach(l => l.forEach(e => names.add(e.name)));
    Object.values(loadGymLog()).forEach(s => (s.plan || []).forEach(e => names.add(e.name)));
    // one entry per name, case-insensitive
    const seen = new Map();
    [...names].forEach(n => { if (!seen.has(slug(n))) seen.set(slug(n), n); });
    return [...seen.values()].sort((a,b) => a.localeCompare(b));
  }

  function setsSummary(sets, mode){
    const mark = s => s.f ? 'f' : '';
    if (mode === 'time') {
      return sets.filter(s => s.r).map(s => (s.w ? s.w + 'kg ' + fmtDur(s.r) : fmtDur(s.r)) + mark(s)).join(', ');
    }
    return sets.filter(s => s.r).map(s => (s.w ? s.w + '×' + s.r : String(s.r)) + mark(s)).join(', ');
  }

  function sessionLogged(dateKey){
    const s = loadGymLog()[dateKey];
    if (!s || !s.exercises) return false;
    return Object.values(s.exercises).some(sets => sets.some(x => x.r));
  }

  function lastEntry(key){
    const log = loadGymLog();
    const keys = Object.keys(log).filter(k => k < gymState.date).sort().reverse();
    for (const k of keys) {
      const sets = log[k].exercises && log[k].exercises[key];
      if (sets && sets.length && sets.some(s => s.r)) return { date:k, sets };
    }
    return null;
  }

  // ── NAVIGATION ──

  function gymWeekShift(delta){
    const d = new Date(gymState.weekStart + 'T00:00:00');
    d.setDate(d.getDate() + delta*7);
    gymState.weekStart = ymd(d);
    renderGym();
  }

  function gymPickDay(dateKey){
    gymState.date = dateKey;
    gymState.workout = defaultWorkoutFor(dateKey);
    gymState.expanded = {};
    gymState.suggest = [];
    renderGym();
  }

  function gymToday(){ gymPickDay(getTodayKey()); gymState.weekStart = ymd(weekStartOf(new Date())); renderGym(); }

  // Clears the day back to rest. Never deletes a session that has real sets in
  // it — that just gets hidden, and reappears if you pick the workout again.
  function setRestDay(){
    if (!sessionLogged(gymState.date)) {
      const log = loadGymLog();
      if (log[gymState.date]) { delete log[gymState.date]; saveGymLog(log); }
    }
    gymState.workout = null;
    gymState.expanded = {};
    gymState.suggest = [];
    renderGym();
  }

  function pickWorkout(w){
    // an untouched session shouldn't pin the day to a workout you tapped by mistake
    if (!sessionLogged(gymState.date)) {
      const log = loadGymLog();
      if (log[gymState.date]) { delete log[gymState.date]; saveGymLog(log); }
    }
    gymState.workout = (gymState.workout === w) ? null : w;
    gymState.expanded = {};
    gymState.suggest = [];
    renderGym();
  }

  // ── RENDER ──

  function renderGym(){
    gymInit();
    const root = document.getElementById('gymBody');
    if (gymState.view === 'exercise') return renderGymExercise(root);
    if (gymState.view === 'weight')   return renderWeightHistory(root);
    if (gymState.view === 'edit')     return renderGymEdit(root);
    renderGymSession(root);
  }

  function gymWeekStripHTML(){
    const start = new Date(gymState.weekStart + 'T00:00:00');
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const fmt = { month:'short', day:'numeric' };
    const names = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const today = getTodayKey();

    let h = `<div class="gym-weekbar">
               <button class="cal-nav" onclick="gymWeekShift(-1)" aria-label="Previous week">&lsaquo;</button>
               <div class="week-strip">`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = ymd(d);
      let cls = 'week-cell gym-day';
      if (key === gymState.date) cls += ' selected';
      if (key === today) cls += ' today';
      if (key > today) cls += ' future';
      h += `<div class="${cls}" onclick="gymPickDay('${key}')">
              <div class="wc-name">${names[i]}</div>
              <div class="wc-num">${d.getDate()}</div>
              ${sessionLogged(key) ? '<span class="gym-dot"></span>' : ''}
            </div>`;
    }
    return h + `</div>
      <button class="cal-nav" onclick="gymWeekShift(1)" aria-label="Next week">&rsaquo;</button>
    </div>`;
  }

  function renderGymSession(root){
    const sess = currentSession();
    const isToday = gymState.date === getTodayKey();
    const dObj = new Date(gymState.date + 'T00:00:00');

    let h = gymWeekStripHTML();

    const wAll = loadWeights()[gymState.date] || {};
    const wSlot = gymState.weightSlot || defaultSlot();
    const wShown = wAll[wSlot] != null ? fmtNum(wAll[wSlot]) + 'kg'
                 : (Object.keys(wAll).length ? fmtNum(wAll[Object.keys(wAll)[0]]) + 'kg' : 'weight');

    h += `<div class="gym-daybar">
            <span class="gym-daybar-date">${dObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
            <div class="daybar-right">
              <button class="weight-chip${Object.keys(wAll).length ? ' has' : ''}" onclick="toggleBody()">${wShown}</button>
              ${isToday ? '' : '<button class="gym-today-btn" onclick="gymToday()">Today</button>'}
            </div>
          </div>`;

    if (gymState.bodyOpen) h += weightBoxHTML();

    h += '<div class="gym-chips">';
    const sched = scheduledFor(gymState.date);
    WORKOUT_ORDER.forEach(w => {
      const cls = 'gym-chip' + (w === gymState.workout ? ' active' : '') + (w === sched ? ' scheduled' : '');
      h += `<button class="${cls}" onclick="pickWorkout('${w}')">${w}</button>`;
    });
    h += `<button class="gym-chip gym-rest-chip${gymState.workout ? '' : ' active'}${sched ? '' : ' scheduled'}" onclick="setRestDay()">Rest</button>`;
    h += '</div>';

    if (!gymState.workout) {
      const kept = sessionLogged(gymState.date);
      h += `<div class="gym-rest">
              <div class="gym-rest-title">${sched ? 'No session' : 'Rest day'}</div>
              <p>${kept
                ? 'This day still has a logged session saved. Pick that workout again to see it.'
                : 'Pick a workout above to log one for this day.'}</p>
            </div>`;
      root.innerHTML = h;
      return;
    }

    const list = sessionPlan();
    const doneCount = list.filter(e => {
      const s = sess && sess.exercises[exKey(e)];
      return s && s.some(x => x.r);
    }).length;
    const pct = list.length ? Math.round((doneCount/list.length)*100) : 0;
    const color = getProgressColor(pct);

    h += `<div class="top-progress" style="margin-top:14px">
            <div class="tp-head">
              <span class="tp-label">${gymState.workout} Session</span>
              <span class="tp-pct" style="color:${color}">${doneCount}/${list.length}</span>
            </div>
            <div class="tp-track"><div class="tp-fill" style="width:${pct}%;background:${color}"></div></div>
          </div>`;

    list.forEach(ex => {
      const base = slug(ex.name);
      const mixed = mixEnabled(ex);
      const variant = chosenVariant(ex);
      const key = exKey(ex, variant);
      const sets = mixed ? mergedSets(ex) : ((sess && sess.exercises[key]) || []);
      const open = !!gymState.expanded[key];
      const logged = sets.some(s => s.r);
      const prev = lastEntry(key);
      const label = mixed ? pretty(ex.name) : displayName(ex, variant);
      const mode = exMode(ex);
      const muscles = exerciseMuscles(ex.name);

      h += `<div class="gym-ex${logged ? ' logged' : ''}">
              <div class="gym-ex-head" onclick="toggleExercise('${key}')">
                <div class="gym-ex-main">
                  <div class="gym-ex-name">${escHtml(label)}</div>
                  <div class="gym-ex-sub">${ex.sets} × ${ex.reps}${
                    muscles ? ' · ' + escHtml(muscles) : ''
                  }</div>
                  ${logged ? '<div class="gym-ex-last gym-now">' + setsSummary(sets, mode) + '</div>'
                           : (prev ? '<div class="gym-ex-last">last: ' + setsSummary(prev.sets, mode) + '</div>' : '')}
                </div>
                <span class="gym-ex-chev${open ? ' open' : ''}">&rsaquo;</span>
              </div>`;

      if (open) {
        h += '<div class="gym-sets">';

        const variantList = variantsFor(ex);
        if (variantList) {
          h += mixed ? '<div class="gym-variants"><span class="gym-swap-label">New sets</span>' : '<div class="gym-variants">';
          variantList.forEach(v => {
            h += `<button class="gym-variant${v === variant ? ' active' : ''}"
                          onclick="pickVariant('${base}','${v.replace(/'/g,"\\'")}')">${escHtml(pretty(v))}</button>`;
          });
          h += '</div>';
        }

        const bars = loadBars();
        const barKind = effectiveBar(ex, variant);
        const barOpen = !!gymState.barOpen[base];

        // one quiet line when a bar applies, nothing at all when it doesn't
        if (barKind && !barOpen) {
          h += `<button class="bar-line" onclick="toggleBarPicker('${base}')">
                  ${BAR_LABELS[barKind]} ${bars[barKind]}kg <span class="bar-line-change">change</span>
                </button>`;
        } else if (barOpen) {
          h += `<div class="bar-row">
                  <span class="gym-swap-label">Bar</span>
                  ${Object.keys(BAR_LABELS).map(k =>
                    `<button class="bar-chip${barKind === k ? ' active' : ''}" onclick="pickBar('${base}','${k}')">${BAR_LABELS[k]} ${bars[k]}</button>`
                  ).join('')}
                  <button class="bar-chip${barKind ? '' : ' active'}" onclick="pickBar('${base}','none')">None</button>
                </div>`;
        }

        sets.forEach((s, i) => {
          const sKey = mixed ? s.key : key;
          const sIdx = mixed ? s.idx : i;
          h += `<div class="gym-set-row">
                  <span class="gym-set-n">${i+1}</span>
                  <input type="number" inputmode="decimal" placeholder="kg" value="${s.w ?? ''}"
                         onchange="setVal('${sKey}',${sIdx},'w',this.value)"/>
                  ${barKind ? `<button class="bar-add" onclick="addBar('${sKey}',${sIdx},'${base}','${barKind}')" title="Add bar weight">+${bars[barKind]}</button>` : ''}
                  <span class="gym-x">${mode === 'time' ? 'for' : '×'}</span>
                  <input type="number" inputmode="numeric" placeholder="${mode === 'time' ? 'sec' : 'reps'}"
                         value="${s.r ?? ''}" onchange="setVal('${sKey}',${sIdx},'r',this.value)"/>
                  ${mode === 'time' ? `<span class="gym-dur">${s.r ? fmtDur(s.r) : ''}</span>` : ''}
                  ${mixed ? `<select class="gym-set-var" onchange="setSetVariant('${base}','${s.key}',${s.idx},this.value)">
                      ${variantsFor(ex).map(v => `<option value="${v}"${v === s.variant ? ' selected' : ''}>${escHtml(pretty(v))}</option>`).join('')}
                    </select>` : ''}
                  <button class="mini flag${s.f ? ' on' : ''}" onclick="toggleFailure('${sKey}',${sIdx})"
                          title="To failure">f</button>
                  <button class="mini dot form-${s.form || 'none'}" onclick="cycleForm('${sKey}',${sIdx})"
                          title="Form"></button>
                  <button class="gym-set-del" onclick="removeSet('${sKey}',${sIdx})">✕</button>
                </div>`;
        });
        const moreOpen = !!gymState.moreOpen[key];
        h += `<div class="gym-set-actions">
                <button class="sync-btn" onclick="${mixed ? `addMixedSet('${base}')` : `addSet('${key}')`}">+ Set</button>
                <button class="sync-btn${moreOpen ? ' on' : ''}" onclick="toggleMore('${key}')">${moreOpen ? 'Less' : 'More'}</button>
              </div>`;

        // History, Bar, Remove, Swap and Mix are all rare — out of the way
        if (moreOpen) {
          h += `<div class="gym-more">
                  <div class="gym-more-row">
                    <button class="sync-btn" onclick="openExercise('${key}','${escHtml(label).replace(/'/g,"\\'")}')">History</button>
                    ${(!barKind && !barOpen) ? `<button class="sync-btn" onclick="toggleBarPicker('${base}')">Bar</button>` : ''}
                    <button class="sync-btn gym-drop" onclick="removeSessionExercise('${ex.key || base}')">Remove</button>
                  </div>`;

          const subs = exerciseSubs(ex.name, 3);
          if (subs.length) {
            h += '<div class="gym-swap"><span class="gym-swap-label">Swap for</span>' +
                 subs.map(n => `<button class="gym-swap-chip" onclick="swapExercise('${base}','${escHtml(n).replace(/'/g,"\\'")}')">${escHtml(pretty(n))}</button>`).join('') +
                 '</div>';
          }
          if (variantsFor(ex)) {
            h += `<button class="gym-mix-toggle" onclick="toggleMix('${base}')">${
              mixed ? 'Use one variant for all sets' : 'Mix variants across sets'}</button>`;
          }
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    });

    const finished = sess && sess.done;
    h += `<button class="gym-finish${finished ? ' done' : ''}" onclick="finishSession()">
            ${finished ? '✓ Session logged' : (isToday ? 'Finish session' : 'Save session')}
          </button>`;

    // everything you don't need mid-set
    h += `<button class="sync-btn gym-edit-btn" onclick="toggleGymOptions()">${
            gymState.optionsOpen ? 'Close options' : 'Session options'}</button>`;

    if (gymState.optionsOpen) {
      h += `<div class="gym-options">
        <div class="sync-label">Add an exercise</div>
        <div class="gym-addex">
          <input type="text" id="gymAddEx" placeholder="Search exercises…"
                 autocapitalize="words" spellcheck="false" autocomplete="off"
                 oninput="gymSuggest(this.value)" onclick="gymToggleSuggest(event)"/>
          <button class="btn btn-add" onclick="addSessionExercise()">Add</button>
        </div>
        <div class="gym-suggest" id="gymSuggestBox"></div>
        <p class="gym-note">Adding or removing here changes this session only.</p>
        <button class="sync-btn" style="width:100%;margin-top:6px" onclick="gymGo('edit')">Edit routine</button>
      </div>`;
    }

    root.innerHTML = h;
    renderSuggestBox();
  }

  // ── SUGGESTION DROPDOWN ──

  function gymSuggest(value){
    const q = (value || '').trim().toLowerCase();
    const inPlan = new Set(sessionPlan().map(e => slug(e.name)));
    let names = allExerciseNames().filter(n => !inPlan.has(slug(n)));
    if (q) names = names.filter(n => n.toLowerCase().includes(q));
    gymState.suggest = names.slice(0, 8);
    renderSuggestBox();
  }

  function renderSuggestBox(){
    const box = document.getElementById('gymSuggestBox');
    if (!box) return;
    if (!gymState.suggest.length) { box.innerHTML = ''; return; }
    box.innerHTML = gymState.suggest.map(n =>
      `<div class="gym-suggest-item" onclick="chooseSuggestion('${escHtml(n).replace(/'/g,"\\'")}')">${escHtml(pretty(n))}</div>`
    ).join('');
  }

  function toggleGymOptions(){
    gymState.optionsOpen = !gymState.optionsOpen;
    gymState.suggest = [];
    renderGym();
  }

  function gymToggleSuggest(e){
    if (e) e.stopPropagation();
    if (gymState.suggest.length) {
      gymState.suggest = [];
      renderSuggestBox();
    } else {
      const inp = document.getElementById('gymAddEx');
      gymSuggest(inp ? inp.value : '');
    }
  }

  function closeSuggest(){
    if (!gymState.suggest.length) return;
    gymState.suggest = [];
    renderSuggestBox();
    const inp = document.getElementById('gymAddEx');
    if (inp) inp.blur();
  }

  // tap anywhere else and the dropdown goes away
  document.addEventListener('click', e => {
    if (!gymState.suggest.length) return;
    const inp = document.getElementById('gymAddEx');
    const box = document.getElementById('gymSuggestBox');
    if (inp && (e.target === inp || inp.contains(e.target))) return;
    if (box && box.contains(e.target)) return;
    closeSuggest();
  });

  function chooseSuggestion(name){
    const inp = document.getElementById('gymAddEx');
    if (inp) inp.value = name;
    gymState.suggest = [];
    addSessionExercise();
  }

  // ── PER-SESSION EDITS ──

  function addSessionExercise(){
    const inp = document.getElementById('gymAddEx');
    const name = (inp && inp.value.trim()) || '';
    if (!name) return;
    const routine = loadRoutine();
    // reuse the routine's definition (incl. variants) if we already know this lift
    let known = null;
    Object.values(routine).concat(Object.values(DEFAULT_ROUTINE)).forEach(l => {
      l.forEach(e => { if (!known && slug(e.name) === slug(name)) known = e; });
    });
    writeSession(s => {
      if (!s.plan) s.plan = [];
      if (s.plan.some(e => slug(e.name) === slug(name))) return;
      if (known) {
        s.plan.push(JSON.parse(JSON.stringify(known)));
      } else {
        const timed = TIME_BASED.has(slug(name));
        s.plan.push({ name, sets:3, reps: timed ? '30-60s' : '8-12', mode: timed ? 'time' : 'reps' });
      }
    });
    rememberExercise(known ? known.name : name);
    if (inp) inp.value = '';
    gymState.suggest = [];
    renderGym();
  }

  function removeSessionExercise(base){
    writeSession(s => {
      if (s.plan) s.plan = s.plan.filter(e => slug(e.name) !== base);
      Object.keys(s.exercises).forEach(k => {
        if (k === base || k.indexOf(base + '--') === 0) delete s.exercises[k];
      });
    });
    gymState.expanded = {};
    renderGym();
  }

  // ── LOGGING ──

  function toggleExercise(key){
    const open = !gymState.expanded[key];
    gymState.expanded[key] = open;
    if (open) {
      const sess = currentSession();
      const existing = sess && sess.exercises[key];
      if (!existing || !existing.length) {
        const prev = lastEntry(key);
        const ex = sessionPlan().find(e => exKey(e) === key || slug(e.name) === key);
        const seed = prev
          ? prev.sets.filter(s => s.r).map(s => ({ w:s.w, r:'' }))
          : Array.from({length: ex ? ex.sets : 3}, () => ({ w:'', r:'' }));
        writeSession(s => { s.exercises[key] = seed; });
      }
    }
    renderGym();
  }

  function setVal(key, i, field, value){
    writeSession(s => {
      if (!s.exercises[key]) s.exercises[key] = [];
      if (!s.exercises[key][i]) s.exercises[key][i] = { w:'', r:'' };
      s.exercises[key][i][field] = value === '' ? '' : Number(value);
    });
    updateGymCounter();
  }

  function addSet(key){
    writeSession(s => {
      if (!s.exercises[key]) s.exercises[key] = [];
      const last = s.exercises[key][s.exercises[key].length-1];
      s.exercises[key].push({ w: last ? last.w : '', r:'' });
    });
    renderGym();
  }

  function removeSet(key, i){
    writeSession(s => { if (s.exercises[key]) s.exercises[key].splice(i,1); });
    renderGym();
  }

  function updateGymCounter(){
    const sess = currentSession();
    const list = sessionPlan();
    const done = list.filter(e => {
      const s = sess && sess.exercises[exKey(e)];
      return s && s.some(x => x.r);
    }).length;
    const pct = list.length ? Math.round((done/list.length)*100) : 0;
    const color = getProgressColor(pct);
    const el = document.querySelector('#gymBody .tp-pct');
    const fill = document.querySelector('#gymBody .tp-fill');
    if (el) { el.textContent = `${done}/${list.length}`; el.style.color = color; }
    if (fill) { fill.style.width = pct + '%'; fill.style.background = color; }
  }

  function finishSession(){
    writeSession(s => {
      Object.keys(s.exercises).forEach(k => {
        s.exercises[k] = s.exercises[k].filter(x => x.r !== '' && x.r != null);
        if (!s.exercises[k].length) delete s.exercises[k];
      });
      s.done = true;
    });
    const key = gymState.date;
    const day = getDay(key);
    let task = day.tasks.find(t => t.text.toLowerCase() === 'gym');
    if (task) {
      task.done = true;
      task.detail = gymState.workout || task.detail;
    } else {
      day.tasks.push({ text:'Gym', detail: gymState.workout || '', done:true });
    }
    saveDay(key, day);
    renderToday();
    renderGym();
  }

  // ── CHART ──
  // One chart used by both the exercise history and the bodyweight view.
  // Axes are labelled, points are tappable.

  function niceBounds(values){
    const nums = values.filter(v => v != null && !isNaN(v));
    if (!nums.length) return { min: 0, max: 1 };
    let min = Math.min(...nums), max = Math.max(...nums);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.12;
    // counts can't be negative — a padded axis dipping below zero reads as wrong
    const lo = (Math.min(...nums) >= 0) ? Math.max(0, min - pad) : min - pad;
    return { min: lo, max: max + pad };
  }

  function shortDate(key){
    const d = new Date(key + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtNum(n){
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  // series: [{ name, color, values: [] }]  — values align with labels
  function lineChart(opts){
    const { series, labels, yLabel, y2Label, selected, onSelect, monthLabels } = opts;
    const hasRight = series.some(s => s.axis === 'right');
    const W = 320, H = 190, L = 40, R = hasRight ? 42 : 12, T = 14, B = 34;
    const plotW = W - L - R, plotH = H - T - B;

    const all = series.flatMap(s => s.values);
    if (!all.some(v => v != null)) return '<div class="gym-nochart">No data yet</div>';

    // each axis gets its own scale, so books and pages can share a chart
    const leftVals = series.filter(s => s.axis !== 'right').flatMap(s => s.values);
    const rightVals = series.filter(s => s.axis === 'right').flatMap(s => s.values);
    const L1 = niceBounds(leftVals.length ? leftVals : all);
    const R1 = rightVals.length ? niceBounds(rightVals) : L1;
    const min = L1.min, max = L1.max;
    const span = max - min || 1;
    const rSpan = (R1.max - R1.min) || 1;
    const n = labels.length;
    const x = i => n > 1 ? L + (i / (n - 1)) * plotW : L + plotW / 2;
    const y = v => T + plotH - ((v - min) / span) * plotH;
    const yR = v => T + plotH - ((v - R1.min) / rSpan) * plotH;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img">`;

    // horizontal gridlines with y labels
    [0, 0.5, 1].forEach(f => {
      const val = min + span * f;
      const yy = y(val);
      svg += `<line x1="${L}" y1="${yy.toFixed(1)}" x2="${W - R}" y2="${yy.toFixed(1)}" class="chart-grid"/>`;
      svg += `<text x="${L - 6}" y="${(yy + 3.5).toFixed(1)}" class="chart-ytick">${fmtNum(val)}</text>`;
      if (hasRight) {
        svg += `<text x="${W - R + 6}" y="${(yy + 3.5).toFixed(1)}" class="chart-ytick" style="text-anchor:start">${fmtNum(R1.min + rSpan * f)}</text>`;
      }
    });

    // axis lines
    svg += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + plotH}" class="chart-axis"/>`;
    svg += `<line x1="${L}" y1="${T + plotH}" x2="${W - R}" y2="${T + plotH}" class="chart-axis"/>`;

    // x labels — first, last, and a couple between
    const tickIdx = n <= 4
      ? labels.map((_, i) => i)
      : [0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1];
    const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    [...new Set(tickIdx)].forEach(i => {
      const lab = monthLabels ? MONS[Number(labels[i].slice(5,7)) - 1] : shortDate(labels[i]);
      svg += `<text x="${x(i).toFixed(1)}" y="${H - 14}" class="chart-xtick">${lab}</text>`;
    });

    // one path per series, skipping gaps
    series.forEach(s => {
      const yy = s.axis === 'right' ? yR : y;
      let d = '', open = false;
      s.values.forEach((v, i) => {
        if (v == null) { open = false; return; }
        d += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yy(v).toFixed(1) + ' ';
        open = true;
      });
      if (d) svg += `<path d="${d.trim()}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"${s.axis === 'right' ? ' stroke-dasharray="4 3"' : ''}/>`;
      s.values.forEach((v, i) => {
        if (v == null) return;
        const sel = selected === i;
        svg += `<circle cx="${x(i).toFixed(1)}" cy="${yy(v).toFixed(1)}" r="${sel ? 5.5 : 3.5}" fill="${s.color}"${sel ? ' stroke="#fafaf8" stroke-width="2"' : ''}/>`;
      });
    });

    // invisible wide tap targets, one per x position
    if (onSelect) {
      labels.forEach((_, i) => {
        svg += `<rect x="${(x(i) - plotW / (2 * Math.max(1, n - 1)) - 4).toFixed(1)}" y="${T}" width="${(plotW / Math.max(1, n - 1) + 8).toFixed(1)}" height="${plotH}" fill="transparent" onclick="${onSelect}(${i})"/>`;
      });
    }

    svg += '</svg>';
    if (yLabel) svg = `<div class="chart-ylabel">${yLabel}${y2Label ? ' / ' + y2Label : ''}</div>` + svg;
    return svg;
  }

  // ── BODYWEIGHT ──

  const WEIGH_SLOTS = ['morning','afternoon','evening'];

  function loadWeights(){
    try { return JSON.parse(localStorage.getItem('theosWeight') || '{}'); }
    catch { return {}; }
  }
  function saveWeights(w){ localStorage.setItem('theosWeight', JSON.stringify(w)); queueSync(); }

  function defaultSlot(){
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  function setWeight(value){
    const w = loadWeights();
    const date = gymState.date;
    const slot = gymState.weightSlot || defaultSlot();
    if (!w[date]) w[date] = {};
    if (value === '' || value == null) delete w[date][slot];
    else w[date][slot] = Number(value);
    if (!Object.keys(w[date]).length) delete w[date];
    saveWeights(w);
    renderGym();
  }

  function toggleBody(){
    gymState.bodyOpen = !gymState.bodyOpen;
    renderGym();
  }

  function pickWeightSlot(slot){
    gymState.weightSlot = slot;
    renderGym();
  }

  function weightBoxHTML(){
    const w = loadWeights();
    const day = w[gymState.date] || {};
    const slot = gymState.weightSlot || defaultSlot();
    const current = day[slot];
    const logged = WEIGH_SLOTS.filter(s => day[s] != null)
      .map(s => s[0].toUpperCase() + s.slice(1) + ' ' + fmtNum(day[s]) + 'kg').join(' · ');

    return `<div class="weight-box">
      <div class="weight-head">
        <span class="weight-title">Bodyweight</span>
        <button class="sync-btn" onclick="gymGo('weight')">History</button>
      </div>
      <div class="weight-row">
        <input type="number" inputmode="decimal" step="0.1" placeholder="kg"
               value="${current != null ? current : ''}" onchange="setWeight(this.value)"/>
        <select onchange="pickWeightSlot(this.value)">
          ${WEIGH_SLOTS.map(s => `<option value="${s}"${s === slot ? ' selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
      </div>
      ${logged ? `<div class="weight-logged">${logged}</div>` : ''}
    </div>`;
  }

  function renderWeightHistory(root){
    const w = loadWeights();
    const dates = Object.keys(w).sort();
    const filter = gymState.weightFilter || 'all';
    const sel = gymState.weightSel;

    const COLORS = { morning: '#1a4d2e', afternoon: '#e0a800', evening: '#52b788' };
    const shown = filter === 'all' ? WEIGH_SLOTS : [filter];
    const series = shown.map(s => ({
      name: s,
      color: COLORS[s],
      values: dates.map(d => (w[d] && w[d][s] != null) ? w[d][s] : null)
    })).filter(s => s.values.some(v => v != null));

    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Bodyweight</div>`;

    h += '<div class="chart-filters">';
    [['all','All'], ...WEIGH_SLOTS.map(s => [s, s[0].toUpperCase() + s.slice(1)])].forEach(([v,l]) => {
      h += `<button class="chart-filter${filter === v ? ' active' : ''}" onclick="setWeightFilter('${v}')">${l}</button>`;
    });
    h += '</div>';

    if (!dates.length) {
      h += '<div class="gym-nochart">Nothing logged yet</div>';
      root.innerHTML = h;
      return;
    }

    h += `<div class="chart-block">${lineChart({
      series, labels: dates, yLabel: 'kg', selected: sel, onSelect: 'selectWeightPoint'
    })}</div>`;

    if (filter === 'all' && series.length > 1) {
      h += '<div class="chart-legend">' + series.map(s =>
        `<span class="legend-item"><i style="background:${s.color}"></i>${s.name}</span>`).join('') + '</div>';
    }

    if (sel != null && dates[sel]) {
      const d = dates[sel];
      const parts = WEIGH_SLOTS.filter(s => w[d][s] != null).map(s => `${s} ${fmtNum(w[d][s])}kg`).join(' · ');
      h += `<div class="chart-callout"><strong>${shortDate(d)}</strong> — ${parts}</div>`;
    }

    h += '<div class="section-label" style="margin-top:22px">Log</div>';
    [...dates].reverse().forEach(d => {
      const parts = WEIGH_SLOTS.filter(s => w[d][s] != null)
        .map(s => `<span class="wl-slot">${s.slice(0,3)}</span> ${fmtNum(w[d][s])}kg`).join('  ');
      const i = dates.indexOf(d);
      h += `<div class="gym-hist-row${sel === i ? ' selected' : ''}" onclick="selectWeightPoint(${i})">
              <div class="gym-hist-date">${new Date(d + 'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
              <div class="gym-hist-sets">${parts}</div>
            </div>`;
    });

    root.innerHTML = h;
  }

  function setWeightFilter(f){ gymState.weightFilter = f; gymState.weightSel = null; renderGym(); }
  function selectWeightPoint(i){ gymState.weightSel = (gymState.weightSel === i ? null : i); renderGym(); }

  // ── EXERCISE HISTORY ──

  function openExercise(key, name){
    gymState.exercise = { key, name };
    gymState.histSel = null;
    gymState.view = 'exercise';
    renderGym();
  }
  function gymGo(view){ gymState.view = view; renderGym(); }

  function exerciseHistory(key){
    const log = loadGymLog();
    return Object.keys(log).sort().map(date => {
      const sets = log[date].exercises && log[date].exercises[key];
      if (!sets) return null;
      const valid = sets.filter(s => s.r);
      if (!valid.length) return null;
      const volume = valid.reduce((a,s) => a + (Number(s.w)||0) * (Number(s.r)||0), 0);
      const top = Math.max(...valid.map(s => Number(s.w)||0));
      const totalTime = valid.reduce((a,s) => a + (Number(s.r)||0), 0);
      const longest = Math.max(...valid.map(s => Number(s.r)||0));
      return { date, sets: valid, volume, top, totalTime, longest };
    }).filter(Boolean);
  }

  function sparkline(points, color){
    if (points.length === 0) return '<div class="gym-nochart">No data yet</div>';
    const W = 300, H = 90, P = 12;
    const vals = points.map(p => p.v);
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = (max - min) || 1;
    const step = points.length > 1 ? (W - P*2) / (points.length - 1) : 0;
    const xy = points.map((p,i) => [
      points.length > 1 ? P + i*step : W/2,
      H - P - ((p.v - min) / span) * (H - P*2)
    ]);
    const line = xy.map(([x,y],i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const dots = xy.map(([x,y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="gym-chart" preserveAspectRatio="none">
              ${points.length > 1 ? `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
              ${dots}
            </svg>
            <div class="gym-chart-scale"><span>${min}</span><span>${max}</span></div>`;
  }

  function renderGymExercise(root){
    const { key, name } = gymState.exercise;
    const hist = exerciseHistory(key);
    const mode = modeForKey(key);
    const sel = gymState.histSel;
    const dates = hist.map(p => p.date);

    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">${escHtml(pretty(name))}</div>`;

    if (!hist.length) {
      h += '<div class="gym-nochart">Nothing logged yet</div>';
      root.innerHTML = h;
      return;
    }

    const primary = mode === 'time'
      ? { label: 'Longest hold', unit: 'sec', values: hist.map(p => p.longest) }
      : { label: 'Heaviest set', unit: 'kg',  values: hist.map(p => p.top) };
    const secondary = mode === 'time'
      ? { label: 'Total time',   unit: 'sec', values: hist.map(p => p.totalTime) }
      : { label: 'Total volume', unit: 'kg',  values: hist.map(p => p.volume) };

    [primary, secondary].forEach((s, idx) => {
      h += `<div class="chart-block">
              <div class="chart-title">${s.label} (${s.unit})</div>
              ${lineChart({
                series: [{ name: s.label, color: idx ? '#52b788' : '#1a4d2e', values: s.values }],
                labels: dates,
                yLabel: s.unit,
                selected: sel,
                onSelect: 'selectHistPoint'
              })}
            </div>`;
    });

    if (sel != null && hist[sel]) {
      const p = hist[sel];
      h += `<div class="chart-callout">
              <strong>${shortDate(p.date)}</strong> — ${setsSummary(p.sets, mode)}
            </div>`;
    }

    h += '<div class="section-label" style="margin-top:22px">Sessions</div>';
    hist.map((p, i) => ({ p, i })).reverse().forEach(({ p, i }) => {
      const d = new Date(p.date + 'T00:00:00');
      h += `<div class="gym-hist-row${sel === i ? ' selected' : ''}" onclick="selectHistPoint(${i})">
              <div class="gym-hist-date">${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
              <div class="gym-hist-sets">${setsSummary(p.sets, mode)}</div>
              <div class="gym-hist-meta">${mode === 'time'
                  ? 'longest ' + fmtDur(p.longest) + ' · ' + fmtDur(p.totalTime) + ' total'
                  : 'top ' + p.top + 'kg · ' + p.volume + 'kg total'}
                <button class="hist-open" onclick="event.stopPropagation();gymJumpTo('${p.date}')">Open</button>
              </div>
            </div>`;
    });

    root.innerHTML = h;
  }

  function selectHistPoint(i){
    gymState.histSel = (gymState.histSel === i ? null : i);
    renderGym();
  }

  function gymJumpTo(dateKey){
    gymState.date = dateKey;
    gymState.weekStart = ymd(weekStartOf(new Date(dateKey + 'T00:00:00')));
    gymState.workout = defaultWorkoutFor(dateKey);
    gymState.expanded = {};
    gymState.view = 'session';
    renderGym();
  }

  // ── EDIT ROUTINE ──

  function renderGymEdit(root){
    const routine = loadRoutine();
    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Edit Routine</div>
             <p class="gym-note">Changes here apply to future sessions. Days you've already opened keep the exercises they had.</p>
             <datalist id="exNames">${allExerciseNames().map(n => `<option value="${escHtml(n)}"></option>`).join('')}</datalist>`;

    WORKOUT_ORDER.forEach(w => {
      h += `<div class="section-label" style="margin-top:20px">${w}</div>`;
      (routine[w] || []).forEach((ex, i) => {
        h += `<div class="gym-edit-row">
                <input type="text" list="exNames" value="${escHtml(ex.name)}" onchange="editEx('${w}',${i},'name',this.value)"/>
                <div class="gym-edit-nums">
                  <input type="number" inputmode="numeric" value="${ex.sets}" onchange="editEx('${w}',${i},'sets',this.value)"/>
                  <span class="gym-x">×</span>
                  <input type="text" value="${escHtml(ex.reps)}" onchange="editEx('${w}',${i},'reps',this.value)"/>
                  <button class="gym-set-del" onclick="removeEx('${w}',${i})">✕</button>
                </div>
                <input type="text" class="gym-var-input" placeholder="Variants, comma separated (blank for none)"
                       value="${escHtml((variantsFor(ex) || []).join(', '))}"
                       onchange="editEx('${w}',${i},'variants',this.value)"/>
                <div class="gym-mode-toggle">
                  <button class="gym-mode${exMode(ex) === 'reps' ? ' active' : ''}" onclick="editEx('${w}',${i},'mode','reps')">Reps</button>
                  <button class="gym-mode${exMode(ex) === 'time' ? ' active' : ''}" onclick="editEx('${w}',${i},'mode','time')">Time</button>
                </div>
              </div>`;
      });
      h += `<button class="sync-btn" onclick="addEx('${w}')">+ Exercise</button>`;
    });

    const bars = loadBars();
    h += `<div class="section-label" style="margin-top:26px">Bar weights</div>
          <p class="gym-note">Check these against your gym — a bar that isn't 20kg throws off every number you log.</p>
          <div class="bar-weights">
            ${Object.keys(BAR_LABELS).map(k => `
              <label>${BAR_LABELS[k]}
                <input type="number" inputmode="decimal" step="0.5" value="${bars[k]}"
                       onchange="setBarWeight('${k}',this.value)"/>
              </label>`).join('')}
          </div>`;

    h += `<div style="margin-top:26px"><button class="sync-btn" onclick="resetRoutine()">Reset to program</button></div>`;
    root.innerHTML = h;
  }

  function editEx(w, i, field, value){
    const r = loadRoutine();
    if (field === 'sets') r[w][i].sets = parseInt(value) || 1;
    else if (field === 'variants') {
      // always store the array — an empty one means "deliberately none"
      r[w][i].variants = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    else if (field === 'mode') { r[w][i].mode = value; saveRoutine(r); renderGym(); return; }
    else r[w][i][field] = value;
    saveRoutine(r);
  }
  function removeEx(w, i){
    const r = loadRoutine();
    r[w].splice(i,1);
    saveRoutine(r);
    renderGym();
  }
  function addEx(w){
    const r = loadRoutine();
    if (!r[w]) r[w] = [];
    r[w].push({ name:'New exercise', sets:3, reps:'8-12' });
    saveRoutine(r);
    renderGym();
  }
  function resetRoutine(){
    saveRoutine(JSON.parse(JSON.stringify(DEFAULT_ROUTINE)));
    renderGym();
  }
