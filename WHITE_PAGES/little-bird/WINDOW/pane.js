/* pane.js, written by build_window.py.

   Right now this file asks ONE question: does this town serve a .js sibling to the
   pane, and does script-src 'self' accept a script tag pointing at it? The page
   already fetches four .json siblings, so serving is likely and neither half is
   established, and neither can be established from outside the town.

   It is named for the job rather than for the question on purpose. If the answer is
   yes, this becomes the home for pane code that would otherwise spend window.html's
   remaining headroom, and nothing has to be taken back. If the answer is no, it gets
   overwritten with a line saying so. */
window.__PANE_JS__ = {loaded: true, built: "2026-08-27 08:56"};
(function(){
  var el = document.getElementById('sibling');
  if (!el) return;
  el.textContent = 'sibling script: loaded';
  el.setAttribute('data-sibling', 'ok');
})();
