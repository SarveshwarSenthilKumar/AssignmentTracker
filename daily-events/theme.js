(function () {
  'use strict';
  var key = 'daily-events-theme';
  var root = document.documentElement;
  var schemeKey = 'daily-events-color-scheme';
  function applyScheme(value) {
    var scheme = ['forest', 'ocean', 'plum', 'sandstone'].includes(value) ? value : 'forest';
    root.setAttribute('data-scheme', scheme);
    var picker = document.getElementById('color-scheme');
    if (picker) picker.value = scheme;
  }
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
  var savedScheme = 'forest';
  try { savedScheme = window.localStorage.getItem(schemeKey); } catch (error) { /* Session-only switching still works. */ }
  applyScheme(savedScheme);
  document.addEventListener('DOMContentLoaded', function () { apply(root.getAttribute('data-theme')); applyScheme(root.getAttribute('data-scheme')); });
  document.addEventListener('change', function (event) {
    if (event.target.id !== 'color-scheme') return;
    applyScheme(event.target.value);
    try { window.localStorage.setItem(schemeKey, root.getAttribute('data-scheme')); } catch (error) { /* Keep the choice for this visit. */ }
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('#theme-toggle')) return;
    event.preventDefault();
    var theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(theme);
    try { window.localStorage.setItem(key, theme); } catch (error) { /* Keep the current selection without persistence. */ }
  });
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) apply(event.key === null ? 'dark' : event.newValue);
    if (event.key === schemeKey || event.key === null) applyScheme(event.key === null ? 'forest' : event.newValue);
  });
}());
