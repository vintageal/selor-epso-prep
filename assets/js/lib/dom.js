/*
 * Petits utilitaires DOM partagés par les modules.
 */

/** Crée un élément ; le texte passe par textContent (jamais interprété comme du HTML). */
export const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export const hiddenFromScreenReaders = (element) => {
  element.setAttribute('aria-hidden', 'true');
  return element;
};

/** Place le focus (clavier, lecteur d'écran) sur un élément et le fait défiler dans la vue si nécessaire. */
export const moveFocusTo = (element) => {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'nearest' });
};
