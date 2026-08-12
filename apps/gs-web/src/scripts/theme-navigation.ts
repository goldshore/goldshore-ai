const initializeThemeNavigation = () => {
  document.querySelectorAll<HTMLElement>('[data-theme-header]').forEach((header) => {
    if (header.dataset.navigationReady === 'true') return;
    header.dataset.navigationReady = 'true';

    const toggle = header.querySelector<HTMLButtonElement>('.nav-toggle');
    const navigation = header.querySelector<HTMLElement>('#main-nav');
    if (!toggle || !navigation) return;

    const setMenu = (isOpen: boolean) => {
      header.dataset.menuOpen = String(isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    };

    toggle.addEventListener('click', () => setMenu(header.dataset.menuOpen !== 'true'));
    navigation.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenu(false);
    });
  });
};

initializeThemeNavigation();
document.addEventListener('astro:page-load', initializeThemeNavigation);
