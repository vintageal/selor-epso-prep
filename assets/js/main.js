/*
 * Prépa SELOR & EPSO — script de la page d'accueil.
 *
 * Chargé avec `defer` (et non comme module ES) pour que la page fonctionne
 * aussi lorsqu'elle est ouverte directement depuis le disque (file://).
 */
(() => {
  'use strict';

  const TOAST_DURATION_MS = 4000;
  const DESKTOP_QUERY = '(min-width: 48rem)'; // Point de rupture `md` de Tailwind

  /** Menu de navigation mobile : ouverture/fermeture accessible. */
  const initMobileMenu = () => {
    const toggle = document.querySelector('[data-menu-toggle]');
    const panel = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!panel) return;

    const label = toggle.querySelector('[data-menu-label]');
    const iconOpen = toggle.querySelector('[data-menu-icon="open"]');
    const iconClose = toggle.querySelector('[data-menu-icon="close"]');

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
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

  /** Crée la fonction d'affichage des notifications éphémères. */
  const createNotifier = () => {
    const toast = document.querySelector('[data-toast]');
    let hideTimer;

    return (message) => {
      if (!toast) return;
      clearTimeout(hideTimer);
      // Vider puis réécrire le texte force l'annonce par les lecteurs d'écran,
      // même si le même message est affiché deux fois de suite.
      toast.textContent = '';
      requestAnimationFrame(() => {
        toast.textContent = message;
        toast.classList.add('is-visible');
      });
      hideTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_DURATION_MS);
    };
  };

  /**
   * Modules pas encore publiés : le lien reste en place (pour l'accessibilité
   * et la future navigation) mais affiche un message au lieu d'une page vide.
   * Pour publier un module, il suffit de retirer l'attribut `data-coming-soon`.
   */
  const initComingSoonLinks = (notify) => {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-coming-soon]');
      if (!link) return;
      event.preventDefault();
      notify(`Le module « ${link.dataset.comingSoon} » est en cours de préparation. Revenez bientôt !`);
    });
  };

  const initCurrentYear = () => {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
      element.textContent = year;
    });
  };

  initMobileMenu();
  initComingSoonLinks(createNotifier());
  initCurrentYear();
})();
