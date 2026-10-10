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
    pairOpen: {},
    warmOpen: false,
    warmEditing: false,
    bodyOpen: false,
    optionsOpen: false,
    chipsOpen: false,
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
      log[k].plan = workoutTemplate(gymState.workout, k);
      // a routine edit wins once — the first session on or after it uses it up
      const ed = loadRoutineEdited();
      if (ed[gymState.workout] && k >= ed[gymState.workout]) {
        delete ed[gymState.workout];
        localStorage.setItem('theosRoutineEdited', JSON.stringify(ed));
      }
    }
    log[k].workout = gymState.workout;
    mut(log[k]);
    saveGymLog(log);
  }

  // ── MIRRORING ──
  // A new session copies the last logged session of the same workout, not the
  // routine — you've tuned your sessions by hand, so last week is the real plan.
  // Exception: if you edited that workout's routine since then, the routine wins
  // once, and from then on sessions mirror each other again.
  // Skipped exercises stay (skipping isn't removing); removed ones stay gone.

  function loadRoutineEdited(){
    try { return JSON.parse(localStorage.getItem('theosRoutineEdited') || '{}'); }
    catch { return {}; }
  }
  function markRoutineEdited(w){
    const o = loadRoutineEdited();
    (w ? [w] : WORKOUT_ORDER).forEach(x => { o[x] = getTodayKey(); });
    localStorage.setItem('theosRoutineEdited', JSON.stringify(o));
  }

  function lastSessionOf(workout, beforeKey){
    const log = loadGymLog();
    const keys = Object.keys(log).filter(k => k < beforeKey && log[k].workout === workout).sort().reverse();
    for (const k of keys) {
      const ex = log[k].exercises || {};
      if (Object.values(ex).some(sets => sets.some(hasRep))) return k;
    }
    return null;
  }

  function knownDef(base, extra){
    let found = null;
    const look = l => (l || []).forEach(e => { if (!found && slug(e.name) === base) found = e; });
    look(extra);
    Object.values(loadRoutine()).forEach(look);
    Object.values(DEFAULT_ROUTINE).forEach(look);
    return found;
  }

  function workoutTemplate(workout, dateKey){
    const fromRoutine = JSON.parse(JSON.stringify(loadRoutine()[workout] || []));
    const lastKey = lastSessionOf(workout, dateKey);
    if (!lastKey) return fromRoutine;
    const edited = loadRoutineEdited()[workout];
    if (edited && edited >= lastKey) return fromRoutine;

    const prev = loadGymLog()[lastKey];
    const exs = prev.exercises || {};
    const baseOf = k => String(k).split('--')[0];
    const loggedCount = base => Object.keys(exs)
      .filter(k => baseOf(k) === base)
      .reduce((n, k) => n + exs[k].filter(hasRep).length, 0);

    const out = [];
    const seen = new Set();
    (prev.plan || []).forEach(e => {
      const base = slug(e.name);
      if (seen.has(base)) return;
      seen.add(base);
      const item = JSON.parse(JSON.stringify(e));
      const n = loggedCount(base);
      if (n) item.sets = n;
      out.push(item);
    });
    // anything logged that the plan didn't list (older sessions had no plan)
    Object.keys(exs).forEach(k => {
      const base = baseOf(k);
      if (seen.has(base) || !exs[k].some(hasRep)) return;
      seen.add(base);
      const def = knownDef(base, prev.plan);
      const item = def ? JSON.parse(JSON.stringify(def))
                       : { name: unslug(base), sets: 3, reps: '—' };
      item.sets = loggedCount(base) || item.sets;
      out.push(item);
    });
    // last week's order becomes this week's plan
    return out.length ? byOrder(out, sessionOrder(prev), e => slug(e.name)) : fromRoutine;
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

  // ── LEFT / RIGHT SIDES ──
  // Some dumbbell work is lopsided. A split set is still one set — it just
  // carries its own weight and reps for each arm, so the weaker side is visible
  // instead of being averaged away. Stored per exercise *and* variant: the DB
  // preacher curl can be split while the EZ-bar version stays one weight.

  function loadSplits(){
    try { return JSON.parse(localStorage.getItem('theosSplitSides')) || {}; }
    catch(e){ return {}; }
  }
  function saveSplits(o){ localStorage.setItem('theosSplitSides', JSON.stringify(o)); }

  function hasSide(s){
    return (s.w2 !== '' && s.w2 != null) || (s.r2 !== '' && s.r2 != null);
  }
  // A set logged before the split existed is not missing its right arm — one
  // figure for a set has always meant both arms did that. So the right side
  // reads through to the left wherever it holds nothing of its own, and no
  // older session ever needs rewriting to show two arms.
  function sideR(s){
    return {
      w: (s.w2 === '' || s.w2 == null) ? s.w : s.w2,
      r: (s.r2 === '' || s.r2 == null) ? s.r : s.r2
    };
  }
  // a set counts as logged if either side has reps in it
  function hasRep(s){
    return (s.r !== '' && s.r != null) || (s.r2 !== '' && s.r2 != null);
  }

  function splitEnabled(ex, variant){
    if (!ex) return false;
    const key = exKey(ex, variant);
    if (loadSplits()[key]) return true;
    const sess = currentSession();
    if (sess && sess.split && sess.split[key]) return true;
    // already logged with two sides? then it's split whether the flag survived or not
    return ((sess && sess.exercises[key]) || []).some(hasSide);
  }

  function toggleSplit(base, variant){
    const ex = sessionPlan().find(e => slug(e.name) === base);
    if (!ex) return;
    const key = exKey(ex, variant);
    const on = splitEnabled(ex, variant);
    // remembered so the next session starts the same way — it never reaches back
    // into sessions already logged, which keep whatever shape they were saved in
    const prefs = loadSplits();
    if (on) delete prefs[key]; else prefs[key] = true;
    saveSplits(prefs);
    writeSession(s => {
      if (!s.split) s.split = {};
      if (on) delete s.split[key]; else s.split[key] = true;
      // switching on stores nothing — every set already reads as both arms.
      // Switching off is the only direction that touches data.
      if (on) (s.exercises[key] || []).forEach(x => { delete x.w2; delete x.r2; });
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
      const row = { w: last ? last.w : '', r: '', o: ord };
      if (last && hasSide(last)) { row.w2 = last.w2; row.r2 = ''; }
      s.exercises[key].push(row);
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
  function addBar(key, idx, base, kind, field){
    if (!kind) return;
    const f = field || 'w';
    const add = loadBars()[kind] || 0;
    writeSession(s => {
      if (!s.exercises[key] || !s.exercises[key][idx]) return;
      const cur = Number(s.exercises[key][idx][f]) || 0;
      s.exercises[key][idx][f] = Math.round((cur + add) * 100) / 100;
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
    else base = workoutTemplate(gymState.workout, gymState.date);

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
    const one = (w, r) => {
      if (r === '' || r == null) return '';
      if (mode === 'time') return w ? w + 'kg ' + fmtDur(r) : fmtDur(r);
      return w ? w + '×' + r : String(r);
    };
    return sets.filter(hasRep).map(s => {
      const R = sideR(s);
      const a = one(s.w, s.r), b = one(R.w, R.r);
      // identical arms read as one figure — the slash is what's worth seeing
      const both = (!a || !b) ? (a || b) : (a === b ? a : a + '/' + b);
      return both + mark(s);
    }).filter(Boolean).join(', ');
  }

  function sessionLogged(dateKey){
    const s = loadGymLog()[dateKey];
    if (!s || !s.exercises) return false;
    return Object.values(s.exercises).some(sets => sets.some(hasRep));
  }

  function lastEntry(key){
    const log = loadGymLog();
    const keys = Object.keys(log).filter(k => k < gymState.date).sort().reverse();
    for (const k of keys) {
      const sets = log[k].exercises && log[k].exercises[key];
      if (sets && sets.length && sets.some(hasRep)) return { date:k, sets };
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
    gymState.chipsOpen = false;
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
    gymState.chipsOpen = false;
    gymState.expanded = {};
    gymState.suggest = [];
    renderGym();
  }

  function toggleWorkoutChips(){ gymState.chipsOpen = !gymState.chipsOpen; renderGym(); }

  // ── RENDER ──

  function renderGym(){
    gymInit();
    const root = document.getElementById('gymBody');
    if (gymState.view === 'exercise') return renderGymExercise(root);
    if (gymState.view === 'weight')   return renderWeightHistory(root);
    if (gymState.view === 'history')  return renderGymHistory(root);
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
              ${gymState.workout ? `<button class="weight-chip has workout-chip${gymState.chipsOpen ? ' open' : ''}" onclick="toggleWorkoutChips()">${gymState.workout}<span class="workout-caret">&rsaquo;</span></button>` : ''}
              <button class="weight-chip${Object.keys(wAll).length ? ' has' : ''}" onclick="toggleBody()">${wShown}</button>
              ${isToday ? '' : '<button class="gym-today-btn" onclick="gymToday()">Today</button>'}
            </div>
          </div>`;

    if (gymState.bodyOpen) h += weightBoxHTML();

    // the workout row hides behind the chip on the date row — it's easy to hit by
    // accident and rarely needed. On a rest day it's the only thing to do, so it shows.
    const sched = scheduledFor(gymState.date);
    if (!gymState.workout || gymState.chipsOpen) {
      h += '<div class="gym-chips">';
      WORKOUT_ORDER.forEach(w => {
        const cls = 'gym-chip' + (w === gymState.workout ? ' active' : '') + (w === sched ? ' scheduled' : '');
        h += `<button class="${cls}" onclick="pickWorkout('${w}')">${w}</button>`;
      });
      h += `<button class="gym-chip gym-rest-chip${gymState.workout ? '' : ' active'}${sched ? '' : ' scheduled'}" onclick="setRestDay()">Rest</button>`;
      h += '</div>';
    }

    if (!gymState.workout) {
      const kept = sessionLogged(gymState.date);
      h += `<div class="gym-rest">
              <div class="gym-rest-title">${sched ? 'No session' : 'Rest day'}</div>
              <p>${kept
                ? 'This day still has a logged session saved. Pick that workout again to see it.'
                : 'Pick a workout above to log one for this day.'}</p>
            </div>
            <button class="sync-btn gym-edit-btn" onclick="gymGo('history')">History</button>`;
      root.innerHTML = h;
      return;
    }

    const order = sessionOrder(sess);
    const list = byOrder(sessionPlan(), order, e => orderBase(e.key || slug(e.name)));
    const doneCount = list.filter(e => {
      const s = sess && sess.exercises[exKey(e)];
      return s && s.some(hasRep);
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

    h += warmupHTML(sess);

    list.forEach(ex => {
      const base = slug(ex.name);
      const mixed = mixEnabled(ex);
      const variant = chosenVariant(ex);
      const key = exKey(ex, variant);
      const sets = mixed ? mergedSets(ex) : ((sess && sess.exercises[key]) || []);
      const open = !!gymState.expanded[key];
      const logged = sets.some(hasRep);
      const prev = lastEntry(key);
      const label = mixed ? pretty(ex.name) : displayName(ex, variant);
      const mode = exMode(ex);
      const muscles = exerciseMuscles(ex.name);
      const ob = orderBase(ex.key || base);
      const pos = order && order.pos[ob];

      h += `<div class="gym-ex${logged ? ' logged' : ''}">
              <div class="gym-ex-head" onclick="toggleExercise('${key}')">
                <div class="gym-ex-main">
                  <div class="gym-ex-name">${pos ? `<span class="gym-pos">${pos}</span>` : ''}${escHtml(label)}</div>
                  <div class="gym-ex-sub">${ex.sets} × ${ex.reps}${
                    muscles ? ' · ' + escHtml(muscles) : ''
                  }</div>
                  ${(logged && !open) ? '<div class="gym-ex-last gym-now">' + formSetsHTML(sets, mode) + '</div>'
                           : (prev ? '<div class="gym-ex-last"><span class="gym-last-date">' + shortDate(prev.date) + '</span>' + formSetsHTML(prev.sets, mode) + '</div>' : '')}
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
          const sVar = mixed ? s.variant : variant;
          const times = mode === 'time' ? 'for' : '×';
          const unit  = mode === 'time' ? 'sec' : 'reps';

          const barBtn = f => barKind
            ? `<button class="bar-add" onclick="addBar('${sKey}',${sIdx},'${base}','${barKind}','${f}')" title="Add bar weight">+${bars[barKind]}</button>`
            : '';
          const varSel = mixed
            ? `<select class="gym-set-var" onchange="setSetVariant('${base}','${s.key}',${s.idx},this.value)">
                      ${variantsFor(ex).map(v => `<option value="${v}"${v === s.variant ? ' selected' : ''}>${escHtml(pretty(v))}</option>`).join('')}
                    </select>`
            : '';
          const marks = `<button class="mini flag${s.f ? ' on' : ''}" onclick="toggleFailure('${sKey}',${sIdx})"
                          title="To failure">f</button>
                  <button class="mini dot form-${s.form || 'none'}" onclick="cycleForm('${sKey}',${sIdx})"
                          title="Form"></button>
                  <button class="gym-set-del" onclick="removeSet('${sKey}',${sIdx})">✕</button>`;

          // one side per line — four inputs will not sit on a 402pt row
          const R = sideR(s);
          if (splitEnabled(ex, sVar)) {
            h += `<div class="gym-set-split">
                  <div class="gym-set-row">
                    <span class="gym-set-n">${i+1}</span>
                    <span class="gym-side">L</span>
                    <input type="number" inputmode="decimal" placeholder="kg" value="${s.w ?? ''}"
                           onchange="setVal('${sKey}',${sIdx},'w',this.value)"/>
                    ${barBtn('w')}
                    <span class="gym-x">${times}</span>
                    <input type="number" inputmode="numeric" placeholder="${unit}"
                           value="${s.r ?? ''}" onchange="setVal('${sKey}',${sIdx},'r',this.value)"/>
                    ${mode === 'time' ? `<span class="gym-dur">${s.r ? fmtDur(s.r) : ''}</span>` : ''}
                    ${marks}
                  </div>
                  <div class="gym-set-row gym-set-row-b">
                    <span class="gym-set-n"></span>
                    <span class="gym-side">R</span>
                    <input type="number" inputmode="decimal" placeholder="kg" value="${R.w ?? ''}"
                           onchange="setVal('${sKey}',${sIdx},'w2',this.value)"/>
                    ${barBtn('w2')}
                    <span class="gym-x">${times}</span>
                    <input type="number" inputmode="numeric" placeholder="${unit}"
                           value="${R.r ?? ''}" onchange="setVal('${sKey}',${sIdx},'r2',this.value)"/>
                    ${mode === 'time' ? `<span class="gym-dur">${R.r ? fmtDur(R.r) : ''}</span>` : ''}
                    ${varSel}
                  </div>
                </div>`;
          } else {
            h += `<div class="gym-set-row">
                  <span class="gym-set-n">${i+1}</span>
                  <input type="number" inputmode="decimal" placeholder="kg" value="${s.w ?? ''}"
                         onchange="setVal('${sKey}',${sIdx},'w',this.value)"/>
                  ${barBtn('w')}
                  <span class="gym-x">${times}</span>
                  <input type="number" inputmode="numeric" placeholder="${unit}"
                         value="${s.r ?? ''}" onchange="setVal('${sKey}',${sIdx},'r',this.value)"/>
                  ${mode === 'time' ? `<span class="gym-dur">${s.r ? fmtDur(s.r) : ''}</span>` : ''}
                  ${varSel}
                  ${marks}
                </div>`;
          }
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
          // pairing is detected on its own; these only correct it
          if (pos) {
            const mates = order.mates[ob];
            if (mates.length) {
              h += `<button class="gym-mix-toggle" onclick="unpairExercise('${ob}')">Unpair from ${
                escHtml(joinNames(mates.map(m => baseName(sess, m))))}</button>`;
            } else {
              const others = Object.keys(order.pos).filter(b => b !== ob)
                .sort((a, b) => order.pos[a] - order.pos[b]);
              if (others.length) {
                h += `<button class="gym-mix-toggle" onclick="togglePairPicker('${ob}')">${
                  gymState.pairOpen[ob] ? 'Cancel pairing' : 'Pair with another exercise'}</button>`;
                if (gymState.pairOpen[ob]) {
                  h += '<div class="gym-swap"><span class="gym-swap-label">Alternated with</span>' +
                       others.map(b => `<button class="gym-swap-chip" onclick="pairExercise('${ob}','${b}')">${escHtml(baseName(sess, b))}</button>`).join('') +
                       '</div>';
                }
              }
            }
          }
          if (variantsFor(ex)) {
            h += `<button class="gym-mix-toggle" onclick="toggleMix('${base}')">${
              mixed ? 'Use one variant for all sets' : 'Mix variants across sets'}</button>`;
            // rarer still than mixing, so it only surfaces once you're already in here
            if (mixed) {
              const isSplit = splitEnabled(ex, variant);
              h += `<button class="gym-mix-toggle" onclick="toggleSplit('${base}','${String(variant || '').replace(/'/g,"\\'")}')">${
                isSplit ? 'One weight for both arms' : 'Split left and right'}${
                variant ? ' — ' + escHtml(pretty(variant)) : ''}</button>`;
            }
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
    h += `<div class="gym-bottom-row">
            <button class="sync-btn" onclick="gymGo('history')">History</button>
            <button class="sync-btn" onclick="toggleGymOptions()">${
              gymState.optionsOpen ? 'Close options' : 'Session options'}</button>
          </div>`;

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
        const split = !!loadSplits()[key];
        const blank = () => split ? { w:'', r:'', w2:'', r2:'' } : { w:'', r:'' };
        const seed = prev
          ? prev.sets.filter(hasRep).map(s => (split && hasSide(s))
              ? { w:s.w, r:'', w2:s.w2, r2:'' }
              : { w:s.w, r:'' })
          : Array.from({length: ex ? ex.sets : 3}, blank);
        writeSession(s => {
          s.exercises[key] = seed;
          if (split) { if (!s.split) s.split = {}; s.split[key] = true; }
        });
      }
    }
    renderGym();
  }

  function setVal(key, i, field, value){
    writeSession(s => {
      if (!s.exercises[key]) s.exercises[key] = [];
      if (!s.exercises[key][i]) s.exercises[key][i] = { w:'', r:'' };
      const row = s.exercises[key][i];
      // On a split set the right arm is only inherited until one of the two is
      // changed. Pin it to the figure it was already showing first, so the row
      // on screen and the set in storage never disagree.
      if (loadSplits()[key] || (s.split && s.split[key])) {
        const R = sideR(row);
        if ((field === 'w' || field === 'w2') && (row.w2 === '' || row.w2 == null)) row.w2 = R.w;
        if ((field === 'r' || field === 'r2') && (row.r2 === '' || row.r2 == null)) row.r2 = R.r;
      }
      row[field] = value === '' ? '' : Number(value);
      // the moment a set first gets reps is when it was done — order and
      // pairing are read from these stamps, never typed
      if ((field === 'r' || field === 'r2') && value !== '' && row.t == null) row.t = Date.now();
    });
    updateGymCounter();
  }

  function addSet(key){
    writeSession(s => {
      if (!s.exercises[key]) s.exercises[key] = [];
      const last = s.exercises[key][s.exercises[key].length-1];
      const row = { w: last ? last.w : '', r:'' };
      if (last && hasSide(last)) { row.w2 = last.w2; row.r2 = ''; }
      s.exercises[key].push(row);
    });
    renderGym();
  }

  function removeSet(key, i){
    writeSession(s => { if (s.exercises[key]) s.exercises[key].splice(i,1); });
    renderGym();
  }

  // ── WARM-UP ──
  // Two lists, Upper and Lower, written by hand: free text, one move per line,
  // no sets or reps — the point is doing it, not logging it. A session saves
  // only whether you warmed up (session.warm), never the list, so editing the
  // warm-up can't rewrite what a past day says.

  function loadWarmups(){
    try { return JSON.parse(localStorage.getItem('theosWarmups')) || {}; }
    catch(e){ return {}; }
  }
  function warmKind(workout){ return /^(lower|legs)$/i.test(workout || '') ? 'lower' : 'upper'; }
  function warmMoves(kind){
    return (loadWarmups()[kind] || '').split('\n').map(x => x.trim()).filter(Boolean);
  }

  function warmupHTML(sess){
    const kind = warmKind(gymState.workout);
    const label = kind === 'lower' ? 'Lower' : 'Upper';
    const moves = warmMoves(kind);
    const done = !!(sess && sess.warm);
    const open = gymState.warmOpen;
    let h = `<div class="gym-ex gym-warm${done ? ' logged done' : ''}">
              <div class="gym-ex-head" onclick="toggleWarmup()">
                <div class="gym-ex-main">
                  <div class="gym-ex-name">Warm-up</div>
                  <div class="gym-ex-sub">${label}${moves.length ? ' · ' + moves.length + ' move' + (moves.length === 1 ? '' : 's') : ' · not written yet'}</div>
                </div>
                <div class="res-cb gym-warm-cb" onclick="event.stopPropagation(); toggleWarmDone()">${done ? '✓' : ''}</div>
              </div>`;
    if (open) {
      h += '<div class="gym-sets">';
      if (gymState.warmEditing) {
        h += `<textarea id="warmText" class="gym-warm-text" rows="${Math.max(4, moves.length + 1)}"
                        placeholder="One move per line">${escHtml(moves.join('\n'))}</textarea>
              <div class="gym-warm-actions">
                <button class="gym-mix-toggle" onclick="saveWarmup()">Save ${label.toLowerCase()} warm-up</button>
                <button class="gym-mix-toggle" onclick="editWarmup(false)">Cancel</button>
              </div>`;
      } else {
        h += moves.length
          ? '<ul class="gym-warm-list">' + moves.map(m => `<li>${escHtml(m)}</li>`).join('') + '</ul>'
          : `<p class="gym-warm-empty">Write the moves once and they'll show on every ${label.toLowerCase()} day.</p>`;
        h += `<button class="gym-mix-toggle" onclick="editWarmup(true)">${moves.length ? 'Edit' : 'Write'} ${label.toLowerCase()} warm-up</button>`;
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  function toggleWarmup(){
    gymState.warmOpen = !gymState.warmOpen;
    gymState.warmEditing = false;
    renderGym();
  }
  function editWarmup(on){
    gymState.warmEditing = on;
    renderGym();
    if (on) { const t = document.getElementById('warmText'); if (t) t.focus(); }
  }
  function saveWarmup(){
    const t = document.getElementById('warmText');
    if (!t) return;
    const all = loadWarmups();
    all[warmKind(gymState.workout)] = t.value.split('\n').map(x => x.trim()).filter(Boolean).join('\n');
    localStorage.setItem('theosWarmups', JSON.stringify(all));
    gymState.warmEditing = false;
    renderGym();
  }
  function toggleWarmDone(){
    writeSession(s => { if (s.warm) delete s.warm; else s.warm = true; });
    // ticking it is the end of the warm-up, so fold it away
    if (currentSession().warm) { gymState.warmOpen = false; gymState.warmEditing = false; }
    renderGym();
  }

  // ── ORDER AND PAIRS ──
  // Nothing here is entered. Each logged set carries the time its reps went in,
  // so an exercise's position is when its first set was logged, and two
  // exercises whose sets alternate (A B A B) were done as a pair. A set logged
  // late (A A B B A) is not a pair — it takes three switches, not two.
  // A session only shows order if every logged set has a stamp; older sessions
  // show nothing rather than a guess. Corrections live in session.links:
  // "a|b": 1 forces a pair, 0 keeps two apart.

  function orderBase(key){ return String(key).split('--')[0]; }
  function linkKey(a, b){ return a < b ? a + '|' + b : b + '|' + a; }

  function sessionOrder(sess){
    if (!sess || !sess.exercises) return null;
    const times = {};
    for (const k of Object.keys(sess.exercises)) {
      for (const st of sess.exercises[k]) {
        if (!hasRep(st)) continue;
        if (st.t == null) return null;
        const b = orderBase(k);
        (times[b] || (times[b] = [])).push(st.t);
      }
    }
    const bases = Object.keys(times);
    if (!bases.length) return null;
    bases.forEach(b => times[b].sort((x, y) => x - y));
    const first = b => times[b][0];
    const links = sess.links || {};

    const switches = (a, b) => {
      const seq = times[a].map(t => [t, 0]).concat(times[b].map(t => [t, 1]))
        .sort((x, y) => x[0] - y[0]);
      let n = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i][1] !== seq[i-1][1]) n++;
      return n;
    };

    const parent = {};
    bases.forEach(b => parent[b] = b);
    const find = b => parent[b] === b ? b : (parent[b] = find(parent[b]));
    for (let i = 0; i < bases.length; i++) for (let j = i + 1; j < bases.length; j++) {
      const a = bases[i], b = bases[j], l = links[linkKey(a, b)];
      if (l === 1 || (l !== 0 && switches(a, b) >= 3)) parent[find(a)] = find(b);
    }

    const groups = {};
    bases.forEach(b => (groups[find(b)] || (groups[find(b)] = [])).push(b));
    const ordered = Object.values(groups)
      .map(g => g.sort((a, b) => first(a) - first(b)))
      .sort((a, b) => first(a[0]) - first(b[0]));
    const pos = {}, mates = {};
    ordered.forEach((g, i) => g.forEach(b => { pos[b] = i + 1; mates[b] = g.filter(x => x !== b); }));
    const firstAt = {};
    bases.forEach(b => firstAt[b] = first(b));
    return { pos, mates, total: ordered.length, first: firstAt };
  }

  // Started exercises first, in the order they were done (a pair sits
  // together); everything not yet started keeps its place in the plan below.
  // Used for the session on screen and for the plan next week inherits.
  function byOrder(list, ord, baseOf){
    if (!ord) return list;
    const rank = e => { const b = baseOf(e); return ord.pos[b] ? [ord.pos[b], ord.first[b]] : null; };
    const started = list.filter(e => rank(e))
      .sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1]; });
    return started.concat(list.filter(e => !rank(e)));
  }

  function ordinal(n){
    const t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    return n + ({ 1:'st', 2:'nd', 3:'rd' }[n % 10] || 'th');
  }

  // a base's name as this session knew it, else its slug read back
  function baseName(sess, b){
    const e = ((sess && sess.plan) || []).find(x => orderBase(x.key || slug(x.name)) === b);
    return pretty(e ? e.name : unslug(b));
  }

  function joinNames(list){
    return list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function unpairExercise(b){
    const ord = sessionOrder(currentSession());
    if (!ord || !ord.mates[b]) return;
    writeSession(s => {
      if (!s.links) s.links = {};
      ord.mates[b].forEach(m => { s.links[linkKey(b, m)] = 0; });
    });
    renderGym();
  }

  function togglePairPicker(b){
    gymState.pairOpen[b] = !gymState.pairOpen[b];
    renderGym();
  }

  function pairExercise(b, other){
    writeSession(s => {
      if (!s.links) s.links = {};
      s.links[linkKey(b, other)] = 1;
    });
    gymState.pairOpen[b] = false;
    renderGym();
  }

  function updateGymCounter(){
    const sess = currentSession();
    const list = sessionPlan();
    const done = list.filter(e => {
      const s = sess && sess.exercises[exKey(e)];
      return s && s.some(hasRep);
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
        s.exercises[k] = s.exercises[k].filter(hasRep);
        if (!s.exercises[k].length) delete s.exercises[k];
      });
      s.done = true;
    });
    const key = gymState.date;
    // with a Gym habit, tick that; otherwise the old Gym task
    if (!(typeof markHabitFromHobby === 'function' && markHabitFromHobby('gym', key, true))) {
      const day = getDay(key);
      let task = day.tasks.find(t => t.text.toLowerCase() === 'gym');
      if (task) {
        task.done = true;
        task.detail = gymState.workout || task.detail;
      } else {
        day.tasks.push({ text:'Gym', detail: gymState.workout || '', done:true });
      }
      saveDay(key, day);
    }
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
    const { series, labels, yLabel, y2Label, selected, onSelect, monthLabels, connectGaps } = opts;
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
        // connectGaps joins a series across days it has no value, so morning
        // weigh-ins link to morning weigh-ins even with afternoons in between
        if (v == null) { if (!connectGaps) open = false; return; }
        d += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yy(v).toFixed(1) + ' ';
        open = true;
      });
      if (d) svg += `<path d="${d.trim()}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"${s.axis === 'right' ? ' stroke-dasharray="4 3"' : ''}/>`;
      s.values.forEach((v, i) => {
        if (v == null) return;
        const sel = selected === i;
        // a series can colour each point on its own — used for form ratings
        const pc = s.pointColors ? s.pointColors[i] : null;
        const fill = pc || s.color;
        const big = pc ? 4.5 : 3.5;
        svg += `<circle cx="${x(i).toFixed(1)}" cy="${yy(v).toFixed(1)}" r="${sel ? 6 : big}" fill="${fill}"${(sel || pc) ? ` stroke="#fafaf8" stroke-width="${sel ? 2 : 1.2}"` : ''}/>`;
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

  // ── GYM CHART ──
  // The gym's own chart; reading and drawing keep lineChart above.
  // Points sit at their real date, so a two-week break shows as a gap.
  // Gridlines land on round numbers. Tap a point, or press and hold and slide,
  // to see what happened that day.

  const CHARTS = {};
  let chartSeq = 0;
  const DAY_MS = 86400000;
  const dayNum = k => Math.round(Date.parse(k + 'T00:00:00Z') / DAY_MS);
  const dayKey = n => new Date(n * DAY_MS).toISOString().slice(0, 10);
  const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const KG_STEPS  = [1.25, 2.5, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  const BW_STEPS  = [0.5, 1, 2, 5, 10, 20];
  const SEC_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200];

  // round gridlines with a little room above and below the data
  function niceAxis(vals, steps){
    const min = Math.min(...vals), max = Math.max(...vals);
    let out = null;
    for (const s of steps) {
      let lo = Math.floor(min / s + 1e-9) * s, hi = Math.ceil(max / s - 1e-9) * s;
      if (min - lo < s * 0.25) lo -= s;
      if (hi - max < s * 0.25) hi += s;
      if (min >= 0 && lo < 0) lo = 0;
      out = { lo, hi, step: s };
      if ((hi - lo) / s <= 5 + 1e-9) return out;
    }
    return out;
  }

  // the date range a chart covers: the chosen window, or from the first point, up to today
  function rangeStart(){
    const r = gymState.range || 'all';
    if (r === 'all') return null;
    const today = dayNum(ymd(new Date()));
    return dayKey(today - (r === '1m' ? 30 : 91));
  }
  function inRange(dateKey){ const s = rangeStart(); return !s || dateKey >= s; }
  function setRange(r){ gymState.range = r; renderGym(); }
  function rangeChipsHTML(){
    const r = gymState.range || 'all';
    return '<div class="range-chips">' + [['1m','1M'],['3m','3M'],['all','All']].map(([v,l]) =>
      `<button class="range-chip${r === v ? ' on' : ''}" onclick="setRange('${v}')">${l}</button>`).join('') + '</div>';
  }

  // series: [{ color, points: [{ date, v, color? }] }]
  // tip(date) returns the html shown when that day is picked
  function gymChart(o){
    const W = 340, H = 196, L = 40, R = 14, T = 14, B = 28;
    const plotW = W - L - R, plotH = H - T - B;
    const pts = o.series.flatMap(s => s.points);
    if (!pts.length) return '<div class="gym-nochart">No data yet</div>';

    const ax = niceAxis(pts.map(p => p.v), o.steps || KG_STEPS);
    const y = v => T + plotH - ((v - ax.lo) / (ax.hi - ax.lo)) * plotH;

    const today = dayNum(ymd(new Date()));
    let d0 = rangeStart() ? dayNum(rangeStart()) : Math.min(...pts.map(p => dayNum(p.date)));
    let d1 = Math.max(today, ...pts.map(p => dayNum(p.date)));
    if (d1 - d0 < 6) { d0 -= 3; d1 += 3; }
    const inset = 8;
    const x = k => L + inset + ((dayNum(k) - d0) / (d1 - d0)) * (plotW - inset * 2);

    const fmt = o.fmt || fmtNum;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg gchart-svg" role="img">`;

    // x ticks: every few days, weekly, monthly or quarterly, depending on the span
    const span = d1 - d0, ticks = [];
    if (span <= 50) {
      const every = span <= 14 ? 3 : 7;
      let n = d0;
      if (every === 7) while (new Date(n * DAY_MS).getUTCDay() !== 0) n++;
      for (; n <= d1; n += every) ticks.push({ n, lab: MON3[new Date(n * DAY_MS).getUTCMonth()] + ' ' + new Date(n * DAY_MS).getUTCDate() });
    } else {
      const s = new Date(d0 * DAY_MS);
      let yy = s.getUTCFullYear(), mm = s.getUTCMonth() + 1;
      const quarterly = span > 400, months = [];
      for (;;) {
        if (mm > 11) { mm -= 12; yy++; }
        const n = Math.round(Date.UTC(yy, mm, 1) / DAY_MS);
        if (n > d1) break;
        if (!quarterly || mm % 3 === 0)
          months.push({ n, lab: MON3[mm] + (quarterly || mm === 0 ? " '" + String(yy).slice(2) : '') });
        mm++;
      }
      const every = months.length > 6 ? 2 : 1;
      months.forEach((t, i) => { if (i % every === 0) ticks.push(t); });
      // name the month the chart opens in, without a boundary line
      if (!quarterly && (!ticks.length || ticks[0].n - d0 > 12))
        ticks.unshift({ n: d0, lab: MON3[s.getUTCMonth()], noLine: true });
    }
    const xOfN = n => L + inset + ((n - d0) / (d1 - d0)) * (plotW - inset * 2);

    for (let v = ax.lo; v <= ax.hi + 1e-9; v += ax.step) {
      const yy = y(v).toFixed(1);
      svg += `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" class="chart-grid"/>`;
      svg += `<text x="${L - 6}" y="${(Number(yy) + 3.5).toFixed(1)}" class="chart-ytick">${fmt(Math.round(v * 100) / 100)}</text>`;
    }
    let lastX = -99;
    ticks.forEach(t => {
      const xx = xOfN(t.n);
      if (!t.noLine) svg += `<line x1="${xx.toFixed(1)}" y1="${T}" x2="${xx.toFixed(1)}" y2="${T + plotH}" class="chart-grid chart-vgrid"/>`;
      if (xx - lastX >= 38) {
        svg += `<text x="${xx.toFixed(1)}" y="${H - 9}" class="chart-xtick">${t.lab}</text>`;
        lastX = xx;
      }
    });
    svg += `<line x1="${L}" y1="${T + plotH}" x2="${W - R}" y2="${T + plotH}" class="chart-axis"/>`;

    // one continuous line per series — a missing day doesn't break it
    o.series.forEach(s => {
      const p = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
      if (p.length > 1) svg += `<path d="${p.map((q, i) => (i ? 'L' : 'M') + x(q.date).toFixed(1) + ' ' + y(q.v).toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      p.forEach(q => {
        svg += `<circle cx="${x(q.date).toFixed(1)}" cy="${y(q.v).toFixed(1)}" r="${q.color ? 4.5 : 3.5}" fill="${q.color || s.color}"${q.color ? ' stroke="#fafaf8" stroke-width="1.2"' : ''}/>`;
      });
    });

    // best clean lift
    if (o.star && inRange(o.star.date)) {
      const sx = x(o.star.date), sy = y(o.star.v);
      svg += `<text x="${sx.toFixed(1)}" y="${(sy - 9).toFixed(1)}" class="chart-star">★</text>`;
    }
    svg += '</svg>';

    // scrub columns: one per day, holding every point on it
    const byDate = {};
    o.series.forEach(s => s.points.forEach(q => {
      (byDate[q.date] = byDate[q.date] || []).push({ y: y(q.v), color: q.color || s.color });
    }));
    const id = 'gc' + (++chartSeq);
    CHARTS[id] = { W, T, bottom: T + plotH,
      cols: Object.keys(byDate).sort().map(d => ({ x: x(d), ys: byDate[d], html: o.tip(d) })) };

    return `<div class="gchart" data-chart="${id}">
              ${o.title ? `<div class="chart-title">${o.title}</div>` : ''}
              <div class="gchart-plot">${svg}<div class="gtip"></div></div>
            </div>`;
  }

  // Charts arrive as html, so their touch handling is attached after render.
  function wireCharts(root){
    root.querySelectorAll('.gchart').forEach(el => {
      const c = CHARTS[el.dataset.chart];
      if (!c || !c.cols.length) return;
      const plot = el.querySelector('.gchart-plot');
      const svg = plot.querySelector('svg'), tip = plot.querySelector('.gtip');
      const NS = 'http://www.w3.org/2000/svg';
      const cursor = document.createElementNS(NS, 'g');
      svg.appendChild(cursor);
      let cur = null;

      const hide = () => { cur = null; tip.classList.remove('show'); while (cursor.firstChild) cursor.removeChild(cursor.firstChild); };
      const show = (clientX) => {
        const r = svg.getBoundingClientRect();
        const vx = r.width ? (clientX - r.left) / r.width * c.W : c.cols[0].x;
        let best = c.cols[0];
        c.cols.forEach(col => { if (Math.abs(col.x - vx) < Math.abs(best.x - vx)) best = col; });
        if (best === cur) return;
        cur = best;
        while (cursor.firstChild) cursor.removeChild(cursor.firstChild);
        const line = document.createElementNS(NS, 'line');
        [['x1', best.x], ['x2', best.x], ['y1', c.T], ['y2', c.bottom], ['class', 'chart-cursor']]
          .forEach(([k, v]) => line.setAttribute(k, v));
        cursor.appendChild(line);
        best.ys.forEach(p => {
          const dot = document.createElementNS(NS, 'circle');
          [['cx', best.x], ['cy', p.y], ['r', 6.5], ['fill', p.color], ['stroke', '#fafaf8'], ['stroke-width', 2.5]]
            .forEach(([k, v]) => dot.setAttribute(k, v));
          cursor.appendChild(dot);
        });
        tip.innerHTML = best.html;
        tip.classList.add('show');
        // centred over the point, kept inside the chart
        const pw = plot.clientWidth || r.width, tw = tip.offsetWidth || 0;
        const px = best.x / c.W * (r.width || pw);
        tip.style.left = Math.max(0, Math.min(pw - tw, px - tw / 2)) + 'px';
      };

      // press and hold to scrub; a quick swipe still scrolls the page
      let timer = null, scrubbing = false, sx = 0, sy = 0;
      plot.addEventListener('touchstart', e => {
        const t = e.touches[0]; sx = t.clientX; sy = t.clientY; scrubbing = false;
        clearTimeout(timer);
        timer = setTimeout(() => { scrubbing = true; plot.classList.add('scrubbing'); cur = null; show(sx); }, 200);
      }, { passive: true });
      plot.addEventListener('touchmove', e => {
        const t = e.touches[0];
        if (scrubbing) { e.preventDefault(); show(t.clientX); return; }
        if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) clearTimeout(timer);
      }, { passive: false });
      const end = () => { clearTimeout(timer); scrubbing = false; plot.classList.remove('scrubbing'); };
      plot.addEventListener('touchend', end);
      plot.addEventListener('touchcancel', end);
      // a plain tap picks the nearest day; tapping the box closes it
      plot.addEventListener('click', e => {
        if (e.target.closest('.gtip')) return hide();
        const was = cur; cur = null; show(e.clientX);
        if (was && was === cur) hide();
      });
    });
  }

  // one set as you'd say it: "55kg × 8", or both arms when they differ
  function oneSetText(set, mode){
    const R = sideR(set);
    if (mode !== 'time' && set.w && String(R.w) === String(set.w) && String(R.r) === String(set.r))
      return set.w + 'kg × ' + set.r;
    return setsSummary([set], mode).replace(/f$/, '') + (mode === 'time' ? '' : (set.w ? 'kg' : ' reps'));
  }

  function tipDate(k){
    return new Date(k + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const FORM_WORD = { good: 'good form', ok: 'okay form', poor: 'poor form' };
  function formTag(f){
    return f ? `<span class="tip-form"><i class="hist-form form-${f}"></i>${FORM_WORD[f]}</span>` : '<span class="tip-form muted">not rated</span>';
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
    const dates = Object.keys(w).sort().filter(inRange);
    const filter = gymState.weightFilter || 'all';

    const COLORS = { morning: '#1a4d2e', afternoon: '#e0a800', evening: '#52b788' };
    const shown = filter === 'all' ? WEIGH_SLOTS : [filter];
    const series = shown.map(s => ({
      name: s, color: COLORS[s],
      points: dates.filter(d => w[d][s] != null).map(d => ({ date: d, v: w[d][s] }))
    })).filter(s => s.points.length);

    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Bodyweight</div>`;

    h += '<div class="chart-filters">';
    [['all','All'], ...WEIGH_SLOTS.map(s => [s, s[0].toUpperCase() + s.slice(1)])].forEach(([v,l]) => {
      h += `<button class="chart-filter${filter === v ? ' active' : ''}" onclick="setWeightFilter('${v}')">${l}</button>`;
    });
    h += '</div>' + '<div class="chart-toolbar">' + rangeChipsHTML() + '</div>';

    if (!series.length) {
      h += `<div class="gym-nochart">${Object.keys(w).length ? 'Nothing in this range' : 'Nothing logged yet'}</div>`;
      root.innerHTML = h;
      return;
    }

    h += `<div class="chart-block">${gymChart({
      series, steps: BW_STEPS,
      tip: d => `<div class="tip-date">${tipDate(d)}</div>` + shown.filter(s => w[d][s] != null)
        .map(s => `<div class="tip-line"><i class="tip-key" style="background:${COLORS[s]}"></i>${s[0].toUpperCase() + s.slice(1)} <b>${fmtNum(w[d][s])}kg</b></div>`).join('')
    })}</div>`;

    if (filter === 'all' && series.length > 1) {
      h += '<div class="chart-legend">' + series.map(s =>
        `<span class="legend-item"><i style="background:${s.color}"></i>${s.name}</span>`).join('') + '</div>';
    }

    h += '<div class="section-label" style="margin-top:22px">Log</div>';
    [...dates].reverse().forEach(d => {
      const parts = WEIGH_SLOTS.filter(s => w[d][s] != null)
        .map(s => `<span class="wl-slot">${s.slice(0,3)}</span> ${fmtNum(w[d][s])}kg`).join('  ');
      h += `<div class="gym-hist-row">
              <div class="gym-hist-date">${tipDate(d)}</div>
              <div class="gym-hist-sets">${parts}</div>
            </div>`;
    });

    root.innerHTML = h;
    wireCharts(root);
  }

  function setWeightFilter(f){ gymState.weightFilter = f; gymState.weightSel = null; renderGym(); }
  function selectWeightPoint(i){ gymState.weightSel = (gymState.weightSel === i ? null : i); renderGym(); }

  // ── EXERCISE HISTORY ──

  function openExercise(key, name, from){
    gymState.exercise = { key, name: name || unslug(key) };
    gymState.histSel = null;
    gymState.exerciseFrom = from || 'session';
    gymState.view = 'exercise';
    renderGym();
  }
  function gymGo(view){ gymState.view = view; renderGym(); }

  // keep(set) narrows which sets count — e.g. only green-form ones. A session
  // with nothing left drops out entirely, so the line doesn't gap.
  function exerciseHistory(key, keep){
    const log = loadGymLog();
    return Object.keys(log).sort().map(date => {
      const sets = log[date].exercises && log[date].exercises[key];
      if (!sets) return null;
      const valid = sets.filter(hasRep).filter(s => !keep || keep(s));
      if (!valid.length) return null;
      // Both arms are read the same way whether or not the set was split: an
      // unsplit set simply has two identical sides, so averaging gives back the
      // original figure and the line stays continuous across the change. The top
      // is the *weaker* arm, because that's the one actually capping the lift.
      const vol = s => { const R = sideR(s);
        return ((Number(s.w)||0) * (Number(s.r)||0) + (Number(R.w)||0) * (Number(R.r)||0)) / 2; };
      const heavy = s => Math.min(Number(s.w)||0, Number(sideR(s).w)||0);
      const secs = s => { const R = sideR(s);
        return ((Number(s.r)||0) + (Number(R.r)||0)) / 2; };
      const volume = valid.reduce((a,s) => a + vol(s), 0);
      const top = Math.max(...valid.map(heavy));
      const totalTime = valid.reduce((a,s) => a + secs(s), 0);
      const longest = Math.max(...valid.map(secs));
      // the form of the set that made the headline number; on a tie, the best-
      // rated one, since that's the figure you'd stand behind
      const bestOf = (val) => valid.filter(s => val(s) === Math.max(...valid.map(val)))
        .sort((a, b) => FORM_RANK[a.form || ''] - FORM_RANK[b.form || ''])[0];
      const topSet = bestOf(heavy), longestSet = bestOf(secs);
      const topForm = topSet.form || '', longestForm = longestSet.form || '';
      return { date, sets: valid, volume, top, totalTime, longest, topForm, longestForm, topSet, longestSet };
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

  // the heaviest green-form set ever logged (longest hold, for timed ones)
  function bestCleanLift(key, mode){
    let best = null;
    exerciseHistory(key, s => s.form === 'good').forEach(p => {
      const v = mode === 'time' ? p.longest : p.top;
      if (!best || v > best.v) best = { date: p.date, v, set: mode === 'time' ? p.longestSet : p.topSet };
    });
    return best;
  }

  function renderGymExercise(root){
    const { key, name } = gymState.exercise;
    const show = formShown();
    const allOn = FORM_KEYS.every(f => show[f]);
    const mode = modeForKey(key);
    const hist = exerciseHistory(key, allOn ? null : (s => show[s.form || 'none'])).filter(p => inRange(p.date));
    const unit = mode === 'time' ? 'sec' : 'kg';

    let h = `<button class="gym-back" onclick="gymGo('${gymState.exerciseFrom || 'session'}')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">${escHtml(pretty(name))}</div>`;

    // the colours are the filter and the legend at once: tap one to hide those sets
    const anyRated = exerciseHistory(key).some(p => p.sets.some(s => s.form));
    h += '<div class="chart-toolbar">';
    if (anyRated) {
      h += '<div class="form-toggles">' + FORM_KEYS.map(f =>
        `<button class="form-toggle form-${f}${show[f] ? ' on' : ''}" onclick="toggleFormShown('${f}')"
                 aria-label="${f === 'none' ? 'unrated' : f} sets"><i></i></button>`
      ).join('') + '</div>';
    }
    h += rangeChipsHTML() + '</div>';

    // two numbers worth chasing: the best clean lift, and how much of the work is clean
    const best = anyRated ? bestCleanLift(key, mode) : null;
    const rangeSets = exerciseHistory(key).filter(p => inRange(p.date)).flatMap(p => p.sets);
    const rated = rangeSets.filter(s => s.form);
    if (anyRated) {
      const share = rated.length ? Math.round(100 * rated.filter(s => s.form === 'good').length / rated.length) : null;
      h += `<div class="stat-pair">
              <div class="stat-card">
                <div class="stat-label"><span class="chart-star-inline">★</span> Best clean ${mode === 'time' ? 'hold' : 'lift'}</div>
                <div class="stat-value">${best ? escHtml(oneSetText(best.set, mode)) : '—'}</div>
                <div class="stat-sub">${best ? shortDate(best.date) : 'no green sets yet'}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Green sets</div>
                <div class="stat-value">${share == null ? '—' : share + '%'}</div>
                <div class="stat-sub">${rated.length} rated${(gymState.range || 'all') === 'all' ? '' : ' in range'}</div>
              </div>
            </div>`;
    }

    if (!hist.length) {
      h += `<div class="gym-nochart">${!exerciseHistory(key).length ? 'Nothing logged yet'
             : !allOn ? 'No sets in those colours here' : 'Nothing in this range'}</div>`;
      root.innerHTML = h;
      return;
    }

    const byDate = Object.fromEntries(hist.map(p => [p.date, p]));
    const heavyLabel = mode === 'time' ? 'Longest hold' : 'Heaviest set';
    const volLabel = mode === 'time' ? 'Total time' : 'Total volume';

    h += `<div class="chart-block">${gymChart({
      title: `${heavyLabel} (${unit})`,
      steps: mode === 'time' ? SEC_STEPS : KG_STEPS,
      fmt: mode === 'time' ? fmtDur : fmtNum,
      star: best ? { date: best.date, v: best.v } : null,
      series: [{ color: '#1a4d2e', points: hist.map(p => ({
        date: p.date, v: mode === 'time' ? p.longest : p.top,
        color: anyRated ? FORM_COLORS[(mode === 'time' ? p.longestForm : p.topForm) || ''] : null })) }],
      tip: d => {
        const p = byDate[d], s = mode === 'time' ? p.longestSet : p.topSet;
        return `<div class="tip-date">${tipDate(d)}</div>
                <div class="tip-line"><b>${escHtml(oneSetText(s, mode))}</b>${formTag(s.form)}</div>`;
      }
    })}</div>`;

    h += `<div class="chart-block">${gymChart({
      title: `${volLabel} (${unit})`,
      steps: mode === 'time' ? SEC_STEPS : KG_STEPS,
      fmt: mode === 'time' ? fmtDur : fmtNum,
      series: [{ color: '#52b788', points: hist.map(p => ({ date: p.date, v: mode === 'time' ? p.totalTime : p.volume })) }],
      tip: d => {
        const p = byDate[d];
        return `<div class="tip-date">${tipDate(d)}</div>
                <div class="tip-line"><b>${mode === 'time' ? fmtDur(p.totalTime) : fmtNum(p.volume) + 'kg'}</b> over ${p.sets.length} set${p.sets.length === 1 ? '' : 's'}</div>`;
      }
    })}</div>`;

    h += '<div class="section-label" style="margin-top:22px">Sessions</div>';
    const log = loadGymLog();
    const ob = orderBase(key);
    [...hist].reverse().forEach(p => {
      const ord = sessionOrder(log[p.date]);
      let place = '';
      if (ord && ord.pos[ob]) {
        place = ordinal(ord.pos[ob]) + ' of ' + ord.total;
        if (ord.mates[ob].length) place += ', with ' + joinNames(ord.mates[ob].map(m => baseName(log[p.date], m)));
      }
      h += `<div class="gym-hist-row">
              <div class="gym-hist-date">${tipDate(p.date)}${place ? `<span class="gym-hist-place">${escHtml(place)}</span>` : ''}</div>
              <div class="gym-hist-sets">${formSetsHTML(p.sets, mode)}</div>
              <div class="gym-hist-meta">${mode === 'time'
                  ? 'longest ' + fmtDur(p.longest) + ' · ' + fmtDur(p.totalTime) + ' total'
                  : 'top ' + p.top + 'kg · ' + p.volume + 'kg total'}
                <button class="hist-open" onclick="gymJumpTo('${p.date}')">Open</button>
              </div>
            </div>`;
    });

    root.innerHTML = h;
    wireCharts(root);
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

  // ── FORM IN HISTORY ──
  // Better form often means less weight for a while, which makes a plain weight
  // line read as going backwards. Showing the rating next to each number keeps
  // that honest, and "Good form only" gives the line you'd actually stand behind.

  const FORM_COLORS = { good: '#52b788', ok: '#e0a800', poor: '#c0392b', '': '#c8c8c2' };
  const FORM_RANK   = { good: 0, ok: 1, poor: 2, '': 3 };

  // which ratings the history charts include; 'none' is unrated sets
  const FORM_KEYS = ['good','ok','poor','none'];
  function formShown(){
    return gymState.formShow || (gymState.formShow = { good:true, ok:true, poor:true, none:true });
  }
  function toggleFormShown(f){
    const show = formShown();
    // switching off the last colour would leave an empty chart — ignore it
    if (show[f] && FORM_KEYS.filter(k => show[k]).length === 1) return;
    show[f] = !show[f];
    gymState.histSel = null;
    renderGym();
  }

  // each set with its own form dot; unrated sets get no dot rather than a grey one
  function formSetsHTML(sets, mode){
    return sets.filter(hasRep).map(s => {
      const one = setsSummary([s], mode);
      if (!one) return '';
      const dot = s.form ? `<i class="hist-form form-${s.form}"></i>` : '';
      return `<span class="hist-set">${dot}${escHtml(one)}</span>`;
    }).filter(Boolean).join('');
  }

  // ── HISTORY BROWSER ──
  // Every exercise you've logged, grouped by body area. The movement groups
  // above are for swapping and are too fine to browse by, so they roll up here.

  const BODY_AREAS = [
    ['Chest',     ['chestPress','chestFly']],
    ['Back',      ['backRow','backPull','lowerBack','traps']],
    ['Shoulders', ['shoulders','sideDelts','rearDelts','frontDelts']],
    ['Arms',      ['biceps','triceps','forearms']],
    ['Legs',      ['quads','hamstrings','hinge','glutes','calves','hips','power']],
    ['Core',      ['core']],
    ['Cardio',    ['cardio']]
  ];

  function areaOf(key){
    const g = GROUP_OF[String(key).split('--')[0]];
    const hit = BODY_AREAS.find(([, gs]) => gs.includes(g));
    return hit ? hit[0] : 'Other';
  }

  // exercises logged fewer times than this sit in "Rarely done" — the same
  // threshold the streak editor uses for habits
  const HIST_MIN_SESSIONS = 3;

  function historyIndex(){
    const log = loadGymLog();
    const keys = new Set();
    Object.values(log).forEach(s => Object.keys(s.exercises || {}).forEach(k => keys.add(k)));
    return [...keys].map(key => {
      const hist = exerciseHistory(key);
      if (!hist.length) return null;
      const mode = modeForKey(key);
      const last = hist[hist.length - 1];
      const top = mode === 'time' ? fmtDur(last.longest) : fmtNum(last.top) + 'kg';
      return { key, hist, mode, count: hist.length, last: last.date, top,
               name: unslug(key), area: areaOf(key) };
    }).filter(Boolean).sort((a, b) => b.last.localeCompare(a.last));
  }

  // the last dozen sessions, each point coloured by the form of its top set
  function miniTrend(i){
    const pts = i.hist.slice(-12);
    const W = 72, H = 26, P = 4;
    const vals = pts.map(p => i.mode === 'time' ? p.longest : p.top);
    const lo = Math.min(...vals), hi = Math.max(...vals), span = (hi - lo) || 1;
    const xy = pts.map((p, k) => [
      pts.length > 1 ? P + k * (W - 2 * P) / (pts.length - 1) : W / 2,
      hi === lo ? H / 2 : H - P - ((vals[k] - lo) / span) * (H - 2 * P)
    ]);
    const path = xy.length > 1 ? `<path d="${xy.map(([x, y], k) => (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')}" fill="none" stroke="#b8b8b2" stroke-width="1.5" stroke-linejoin="round"/>` : '';
    const dots = xy.map(([x, y], k) => {
      const f = (i.mode === 'time' ? pts[k].longestForm : pts[k].topForm);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === xy.length - 1 ? 3 : 2}" fill="${f ? FORM_COLORS[f] : '#9a9a94'}"/>`;
    }).join('');
    return `<svg class="hist-trend" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${path}${dots}</svg>`;
  }

  function toggleHistArea(a){
    const open = gymState.histOpen || (gymState.histOpen = {});
    open[a] = !histAreaOpen(a);
    renderGym();
  }
  function histAreaOpen(a){
    const open = gymState.histOpen || {};
    return a in open ? open[a] : a !== 'Rarely done';
  }

  // share of rated sets that were green, for a yyyy-mm month
  function greenShare(month){
    const log = loadGymLog();
    let rated = 0, good = 0;
    Object.keys(log).filter(d => d.startsWith(month)).forEach(d =>
      Object.values(log[d].exercises || {}).forEach(sets => sets.filter(hasRep).forEach(s => {
        if (!s.form) return;
        rated++; if (s.form === 'good') good++;
      })));
    return rated ? { pct: Math.round(100 * good / rated), rated } : null;
  }

  function renderGymHistory(root){
    const items = historyIndex();
    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">History</div>`;

    if (!items.length) {
      h += '<div class="gym-nochart">Nothing logged yet</div>';
      root.innerHTML = h;
      return;
    }

    const now = new Date();
    const thisM = ymd(now).slice(0, 7);
    const prevM = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    const cur = greenShare(thisM), prev = greenShare(prevM);
    if (cur || prev) {
      h += `<div class="stat-card stat-wide">
              <div class="stat-label">Green sets this month</div>
              <div class="stat-value">${cur ? cur.pct + '%' : '—'}</div>
              <div class="stat-sub">${cur ? cur.rated + ' rated' : 'nothing rated yet'}${prev ? ' · last month ' + prev.pct + '%' : ''}</div>
            </div>`;
    }

    const regular = items.filter(i => i.count >= HIST_MIN_SESSIONS);
    const rare = items.filter(i => i.count < HIST_MIN_SESSIONS);
    const groups = BODY_AREAS.map(a => a[0]).concat('Other')
      .map(a => [a, regular.filter(i => i.area === a)])
      .filter(([, list]) => list.length);
    if (rare.length) groups.push(['Rarely done', rare]);

    const row = i => `<div class="hist-ex-row" onclick="openExercise('${i.key}', null, 'history')">
        <div class="hist-ex-main">
          <div class="hist-ex-name">${escHtml(pretty(i.name))}</div>
          <div class="gym-hist-meta">${shortDate(i.last)} · top ${i.top} · ${i.count} session${i.count === 1 ? '' : 's'}</div>
        </div>
        ${miniTrend(i)}
        <span class="gym-ex-chev">&rsaquo;</span>
      </div>`;

    groups.forEach(([a, list]) => {
      const open = histAreaOpen(a);
      h += `<button class="hist-area-head" onclick="toggleHistArea('${a}')">
              <span>${a}</span><span class="hist-area-count">${list.length}</span>
              <span class="hist-area-chev${open ? ' open' : ''}">&rsaquo;</span>
            </button>`;
      if (open) h += list.map(row).join('');
    });

    root.innerHTML = h;
  }

  // ── EDIT ROUTINE ──

  function renderGymEdit(root){
    const routine = loadRoutine();
    let h = `<button class="gym-back" onclick="gymGo('session')">&lsaquo; Back</button>
             <div class="screen-title" style="padding-top:6px">Edit Routine</div>
             <p class="gym-note">Sessions normally copy the last one of the same workout. Edit a workout here and its next session uses this instead. Days you've already opened keep what they had.</p>
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
    else if (field === 'mode') { r[w][i].mode = value; saveRoutine(r); markRoutineEdited(w); renderGym(); return; }
    else r[w][i][field] = value;
    saveRoutine(r);
    markRoutineEdited(w);
  }
  function removeEx(w, i){
    const r = loadRoutine();
    r[w].splice(i,1);
    saveRoutine(r);
    markRoutineEdited(w);
    renderGym();
  }
  function addEx(w){
    const r = loadRoutine();
    if (!r[w]) r[w] = [];
    r[w].push({ name:'New exercise', sets:3, reps:'8-12' });
    saveRoutine(r);
    markRoutineEdited(w);
    renderGym();
  }
  function resetRoutine(){
    saveRoutine(JSON.parse(JSON.stringify(DEFAULT_ROUTINE)));
    markRoutineEdited();
    renderGym();
  }
