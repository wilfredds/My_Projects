/* Shows the path the visitor actually asked for, so the 404 says something
   specific instead of the same sentence for every wrong link. */
(function () {
  'use strict';
  var slot = document.getElementById('wanted');
  if (!slot) return;

  var path = window.location.pathname.replace(/^\/+/, '');
  if (!path || path.length > 60 || !/^[\w\-./]+$/.test(path)) return;

  slot.textContent = path;
})();
