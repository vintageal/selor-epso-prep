/*
 * Éléments d'interface d'une question de raisonnement verbal,
 * partagés par le module d'entraînement et le mode examen.
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { frenchTypography, highlightSegments } from './quiz.js';

/** Paragraphes du texte, avec les citations fournies surlignées. */
export const passageParagraphs = (passage, quotes = []) =>
  passage.paragraphs.map((paragraph) => {
    const element = createElement('p');
    for (const { text, highlighted } of highlightSegments(paragraph, quotes)) {
      element.append(highlighted ? createElement('mark', 'evidence-mark', frenchTypography(text)) : frenchTypography(text));
    }
    return element;
  });

/** Bouton de réponse (« Vrai », « Faux » ou « On ne peut pas savoir »). */
export const choiceButton = ({ id, label, icon, keys }) => {
  const button = createElement('button', 'choice');
  button.type = 'button';
  button.dataset.answer = id;
  button.append(
    hiddenFromScreenReaders(createElement('span', 'choice__icon', icon)),
    createElement('span', 'choice__label', label),
    hiddenFromScreenReaders(createElement('kbd', 'kbd choice__key', keys[1].toUpperCase())),
  );
  return button;
};

/** Citations exactes du texte, présentées comme preuves. */
export const evidenceQuotes = (quotes) =>
  quotes.map((quote) => {
    const blockquote = createElement('blockquote', 'evidence');
    blockquote.append(createElement('p', '', frenchTypography(`« ${quote} »`)));
    return blockquote;
  });
