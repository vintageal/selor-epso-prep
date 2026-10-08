/*
 * Outils de contrôle des textes des banques : détection des quasi-doublons et usage belge.
 */

/** Mots significatifs d'un texte (minuscules, sans accents, mots de plus de trois lettres). */
export const significantWords = (text) =>
  new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3),
  );

/** Indice de Jaccard entre deux textes : part des mots significatifs communs (0 à 1). */
export function similarity(a, b) {
  const [first, second] = [significantWords(a), significantWords(b)];
  const common = [...first].filter((word) => second.has(word)).length;
  return common / (first.size + second.size - common || 1);
}

/** Paire de textes la plus semblable : { score, i, j }. */
export function mostSimilarPair(texts) {
  let best = { score: 0, i: -1, j: -1 };
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const score = similarity(texts[i], texts[j]);
      if (score > best.score) best = { score, i, j };
    }
  }
  return best;
}

/** Formes de France à remplacer par l'usage belge (septante, nonante). */
export const NON_BELGIAN_NUMERALS = /soixante-dix|soixante et onze|soixante-(?:douze|treize|quatorze|quinze|seize|dix-sept|dix-huit|dix-neuf)|quatre-vingt-(?:dix|onze|douze|treize|quatorze|quinze|seize)/i;
