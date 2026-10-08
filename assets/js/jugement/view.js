/*
 * Éléments d'interface du jugement situationnel, partagés par le module
 * d'entraînement et le mode examen : situation, choix « plus / moins adéquate »
 * (boutons radio natifs, accessibles au clavier) et correction détaillée.
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { t, typography } from '../lib/i18n.js';
import { COMPETENCIES, OPTION_LETTERS, RANK_LABELS, scoreChoice } from './quiz.js';

const PICKS = [
  { kind: 'best', icon: 'M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 20H7' },
  { kind: 'worst', icon: 'M17 13V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 7 4h10' },
];

const icon = (path) => {
  const wrapper = hiddenFromScreenReaders(createElement('span', 'sjt-pick__icon'));
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  return wrapper;
};

const competencyChips = (ids) => {
  const list = createElement('ul', 'sjt-chips');
  list.setAttribute('aria-label', t('jugement.competenciesLabel'));
  for (const id of ids) list.append(createElement('li', 'sjt-chip', COMPETENCIES[id].label));
  return list;
};

/** Contexte et situation, suivis de la consigne. */
export function situationContent(scenario) {
  return [
    createElement('p', 'sjt-context', typography(scenario.context)),
    ...scenario.situation.map((paragraph) => createElement('p', 'sjt-situation', typography(paragraph))),
    createElement('p', 'sjt-prompt', typography(t('jugement.prompt'))),
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
    body.append(hiddenFromScreenReaders(createElement('span', 'sjt-action__letter', letter)), createElement('p', 'sjt-action__text', typography(action.text)));

    const choices = createElement('div', 'sjt-action__picks');
    for (const { kind, icon: path } of PICKS) {
      const pick = createElement('label', 'sjt-pick');
      pick.dataset.kind = kind;
      const input = createElement('input');
      Object.assign(input, { type: 'radio', name: `${name}-${kind}`, value: String(actionIndex), checked: picks[kind] === actionIndex });
      input.dataset.kind = kind;
      pick.append(input, icon(path), createElement('span', 'sr-only', typography(t('jugement.actionLabel', { letter }))), t(`jugement.picks.${kind}`));
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
    if (!Number.isInteger(index)) return t('jugement.score.none');
    const letter = OPTION_LETTERS[order.indexOf(index)];
    const rank = RANK_LABELS[scenario.actions[index].rank].toLowerCase();
    return t('jugement.score.action', { letter, rank, points: earned });
  };
  const list = createElement('ul', 'sjt-score-lines');
  list.append(
    createElement('li', '', typography(t('jugement.score.line', { pick: t('jugement.picks.best'), detail: describe(picks?.best, bestPoints) }))),
    createElement('li', '', typography(t('jugement.score.line', { pick: t('jugement.picks.worst'), detail: describe(picks?.worst, worstPoints) }))),
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
    if (picks?.best === actionIndex) head.append(createElement('span', 'sjt-yours', typography(t('jugement.yourPick.best'))));
    if (picks?.worst === actionIndex) head.append(createElement('span', 'sjt-yours', typography(t('jugement.yourPick.worst'))));

    item.append(
      head,
      createElement('p', 'sjt-action__text', typography(action.text)),
      createElement('p', 'sjt-explanation', typography(action.explanation)),
      competencyChips(action.competencies),
    );
    list.append(item);
  });
  return list;
}

/** Synthèse du scénario et compétences évaluées (la compétence principale en premier). */
export function debriefContent(scenario) {
  const competencies = createElement('ul', 'sjt-competencies');
  // La compétence principale de la situation en premier.
  const ordered = [scenario.competency, ...scenario.competencies.filter((id) => id !== scenario.competency)];
  for (const id of ordered) {
    const item = createElement('li');
    const label = id === scenario.competency ? t('jugement.mainCompetency', { label: COMPETENCIES[id].label }) : COMPETENCIES[id].label;
    item.append(createElement('strong', '', typography(t('jugement.competencyLabel', { label }))), typography(COMPETENCIES[id].description));
    competencies.append(item);
  }
  return [
    createElement('p', 'feedback__label', t('jugement.keyPoint')),
    createElement('p', 'feedback__text', typography(scenario.debrief)),
    createElement('p', 'feedback__label', t('jugement.assessed')),
    competencies,
  ];
}
