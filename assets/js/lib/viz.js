/*
 * Utilitaires des graphiques en SVG (sans bibliothèque), partagés par le module
 * « Raisonnement numérique » et la page « Ma progression ».
 */
import { createElement, hiddenFromScreenReaders } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crée un élément SVG avec ses attributs. */
export const svgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
};

/* ----- Infobulle (une par visuel) ----- */

export const createTooltip = (host) => {
  const tooltip = hiddenFromScreenReaders(createElement('div', 'viz-tooltip'));
  tooltip.hidden = true;
  host.append(tooltip);
  return {
    /** `rows` : [{ label, value, key: 'bar' | 'line', series }], affichés valeur d'abord. */
    show(title, rows, x, y) {
      tooltip.replaceChildren(createElement('p', 'viz-tooltip__title', title));
      for (const row of rows) {
        const line = createElement('p', 'viz-tooltip__row');
        const key = createElement('span', `viz-key viz-key--${row.key}`);
        key.dataset.series = String(row.series);
        line.append(key, createElement('strong', '', row.value), createElement('span', 'viz-tooltip__label', row.label));
        tooltip.append(line);
      }
      tooltip.hidden = false;
      const maxLeft = host.clientWidth - tooltip.offsetWidth - 4;
      tooltip.style.left = `${Math.max(4, Math.min(x + 12, maxLeft))}px`;
      tooltip.style.top = `${Math.max(4, y - tooltip.offsetHeight - 8)}px`;
    },
    hide() {
      tooltip.hidden = true;
    },
  };
};
