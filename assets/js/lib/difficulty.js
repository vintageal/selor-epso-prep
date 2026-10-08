/*
 * Niveaux de difficulté des questions (1, 2 ou 3), communs à tous les modules.
 */
import { createElement } from './dom.js';

export const DIFFICULTIES = {
  1: { label: 'Facile', slug: 'facile' },
  2: { label: 'Moyen', slug: 'moyen' },
  3: { label: 'Difficile', slug: 'difficile' },
};

export const DIFFICULTY_LEVELS = [1, 2, 3];

export const isDifficulty = (value) => DIFFICULTY_LEVELS.includes(value);

/** Met à jour (ou crée) la pastille de niveau : « Niveau 2 · Moyen ». */
export function renderDifficulty(level, element = createElement('span', 'difficulty')) {
  const { label, slug } = DIFFICULTIES[level];
  element.textContent = `Niveau ${level} · ${label}`;
  element.dataset.level = slug;
  return element;
}
