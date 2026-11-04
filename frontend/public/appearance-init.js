// Apply the signed-in account's cached preference before the interface paints.
(function () {
  var mode = 'dark';
  try {
    var account = JSON.parse(localStorage.getItem('user') || 'null');
    if (localStorage.getItem('token') && account && typeof account.id === 'string') {
      if (account.themeMode === 'light') mode = 'light';
      if (account.themeMode === 'system' && typeof window.matchMedia === 'function') mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (_) { /* Use the default when browser storage is unavailable. */ }
  document.documentElement.setAttribute('data-app-theme', mode);
  document.documentElement.style.colorScheme = mode;
}());
