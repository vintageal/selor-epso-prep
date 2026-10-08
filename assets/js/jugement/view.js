/*
 * Éléments d'interface du jugement situationnel, partagés par le module
 * d'entraînement et le mode examen : situation, choix « plus / moins adéquate »
 * (boutons radio natifs, accessibles au clavier) et correction détaillée.
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { frenchTypography } from '../verbal/quiz.js';
import { COMPETENCIES, OPTION_LETTERS, RANK_LABELS, scoreChoice } from './quiz.js';

const PICKS = [
  { kind: 'best', label: 'Plus adéquate', icon: 'M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 20H7' },
  { kind: 'worst', label: 'Moins adéquate', icon: 'M17 13V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 7 4h10' },
];

const icon = (path) => {
  const wrapper = hiddenFromScreenReaders(createElement('span', 'sjt-pick__icon'));
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  return wrapper;
};

const competencyChips = (ids) => {
  const list = createElement('ul', 'sjt-chips');
  list.setAttribute('aria-label', 'Compétences');
  for (const id of ids) list.append(createElement('li', 'sjt-chip', COMPETENCIES[id].label));
  return list;
};

/** Contexte et situation, suivis de la consigne. */
export function situationContent(scenario) {
  return [
    createElement('p', 'sjt-context', frenchTypography(scenario.context)),
    ...scenario.situation.map((paragraph) => createElement('p', 'sjt-situation', frenchTypography(paragraph))),
    createElement('p', 'sjt-prompt', 'Parmi les actions suivantes, laquelle est la plus adéquate, et laquelle est la moins adéquate ?'),
  ];
}

/** Lit les choix cochés : index (dans `scenario.actions`) des actions « plus » et « moins » adéquates. */
export function readPicks(list) {
  const value = (kind) => {
    const checked = list.querySelector(`input[data-kind="${kind}"]:checked`);
    return checked ? Number(checked.value) : null;
  };
  return { best: value('best'), worst: value('worst') };
}

/**
 * Liste des actions avec, pour chacune, les choix « Plus adéquate » et « Moins adéquate ».
 * Une même action ne peut pas être à la fois la plus et la moins adéquate.
 * `onChange(picks)` est appelé à chaque modification.
 */
export function actionPicker(scenario, order, { name, picks = {}, onChange = () => {} }) {
  const list = createElement('ol', 'sjt-actions');
  order.forEach((actionIndex, position) => {
    const action = scenario.actions[actionIndex];
    const letter = OPTION_LETTERS[position];
    const item = createElement('li', 'sjt-action');
    const body = createElement('div', 'sjt-action__body');
    body.append(hiddenFromScreenReaders(createElement('span', 'sjt-action__letter', letter)), createElement('p', 'sjt-action__text', frenchTypography(action.text)));

    const choices = createElement('div', 'sjt-action__picks');
    for (const { kind, label, icon: path } of PICKS) {
      const pick = createElement('label', 'sjt-pick');
      pick.dataset.kind = kind;
      const input = createElement('input');
      Object.assign(input, { type: 'radio', name: `${name}-${kind}`, value: String(actionIndex), checked: picks[kind] === actionIndex });
      input.dataset.kind = kind;
      pick.append(input, icon(path), createElement('span', 'sr-only', `Action ${letter} : `), label);
      choices.append(pick);
    }
    item.append(body, choices);
    list.append(item);
  });

  list.addEventListener('change', (event) => {
    const changed = event.target;
    // Exclusivité : l'action choisie ne peut pas garder le choix opposé.
    const opposite = changed.dataset.kind === 'best' ? 'worst' : 'best';
    const conflict = list.querySelector(`input[data-kind="${opposite}"][value="${changed.value}"]:checked`);
    if (conflict) conflict.checked = false;
    onChange(readPicks(list));
  });
  return list;
}

/** Bilan chiffré d'un scénario : points obtenus pour chacun des deux choix. */
export function scoreLines(scenario, order, picks) {
  const { bestPoints, worstPoints, points, max } = scoreChoice(scenario, picks);
  const describe = (index, earned) => {
    if (!Number.isInteger(index)) return 'aucun choix (0 point sur 2)';
    const letter = OPTION_LETTERS[order.indexOf(index)];
    const rank = RANK_LABELS[scenario.actions[index].rank].toLowerCase();
    return `action ${letter}, classée « ${rank} » par la grille (${earned} point${earned > 1 ? 's' : ''} sur 2)`;
  };
  const list = createElement('ul', 'sjt-score-lines');
  list.append(
    createElement('li', '', frenchTypography(`Plus adéquate : ${describe(picks?.best, bestPoints)}`)),
    createElement('li', '', frenchTypography(`Moins adéquate : ${describe(picks?.worst, worstPoints)}`)),
  );
  return { points, max, list };
}

/** Correction détaillée : chaque action avec sa place dans la grille, le choix du candidat et l'explication. */
export function correctionList(scenario, order, picks = {}) {
  const list = createElement('ol', 'sjt-actions sjt-actions--review');
  order.forEach((actionIndex, position) => {
    const action = scenario.actions[actionIndex];
    const item = createElement('li', 'sjt-action');
    item.dataset.rank = String(action.rank);

    const head = createElement('div', 'sjt-review__head');
    head.append(
      hiddenFromScreenReaders(createElement('span', 'sjt-action__letter', OPTION_LETTERS[position])),
      createElement('span', 'sjt-rank', RANK_LABELS[action.rank]),
    );
    if (picks?.best === actionIndex) head.append(createElement('span', 'sjt-yours', 'Votre choix : plus adéquate'));
    if (picks?.worst === actionIndex) head.append(createElement('span', 'sjt-yours', 'Votre choix : moins adéquate'));

    item.append(
      head,
      createElement('p', 'sjt-action__text', frenchTypography(action.text)),
      createElement('p', 'sjt-explanation', frenchTypography(action.explanation)),
      competencyChips(action.competencies),
    );
    list.append(item);
  });
  return list;
}

/** Synthèse du scénario et compétences évaluées. */
export function debriefContent(scenario) {
  const competencies = createElement('ul', 'sjt-competencies');
  for (const id of scenario.competencies) {
    const item = createElement('li');
    item.append(createElement('strong', '', `${COMPETENCIES[id].label} : `), frenchTypography(COMPETENCIES[id].description));
    competencies.append(item);
  }
  return [
    createElement('p', 'feedback__label', 'À retenir'),
    createElement('p', 'feedback__text', frenchTypography(scenario.debrief)),
    createElement('p', 'feedback__label', 'Compétences évaluées'),
    competencies,
  ];
}
