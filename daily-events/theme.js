(function () {
  'use strict';
  var key = 'daily-events-theme';
  var root = document.documentElement;
  function apply(value) {
    var theme = value === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    var button = document.getElementById('theme-toggle');
    if (button) {
      var next = theme === 'dark' ? 'light' : 'dark';
      button.textContent = next === 'light' ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      button.title = 'Current theme: ' + theme;
    }
  }
  var saved = 'dark';
  try { saved = window.localStorage.getItem(key); } catch (error) { /* Session-only switching still works. */ }
  apply(saved);
  document.addEventListener('DOMContentLoaded', function () { apply(root.getAttribute('data-theme')); });
  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('#theme-toggle')) return;
    event.preventDefault();
    var theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(theme);
    try { window.localStorage.setItem(key, theme); } catch (error) { /* Keep the current selection without persistence. */ }
  });
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
}());
