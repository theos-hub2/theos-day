// Sends theo's day push notifications.
// Runs hourly; decides whether this is a send hour in the user's own timezone,
// so it keeps working when you change countries and across DST.

const webpush = require('web-push');

const {
  GIST_OWNER,
  GIST_ID,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:theo@example.com',
  FORCE_SLOT              // 'morning' | 'evening' — for manual test runs
} = process.env;

function raw(file) {
  return `https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${file}?t=${Date.now()}`;
}

async function getJSON(file) {
  const res = await fetch(raw(file), { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

// the hour and minute right now, where the user actually is
function localNow(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = t => Number(parts.find(p => p.type === t).value);
  return { hour: get('hour'), minute: get('minute') };
}

// which notifications are due this hour, in the user's own timezone
function dueNow(cfg) {
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  if (FORCE_SLOT) return items.slice(0, 1);          // manual run: send the first
  const { hour } = localNow(cfg.tz || 'UTC');
  return items.filter(n => Number(String(n.time || '').split(':')[0]) === hour);
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

  const due = dueNow(cfg);
  if (!due.length) {
    console.log(`Nothing due (tz ${cfg.tz}, local ${localNow(cfg.tz || 'UTC').hour}:00).`);
    return;
  }

  let snap = null;
  try { snap = await getJSON('theos-day.json'); } catch { /* fine, template falls back to zeros */ }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  for (const item of due) {
    const payload = JSON.stringify({
      title: "theo's day",
      body: fillTemplate(item.message, snap),
      tag: 'td-' + (item.time || 'now')
    });
    try {
      await webpush.sendNotification(cfg.subscription, payload);
      console.log(`Sent ${item.time}: ${fillTemplate(item.message, snap)}`);
    } catch (err) {
      console.log(`Push failed: ${err.statusCode || ''} ${err.message}`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('Subscription expired. Open the app and tap Enable again.');
      }
      process.exitCode = 1;
    }
  }
})();
