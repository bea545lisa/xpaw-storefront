const THEME_STORAGE_KEY = 'rexpaw:theme';

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
      // localStorage unavailable (private browsing quota etc.) - fail silently
    }
  });
});
