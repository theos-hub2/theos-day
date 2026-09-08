// Sends theo's day push notifications.
// Runs hourly; decides whether this is a send hour in the user's own timezone,
// so it keeps working when you change countries and across DST.

const webpush = require('web-push');

const {
  GIST_OWNER,
  GIST_ID,
  GIST_TOKEN,            // needs gist scope, so the job can record what it sent
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:theo@example.com',
  CATCHUP_HOURS = '3',   // how late a notification may still be delivered
  FORCE_SLOT             // set by a manual run — sends the first one immediately
} = process.env;

const STATE_FILE = 'push-state.json';

function raw(file) {
  return `https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${file}?t=${Date.now()}`;
}

async function getJSON(file) {
  const res = await fetch(raw(file), { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

// date and clock where the user actually is
function localNow(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute'))
  };
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Anything whose time has passed today and hasn't gone out yet. This is what
// makes a late or skipped run recoverable — GitHub's scheduler regularly runs
// 30-60 minutes behind, and without this those notifications are just lost.
function dueNow(cfg, state) {
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  if (FORCE_SLOT) return items.slice(0, 1);

  const now = localNow(cfg.tz || 'UTC');
  const nowMin = now.hour * 60 + now.minute;
  const limit = Number(CATCHUP_HOURS) * 60;
  const sent = (state && state.lastSent) || {};

  return items.filter(n => {
    const due = toMinutes(n.time);
    const late = nowMin - due;
    if (late < 0) return false;              // not yet
    if (late > limit) return false;          // too stale to be useful
    return sent[n.time] !== now.date;        // already sent today?
  });
}

// {done} {total} {left} {pct} get filled from today's snapshot
function fillTemplate(message, snap) {
  const total = (snap && snap.total) || 0;
  const done = (snap && snap.done) || 0;
  return String(message || 'Time to check in.')
    .replace(/\{done\}/g, done)
    .replace(/\{total\}/g, total)
    .replace(/\{left\}/g, Math.max(0, total - done))
    .replace(/\{pct\}/g, (snap && snap.pct) || 0);
}

// kept in its own gist file so the app and this job never overwrite each other
async function saveState(state) {
  if (!GIST_TOKEN) {
    console.log('No GIST_TOKEN — cannot record what was sent, so catch-up is off.');
    return;
  }
  const res = await fetch('https://api.github.com/gists/' + GIST_ID, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + GIST_TOKEN,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: { [STATE_FILE]: { content: JSON.stringify(state, null, 2) } } })
  });
  if (!res.ok) console.log('Could not save state: HTTP ' + res.status);
}

(async () => {
  if (!GIST_OWNER || !GIST_ID || !VAPID_PRIVATE_KEY) {
    console.log('Missing GIST_OWNER, GIST_ID or VAPID_PRIVATE_KEY — nothing to do.');
    return;
  }

  let cfg;
  try {
    cfg = await getJSON('push.json');
  } catch (e) {
    console.log('No push config yet (' + e.message + '). Enable notifications in the app first.');
    return;
  }

  if (!cfg.enabled || !cfg.subscription) {
    console.log('Notifications are turned off.');
    return;
  }

  let state = { lastSent: {} };
  try { state = await getJSON(STATE_FILE); } catch { /* first run */ }
  if (!state.lastSent) state.lastSent = {};

  const now = localNow(cfg.tz || 'UTC');
  const due = dueNow(cfg, state);

  if (!due.length) {
    console.log(`Nothing due (tz ${cfg.tz}, local ${now.date} ${String(now.hour).padStart(2,'0')}:${String(now.minute).padStart(2,'0')}).`);
    return;
  }

  let snap = null;
  try { snap = await getJSON('theos-day.json'); } catch { /* template falls back to zeros */ }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let changed = false;
  for (const item of due) {
    const body = fillTemplate(item.message, snap);
    const payload = JSON.stringify({ title: "theo's day", body, tag: 'td-' + (item.time || 'now') });
    try {
      await webpush.sendNotification(cfg.subscription, payload);
      const lateBy = (now.hour * 60 + now.minute) - toMinutes(item.time);
      console.log(`Sent ${item.time} (${lateBy}m late): ${body}`);
      if (!FORCE_SLOT) { state.lastSent[item.time] = now.date; changed = true; }
    } catch (err) {
      console.log(`Push failed: ${err.statusCode || ''} ${err.message}`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('Subscription expired. Open the app and tap Enable again.');
      }
      process.exitCode = 1;
    }
  }

  if (changed) await saveState(state);
})();
