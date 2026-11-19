(() => {
  let theme = 'light';
  try { theme = localStorage.getItem('bibliotrack_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch {}
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  if (document.documentElement.hasAttribute('data-admin-page')) {
    let authorized = false;
    try { authorized = sessionStorage.getItem('rolUsuario') === 'ADMIN' && Boolean(sessionStorage.getItem('token')); } catch {}
    if (!authorized) {
      document.documentElement.classList.add('admin-locked');
      location.replace('/frontend/auth/login.html');
    }
  }
  let bindings;
  const initialize = () => {
    bindings?.abort();
    bindings = new AbortController();
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    let running = false;
    const sync = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', `Activar tema ${dark ? 'claro' : 'oscuro'}`);
      button.title = `Activar tema ${dark ? 'claro' : 'oscuro'}`;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c1c20' : '#eef5f5');
    };
    sync();
    button.addEventListener('click', async () => {
      window.biblioCancelTransition?.();
      if (running) return;
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      const update = () => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('bibliotrack_theme', next); } catch {}
        sync();
      };
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
      running = true;
      const bounds = button.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = document.startViewTransition(update);
      try {
        await transition.ready;
        await document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
        ).finished;
        await transition.finished;
      } catch { update(); }
      finally { running = false; }
    });
    window.addEventListener('storage', event => {
      if (event.key === 'bibliotrack_theme' && ['light', 'dark'].includes(event.newValue)) {
        document.documentElement.dataset.theme = event.newValue;
        sync();
      }
    }, { signal: bindings.signal });
  };
  document.addEventListener('bibliotrack:mount', initialize);
})();
