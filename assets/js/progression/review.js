/*
 * Mode « Revoir mes erreurs », partagé par les modules d'entraînement :
 *   - bouton « Revoir mes erreurs (n) », affiché seulement s'il y a des erreurs à revoir ;
 *   - bandeau pendant la révision (progression, bouton pour la quitter) ;
 *   - bilan de la révision et, en révision globale (« Revoir toutes mes erreurs »),
 *     lien vers le module suivant qui a encore des erreurs.
 * L'adresse d'un module peut demander une révision : ?revision=1 (ce module)
 * ou ?revision=toutes (tous les modules, l'un après l'autre).
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { frenchTypography } from '../verbal/quiz.js';
import { MODULES, nextModuleToReview } from './stats.js';
import { REVIEW_STREAK } from './store.js';

export const REVIEW_PARAM = 'revision';
export const REVIEW_ALL = 'toutes';
const PROGRESS_PAGE = '../../progression/index.html';

/** Révision demandée par l'adresse de la page : « 1 », « toutes » ou null. */
export function requestedReview() {
  const value = new URLSearchParams(location.search).get(REVIEW_PARAM);
  return value === '1' || value === REVIEW_ALL ? value : null;
}

/** Adresse de la page d'un module en mode révision (`prefix` : chemin vers la racine du site). */
export const reviewHref = (module, mode, prefix = '../../') => `${prefix}${MODULES[module].path}?${REVIEW_PARAM}=${mode}`;

const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`;

const icon = (path) => {
  const wrapper = hiddenFromScreenReaders(createElement('span', 'revision-icon'));
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  return wrapper;
};
const REPEAT_ICON = 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4';

/** Retire ?revision=… de l'adresse, pour qu'un rechargement de la page ne relance pas la révision. */
const forgetRequest = () => {
  const url = new URL(location.href);
  if (!url.searchParams.has(REVIEW_PARAM)) return;
  url.searchParams.delete(REVIEW_PARAM);
  history.replaceState(history.state, '', url);
};

/**
 * Installe les commandes de révision dans `container`.
 * `onStart(mode)` lance la série des questions ratées ; `onQuit()` revient à l'entraînement normal.
 */
export function createReviewControls({ container, store, module, onStart, onQuit }) {
  const state = { active: false, mode: null };

  const label = createElement('span');
  const start = createElement('button', 'revision-start');
  start.type = 'button';
  start.append(icon(REPEAT_ICON), label);
  start.addEventListener('click', () => onStart('1'));

  const bannerText = createElement('p', 'revision-banner__text');
  const quit = createElement('button', 'revision-banner__quit', 'Quitter la révision');
  quit.type = 'button';
  quit.addEventListener('click', () => onQuit());
  const banner = createElement('div', 'revision-banner');
  banner.append(icon(REPEAT_ICON), bannerText, quit);

  const outcome = createElement('div', 'revision-outcome');
  outcome.tabIndex = -1;
  outcome.setAttribute('role', 'status');

  container.replaceChildren(start, banner, outcome);

  const count = () => (store.available ? store.reviewCount(module) : 0);

  const refresh = () => {
    const pending = count();
    label.textContent = `Revoir mes erreurs (${pending})`;
    start.hidden = !store.available || state.active || pending === 0;
    banner.hidden = !state.active;
  };

  /** Bilan de la révision : résultat, erreurs restantes et suite (module suivant ou page Ma progression). */
  const showOutcome = ({ correct, total }) => {
    const pending = count();
    const parts = [];
    if (total > 0) parts.push(`Révision terminée : ${plural(correct, 'bonne réponse', 'bonnes réponses')} sur ${total}.`);
    parts.push(
      pending === 0
        ? 'Plus aucune erreur à revoir dans ce module.'
        : `Encore ${plural(pending, 'question')} à revoir dans ce module : une question sort de la liste après ${REVIEW_STREAK} bonnes réponses consécutives.`,
    );

    const next = state.mode === REVIEW_ALL ? nextModuleToReview(store.getData(), module) : null;
    const link = createElement('a', 'revision-outcome__link');
    if (next) {
      link.href = reviewHref(next, REVIEW_ALL);
      link.textContent = `Continuer la révision : ${MODULES[next].label} (${store.reviewCount(next)})`;
    } else {
      link.href = PROGRESS_PAGE;
      link.textContent = state.mode === REVIEW_ALL ? 'Révision terminée : voir ma progression' : 'Voir ma progression';
    }
    outcome.replaceChildren(createElement('p', '', frenchTypography(parts.join(' '))), link);
    outcome.hidden = false;
  };

  refresh();
  outcome.hidden = true;

  return {
    get active() {
      return state.active;
    },
    get mode() {
      return state.mode;
    },
    refresh,
    /** Début d'une révision de `total` questions. */
    begin(total, mode) {
      Object.assign(state, { active: true, mode });
      outcome.hidden = true;
      this.progress(0, total);
      refresh();
    },
    progress(index, total) {
      bannerText.textContent = `Révision de vos erreurs : question ${index + 1} sur ${total}.`;
    },
    /** Fin de la révision (terminée ou quittée) ; `result` affiche le bilan. Renvoie l'élément du bilan. */
    end(result) {
      state.active = false;
      forgetRequest();
      refresh();
      if (result) showOutcome(result);
      else outcome.hidden = true;
      return outcome;
    },
    /** Révision demandée alors qu'il n'y a rien à revoir dans ce module. */
    nothingToReview(mode) {
      state.mode = mode;
      return this.end({ correct: 0, total: 0 });
    },
    /** Masque le bilan d'une révision précédente (nouvelle série d'entraînement). */
    clearOutcome() {
      outcome.hidden = true;
    },
  };
}
