/*
 * Éléments d'interface d'une question de raisonnement abstrait,
 * partagés par le module d'entraînement et le mode examen.
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { describeFigure, renderFigure } from './figures.js';
import { OPTION_LETTERS } from './generator.js';

/** Case de la série : la figure (ou le contenu fourni), son numéro et sa description accessible. */
const figureCell = (position, description, fillBox) => {
  const cell = createElement('li', 'figure-cell');
  const box = hiddenFromScreenReaders(createElement('div', 'figure-cell__box'));
  fillBox(box);
  cell.append(
    box,
    hiddenFromScreenReaders(createElement('span', 'figure-cell__index', String(position))),
    createElement('span', 'sr-only', t('abstrait.figure', { position, description })),
  );
  return cell;
};

const shownFigureCell = (figure, position) =>
  figureCell(position, describeFigure(figure), (box) => {
    box.innerHTML = renderFigure(figure);
  });

/** Case finale de la série, affichant la bonne réponse (après correction). */
export const revealedFigureCell = (figure, position) => {
  const cell = shownFigureCell(figure, position);
  cell.dataset.state = 'revealed';
  return cell;
};

/** Cases de la série ; la dernière est « ? », ou la bonne réponse si `reveal` est vrai. */
export const sequenceCells = ({ sequence, answer }, { reveal = false } = {}) => {
  const position = sequence.length + 1;
  let last;
  if (reveal) {
    last = revealedFigureCell(answer, position);
  } else {
    last = figureCell(position, t('abstrait.missing'), (box) => {
      box.append(createElement('span', 'figure-cell__mark', '?'));
    });
    last.classList.add('figure-cell--missing');
    last.dataset.missing = '';
  }
  return [...sequence.map((figure, i) => shownFigureCell(figure, i + 1)), last];
};

/** Bouton graphique d'une proposition (A à D). */
export const optionButton = (figure, index) => {
  const button = createElement('button', 'option');
  button.type = 'button';
  button.dataset.index = String(index);
  button.append(hiddenFromScreenReaders(createElement('span', 'option__letter', OPTION_LETTERS[index])));
  button.insertAdjacentHTML('beforeend', renderFigure(figure));
  button.append(createElement('span', 'sr-only', t('common.option', { letter: OPTION_LETTERS[index], text: describeFigure(figure) })));
  return button;
};
