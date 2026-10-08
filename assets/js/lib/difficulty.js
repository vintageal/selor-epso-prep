/*
 * Niveaux de difficulté des questions (1, 2 ou 3), communs à tous les modules.
 */
import { createElement } from './dom.js';
import { t } from './i18n.js';

/** Niveaux : `slug` sert aux styles (data-level), le libellé suit la langue de la page. */
export const DIFFICULTIES = {
  1: { slug: 'facile', get label() { return t('difficulty.1'); } },
  2: { slug: 'moyen', get label() { return t('difficulty.2'); } },
  3: { slug: 'difficile', get label() { return t('difficulty.3'); } },
};

export const DIFFICULTY_LEVELS = [1, 2, 3];

export const isDifficulty = (value) => DIFFICULTY_LEVELS.includes(value);

/** Met à jour (ou crée) la pastille de niveau : « Niveau 2 · Moyen ». */
export function renderDifficulty(level, element = createElement('span', 'difficulty')) {
  const { label, slug } = DIFFICULTIES[level];
  element.textContent = t('difficulty.badge', { level, label });
  element.dataset.level = slug;
  return element;
}
