/*
 * Typographie à l'affichage. Les données restent en espaces simples, ce qui garde les citations faciles à écrire.
 */

/**
 * Typographie française : espaces insécables avant « ; : ! ? » % », à l'intérieur des guillemets
 * et dans les grands nombres (« 1 000 »).
 */
export const frenchTypography = (text) =>
  text
    .replace(/ ([;:!?»%])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
    .replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0');

/**
 * Typographie néerlandaise : pas d'espace avant la ponctuation ; seuls les grands nombres
 * écrits avec une espace (« 1 000 ») reçoivent une espace insécable.
 */
export const dutchTypography = (text) => text.replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0');
