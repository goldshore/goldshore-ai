const initializeThemeNavigation = () => {
  document.querySelectorAll<HTMLElement>('[data-theme-header]').forEach((header) => {
    if (header.dataset.navigationReady === 'true') return;
    header.dataset.navigationReady = 'true';

    const toggle = header.querySelector<HTMLButtonElement>('.nav-toggle');
    const navigation = header.querySelector<HTMLElement>('#main-nav');
    if (!toggle || !navigation) return;
    const tiers = [...navigation.querySelectorAll<HTMLDetailsElement>('.main-nav__tier')];

    const closeTiers = (except?: HTMLDetailsElement) => {
      tiers.forEach((tier) => {
        if (tier !== except) tier.open = false;
      });
    };

    const setMenu = (isOpen: boolean) => {
      header.dataset.menuOpen = String(isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    };

    toggle.addEventListener('click', () => setMenu(header.dataset.menuOpen !== 'true'));
    tiers.forEach((tier) => tier.addEventListener('toggle', () => {
      if (tier.open) closeTiers(tier);
    }));
    navigation.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) {
        closeTiers();
        setMenu(false);
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !header.contains(event.target)) closeTiers();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeTiers();
        setMenu(false);
      }
    });
  });
};

initializeThemeNavigation();
document.addEventListener('astro:page-load', initializeThemeNavigation);
