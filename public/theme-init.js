// Apply saved theme before first paint to avoid a flash of the wrong theme.
try {
  var t = localStorage.getItem('lt:theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
