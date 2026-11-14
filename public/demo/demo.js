// Slide navigation: arrow keys, Page Up/Down, Home/End, buttons, and #n in the URL.
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var count = document.getElementById('count');
  var current = 0;
  function show(i, initial) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, k) {
      s.classList.toggle('active', k === current);
      s.setAttribute('aria-hidden', k === current ? 'false' : 'true');
    });
    count.textContent = (current + 1) + ' / ' + slides.length;
    if (!initial && location.hash !== '#' + (current + 1)) {
      try { history.replaceState(null, '', '#' + (current + 1)); } catch (err) { /* ignore */ }
    }
  }
  document.getElementById('prev').addEventListener('click', function () { show(current - 1); });
  document.getElementById('next').addEventListener('click', function () { show(current + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('a')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(current - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
  });
  var n = parseInt(location.hash.slice(1), 10);
  show(isNaN(n) ? 0 : n - 1, true);
})();
