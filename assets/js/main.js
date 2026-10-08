/*
 * Prépa SELOR & EPSO — script de la page d'accueil.
 *
 * Chargé avec `defer` (et non comme module ES) pour que la page fonctionne
 * aussi lorsqu'elle est ouverte directement depuis le disque (file://).
 */
(() => {
  'use strict';

  const DESKTOP_QUERY = '(min-width: 48rem)'; // Point de rupture `md` de Tailwind

  /** Menu de navigation mobile : ouverture/fermeture accessible (libellés dans la langue de la page, portés par le bouton). */
  const initMobileMenu = () => {
    const toggle = document.querySelector('[data-menu-toggle]');
    const panel = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!panel) return;

    const label = toggle.querySelector('[data-menu-label]');
    const iconOpen = toggle.querySelector('[data-menu-icon="open"]');
    const iconClose = toggle.querySelector('[data-menu-icon="close"]');

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
      iconOpen.hidden = open;
      iconClose.hidden = !open;
      panel.hidden = !open;
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Un lien choisi dans le menu referme celui-ci.
    panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Passage en affichage bureau : le menu mobile n'a plus lieu d'être ouvert.
    window.matchMedia(DESKTOP_QUERY).addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  };

  const initCurrentYear = () => {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
      element.textContent = year;
    });
  };

  initMobileMenu();
  initCurrentYear();
})();
