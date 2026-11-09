// ── Service worker registration with auto-update ──────────────────
// Without this, a shipped fix can sit invisible behind a cached worker:
// the browser keeps serving the old bundle and the user sees a stale app
// with no way to know. That is the single most confusing class of bug to
// debug remotely — "it works for me" while a tester stares at last week's
// build — so the page takes itself out of the equation and reloads once
// the moment a new worker takes control.
//
// sw.js already calls skipWaiting() on install and clients.claim() on
// activate, so a new worker seizes control as soon as it is installed.
// That fires 'controllerchange' here, and we reload exactly once.

if ('serviceWorker' in navigator) {
  let reloading = false;

  // controllerchange also fires the very first time a worker claims a page
  // that had none — i.e. every first-time visitor. Measured on the live site,
  // that reloaded the onboarding screen ~1 s after it opened, wiping a rider
  // level the user had already tapped. Only an update has stale files to
  // replace, and an update is the only case where a controller already exists.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    // Guard against reload loops: controllerchange can fire more than once,
    // and a loop would be far worse than a stale cache.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Check for a new worker whenever the app is reopened or refocused,
      // which for a PWA is often the only "page load" a user ever does.
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => { /* offline or unsupported — the app still works */ });
  });
}
