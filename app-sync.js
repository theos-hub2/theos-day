// theo's day — app-sync.js
// Part of the app. Loaded by index.html in order; every function is global.

  // ── GIST SYNC ──
  const GIST_FILE = 'theos-day.json';

  function getSyncCfg() {
    return {
      token: localStorage.getItem('theosGistToken') || '',
      gistId: localStorage.getItem('theosGistId') || ''
    };
  }

  function setSyncStatus(msg, cls) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'sync-status' + (cls ? ' ' + cls : '');
  }

  function buildSnapshot() {
    const data = loadData();
    const key = getTodayKey();
    const day = data[key] || { tasks: [] };
    const tasks = day.tasks || [];
    const done = tasks.filter(t => t.done).length;
    const total = tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const streaks = Object.entries(calculateStreaks() || {})
      .map(([name, s]) => ({ name, weeks: s.weeks, per: s.per, count: s.weeks, unit: 'w' }))
      .sort((a, b) => b.weeks - a.weeks)
      .slice(0, 4);

    const res = loadGoals('year');
    const wk = loadGoals('week');
    const mo = loadGoals('month');

    return {
      updated: new Date().toISOString(),
      date: key,
      pct: pct,
      done: done,
      total: total,
      tasks: tasks.map(t => ({ text: t.text, done: !!t.done })),
      streaks: streaks,
      resolutions: {
        done: res.filter(r => r.done).length,
        total: res.length
      },
      week: {
        done: wk.filter(r => r.done).length,
        total: wk.length
      },
      weight: (() => {
        try {
          const w = JSON.parse(localStorage.getItem('theosWeight') || '{}');
          const days = Object.keys(w).sort();
          if (!days.length) return null;
          const last = w[days[days.length - 1]];
          const slot = ['morning','afternoon','evening'].find(s => last[s] != null);
          return slot ? { date: days[days.length - 1], slot, kg: last[slot] } : null;
        } catch { return null; }
      })(),
      month: {
        done: mo.filter(r => r.done).length,
        total: mo.length
      }
    };
  }

  async function pushSnapshot() {
    const { token, gistId } = getSyncCfg();
    if (!token || !gistId) return false;

    const resp = await fetch('https://api.github.com/gists/' + gistId, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: { [GIST_FILE]: { content: JSON.stringify(buildSnapshot(), null, 2) } }
      })
    });
    if (!resp.ok) throw new Error('GitHub returned ' + resp.status);
    localStorage.setItem('theosGistLastSync', new Date().toISOString());
    return true;
  }

  // Debounced — a burst of checkbox taps produces one upload.
  let syncTimer = null;
  function queueSync() {
    const { token, gistId } = getSyncCfg();
    if (!token || !gistId) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushSnapshot()
        .then(() => setSyncStatus('Synced ' + new Date().toLocaleTimeString(), 'ok'))
        .catch(err => setSyncStatus('Sync failed — ' + err.message, 'err'));
    }, 2500);
  }

  async function syncNow() {
    const { token, gistId } = getSyncCfg();
    if (!token) return setSyncStatus('Add a token first', 'err');
    if (!gistId) return setSyncStatus('Create a gist first', 'err');
    setSyncStatus('Syncing…');
    try {
      await pushSnapshot();
      setSyncStatus('Synced ' + new Date().toLocaleTimeString(), 'ok');
    } catch (err) {
      setSyncStatus('Sync failed — ' + err.message, 'err');
    }
  }

  async function createGist() {
    const token = document.getElementById('gistToken').value.trim();
    if (!token) return setSyncStatus('Add a token first', 'err');
    localStorage.setItem('theosGistToken', token);
    setSyncStatus('Creating gist…');
    try {
      const resp = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: "theo's day — widget data",
          public: false,
          files: { [GIST_FILE]: { content: JSON.stringify(buildSnapshot(), null, 2) } }
        })
      });
      if (!resp.ok) throw new Error('GitHub returned ' + resp.status);
      const gist = await resp.json();
      localStorage.setItem('theosGistId', gist.id);
      document.getElementById('gistId').value = gist.id;
      setSyncStatus('Gist created and synced', 'ok');
      showRawUrl(gist.id, gist.owner ? gist.owner.login : '');
    } catch (err) {
      setSyncStatus('Could not create gist — ' + err.message, 'err');
    }
  }

  function saveSyncSettings() {
    const token = document.getElementById('gistToken').value.trim();
    const gistId = document.getElementById('gistId').value.trim();
    localStorage.setItem('theosGistToken', token);
    localStorage.setItem('theosGistId', gistId);
    if (token && gistId) {
      setSyncStatus('Saved — tap Sync now to test', 'ok');
      showRawUrl(gistId, localStorage.getItem('theosGistOwner') || '');
    } else {
      setSyncStatus('Saved, but both fields are needed to sync');
    }
  }

  function showRawUrl(gistId, owner) {
    if (!gistId) return;
    if (owner) localStorage.setItem('theosGistOwner', owner);
    const who = owner || localStorage.getItem('theosGistOwner') || 'YOUR-USERNAME';
    const url = `https://gist.githubusercontent.com/${who}/${gistId}/raw/${GIST_FILE}`;
    document.getElementById('rawUrl').textContent = url;
    document.getElementById('rawUrlBlock').style.display = 'block';
  }

  function openSettings(){
    document.getElementById('settingsDrawer').classList.add('open');
    document.getElementById('drawerScrim').classList.add('open');
    document.getElementById('settingsDrawer').setAttribute('aria-hidden', 'false');
    renderNotifs();
    initSyncScreen();
    initNotifScreen();
  }

  function closeSettings(){
    document.getElementById('settingsDrawer').classList.remove('open');
    document.getElementById('drawerScrim').classList.remove('open');
    document.getElementById('settingsDrawer').setAttribute('aria-hidden', 'true');
  }

  function toggleToken(){
    const inp = document.getElementById('gistToken');
    const btn = document.getElementById('tokenToggle');
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    btn.textContent = showing ? 'Show' : 'Hide';
  }

  function copyToken(){
    const inp = document.getElementById('gistToken');
    const val = inp.value || localStorage.getItem('theosGistToken') || '';
    if (!val) return setSyncStatus('No token saved', 'err');
    navigator.clipboard.writeText(val)
      .then(() => setSyncStatus('Token copied', 'ok'))
      .catch(() => {
        inp.type = 'text';
        document.getElementById('tokenToggle').textContent = 'Hide';
        setSyncStatus('Copy blocked — select it from the field instead', 'err');
      });
  }

  function copyRawUrl() {
    const url = document.getElementById('rawUrl').textContent;
    navigator.clipboard.writeText(url)
      .then(() => setSyncStatus('URL copied', 'ok'))
      .catch(() => setSyncStatus('Select the URL and copy it manually', 'err'));
  }

  function initSyncScreen() {
    const { token, gistId } = getSyncCfg();
    document.getElementById('gistToken').value = token;
    document.getElementById('gistId').value = gistId;
    if (token && gistId) {
      const last = localStorage.getItem('theosGistLastSync');
      setSyncStatus(last ? 'Last synced ' + new Date(last).toLocaleString() : 'Ready', 'ok');
      showRawUrl(gistId, localStorage.getItem('theosGistOwner') || '');
    }
  }


  // ── PUSH NOTIFICATIONS ──
  // The app subscribes and parks the subscription in the same gist. A scheduled
  // GitHub Action reads it and does the actual sending.

  const VAPID_PUBLIC_KEY = 'BF3vQRrQDxoogiljhwPLYg6o5W0DCQSCjuSYvSJSyTQi8vuXkWoGC5EV_8HszV3PsyU1a7Ealof_EvdD5Uv2xj8';
  const PUSH_FILE = 'push.json';

  function setNotifStatus(msg, cls){
    const el = document.getElementById('notifStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'sync-status' + (cls ? ' ' + cls : '');
  }

  function urlBase64ToUint8Array(base64){
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function isStandalone(){
    try {
      if (window.navigator.standalone === true) return true;
      return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch { return false; }
  }

  async function writePushConfig(payload){
    const { token, gistId } = getSyncCfg();
    if (!token || !gistId) throw new Error('set up sync first');
    const resp = await fetch('https://api.github.com/gists/' + gistId, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: { [PUSH_FILE]: { content: JSON.stringify(payload, null, 2) } } })
    });
    if (!resp.ok) throw new Error('GitHub returned ' + resp.status);
  }

  const DEFAULT_NOTIFS = [
    { time: '08:00', message: 'Morning — set out what you want to get done today.', when: 'always' },
    { time: '19:00', message: '{done}/{total} done, {left} still open. Time to check in.', when: 'incomplete' }
  ];

  const NOTIF_CONDITIONS = [
    ['always',     'Always send'],
    ['incomplete', 'Only if tasks are unfinished'],
    ['complete',   "Only if everything's done"],
    ['empty',      'Only if no tasks set yet']
  ];

  function loadNotifs(){
    let s = {};
    try { s = JSON.parse(localStorage.getItem('theosNotif') || '{}'); } catch {}
    if (!Array.isArray(s.items)) {
      // carry over the old fixed morning/evening pair
      if (s.morning || s.evening) {
        s.items = [
          { time: s.morning || '08:00', message: DEFAULT_NOTIFS[0].message },
          { time: s.evening || '19:00', message: DEFAULT_NOTIFS[1].message }
        ];
      } else {
        s.items = JSON.parse(JSON.stringify(DEFAULT_NOTIFS));
      }
    }
    return s;
  }

  function saveNotifs(s){ localStorage.setItem('theosNotif', JSON.stringify(s)); }

  // the sender runs hourly, so anything past the hour would be a promise it
  // can't keep — snap to the hour and say so
  function snapHour(t){ return (t || '08:00').split(':')[0].padStart(2,'0') + ':00'; }

  function notifPrefs(){
    const s = loadNotifs();
    return { items: s.items, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
  }

  function renderNotifs(){
    const box = document.getElementById('notifList');
    if (!box) return;
    const s = loadNotifs();
    box.innerHTML = s.items.map((n, i) => `
      <div class="notif-row">
        <input type="time" step="3600" value="${n.time}" onchange="editNotif(${i},'time',this.value)"/>
        <button class="gym-set-del" onclick="removeNotif(${i})">✕</button>
        <textarea rows="2" placeholder="What should it say?"
                  onchange="editNotif(${i},'message',this.value)">${escHtml(n.message)}</textarea>
        <select class="notif-when" onchange="editNotif(${i},'when',this.value)">
          ${NOTIF_CONDITIONS.map(([v,l]) => `<option value="${v}"${(n.when || 'always') === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  function editNotif(i, field, value){
    const s = loadNotifs();
    if (!s.items[i]) return;
    s.items[i][field] = field === 'time' ? snapHour(value) : value;
    saveNotifs(s);
    renderNotifs();
    pushNotifConfig(true);
  }

  function addNotif(){
    const s = loadNotifs();
    s.items.push({ time: '12:00', message: 'Check in.', when: 'always' });
    saveNotifs(s);
    renderNotifs();
    pushNotifConfig(true);
  }

  function removeNotif(i){
    const s = loadNotifs();
    s.items.splice(i, 1);
    saveNotifs(s);
    renderNotifs();
    pushNotifConfig(true);
  }

  // only re-uploads if notifications are already switched on
  async function pushNotifConfig(quiet){
    const s = loadNotifs();
    if (!s.enabled) { if (!quiet) setNotifStatus('Tap Enable to switch these on'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setNotifStatus('Tap Enable to re-subscribe', 'err');
      const prefs = notifPrefs();
      await writePushConfig({ enabled: true, subscription: sub.toJSON(), ...prefs, updated: new Date().toISOString() });
      setNotifStatus('Saved — ' + prefs.items.length + ' notification' + (prefs.items.length === 1 ? '' : 's'), 'ok');
    } catch (err) {
      setNotifStatus('Could not save — ' + err.message, 'err');
    }
  }

  async function enableNotifications(){
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return setNotifStatus('This browser can\'t do push notifications', 'err');
    }
    if (!isStandalone()) {
      return setNotifStatus('Open the app from your home screen first — iOS only allows this in an installed app', 'err');
    }
    try {
      setNotifStatus('Asking permission…');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setNotifStatus('Permission denied — enable it in iOS Settings > Notifications', 'err');

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const prefs = notifPrefs();
      await writePushConfig({ enabled: true, subscription: sub.toJSON(), ...prefs, updated: new Date().toISOString() });
      const s = loadNotifs(); s.enabled = true; saveNotifs(s);
      setNotifStatus('On — ' + prefs.items.map(n => n.time).join(', ') + ' (' + prefs.tz + ')', 'ok');
    } catch (err) {
      setNotifStatus('Could not enable — ' + err.message, 'err');
    }
  }

  async function unusedSaveNotifPrefs(){
    const stored = JSON.parse(localStorage.getItem('theosNotif') || '{}');
    const prefs = notifPrefs();
    localStorage.setItem('theosNotif', JSON.stringify({ ...stored, ...prefs }));
    if (!stored.enabled) return setNotifStatus('Times saved — tap Enable to switch them on');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setNotifStatus('Tap Enable to re-subscribe', 'err');
      await writePushConfig({ enabled: true, subscription: sub.toJSON(), ...prefs, updated: new Date().toISOString() });
      setNotifStatus('Updated — ' + prefs.morning + ' and ' + prefs.evening, 'ok');
    } catch (err) {
      setNotifStatus('Could not save — ' + err.message, 'err');
    }
  }

  async function disableNotifications(){
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await writePushConfig({ enabled: false, updated: new Date().toISOString() });
      const s = loadNotifs(); s.enabled = false; saveNotifs(s);
      setNotifStatus('Off', 'ok');
    } catch (err) {
      setNotifStatus('Could not turn off — ' + err.message, 'err');
    }
  }

  async function testNotification(){
    if (Notification.permission !== 'granted') return setNotifStatus('Enable notifications first', 'err');
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Notifications are working.', {
      icon: './icon-192.png',
      tag: 'test'
    });
    setNotifStatus('Sent a test notification', 'ok');
  }

  function initNotifScreen(){
    renderNotifs();
    const s = loadNotifs();
    if (s.enabled) setNotifStatus('On — ' + s.items.map(n => n.time).join(', '), 'ok');
    else if (!isStandalone()) setNotifStatus('Open from your home screen to enable');
  }


  // ── SERVICE WORKER ──
  // Needs HTTPS (or localhost). Silently does nothing if opened as a file://.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('Service worker registration failed:', err);
      });
    });

    // When a new version takes over, reload once so you're not left on the old one.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }
