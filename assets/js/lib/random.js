/*
 * Utilitaires de tirage aléatoire.
 *
 * Chaque fonction reçoit la source d'aléa (`random`, qui renvoie un nombre dans
 * [0, 1[ comme Math.random) : on peut ainsi injecter une source reproductible
 * dans les tests.
 */

/** Source pseudo-aléatoire reproductible (algorithme mulberry32). */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entier aléatoire entre `min` et `max` inclus. */
export const randInt = (random, min, max) => min + Math.floor(random() * (max - min + 1));

/** Élément aléatoire d'un tableau. */
export const pick = (random, items) => items[Math.floor(random() * items.length)];

/** Copie mélangée d'un tableau (Fisher-Yates). */
export function shuffle(random, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
