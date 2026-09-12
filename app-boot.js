// theo's day — app-boot.js
// Part of the app. Loaded by index.html in order; every function is global.

// Runs once everything above is loaded.
applyAimsState('banners');
initSyncScreen();
initNotifScreen();
fetchChessRating();
renderToday();
