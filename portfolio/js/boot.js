/* Runs before paint, for two reasons.

   1. It marks the document as scripted, so the reveal-on-scroll styles only
      apply when there is something around to reveal things.
   2. It applies a saved theme choice before the first frame, so a visitor who
      picked light does not get a flash of the dark one.

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
})();
