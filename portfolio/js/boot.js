/* Runs before paint, for two reasons.

   1. It marks the document as scripted, so the reveal-on-scroll styles only
      apply when there is something around to reveal things.
   2. It applies a saved theme choice before the first frame, so a visitor who
      picked light does not get a flash of the dark one.
   3. It decides whether the name intro on the home page plays, before the
      first frame, so the page never flashes up and then gets covered. Once
      per browser session, never for reduced motion, and not when the visitor
      arrived aiming at a section (a link to /#contact should go to contact).

   Kept in its own blocking file so the Content-Security-Policy can forbid
   inline script entirely. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  try {
    var saved = window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {
    // Private mode, or storage switched off. The system preference still wins.
  }

  try {
    var path = window.location.pathname;
    var home = path === '/' || /\/index(\.html)?$/.test(path);
    if (home && !window.location.hash &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        !window.sessionStorage.getItem('intro-seen')) {
      window.sessionStorage.setItem('intro-seen', '1');
      root.classList.add('intro-play');
    }
  } catch (e) {
    // No session storage: skip the intro rather than show it on every load.
  }
})();
