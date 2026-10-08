/*
 * Module « Jugement situationnel » : interface d'entraînement.
 * Le candidat désigne l'action la plus adéquate et la moins adéquate ; la correction
 * attribue des points selon la proximité avec la grille de référence et explique chaque action.
 */
import { createElement, moveFocusTo } from '../lib/dom.js';
import { frenchTypography } from '../verbal/quiz.js';
import { COMPETENCIES, MAX_POINTS, buildSteps, isComplete, scoreChoice, summarize } from './quiz.js';
import { actionPicker, correctionList, debriefContent, scoreLines, situationContent } from './view.js';

const BANK_URL = new URL('../../../data/jugement.json', import.meta.url);

const $ = (selector) => document.querySelector(selector);
const ui = {
  statScenario: $('[data-stat-scenario]'),
  statPoints: $('[data-stat-points]'),
  guidelines: $('[data-guidelines]'),
  exercise: $('[data-exercise]'),
  theme: $('[data-scenario-theme]'),
  count: $('[data-scenario-count]'),
  title: $('[data-scenario-title]'),
  situation: $('[data-scenario-situation]'),
  actions: $('[data-actions]'),
  validateWrapper: $('[data-validate-wrapper]'),
  validate: $('[data-validate]'),
  hint: $('[data-validate-hint]'),
  feedback: $('[data-feedback]'),
  nextWrapper: $('[data-next-wrapper]'),
  next: $('[data-next]'),
  nextLabel: $('[data-next-label]'),
  summary: $('[data-summary]'),
  summaryTitle: $('#bilan-titre'),
  summaryScore: $('[data-summary-score]'),
  summaryMessage: $('[data-summary-message]'),
  summaryDetails: $('[data-summary-details]'),
  restart: $('[data-restart]'),
};

const state = { scenarios: [], steps: [], index: 0, picks: {}, answered: false, results: [] };
const currentStep = () => state.steps[state.index];

/* ----- Rendu ----- */

const renderGuidelines = () => {
  const items = [
    'Lisez la situation, puis désignez l\'action la plus adéquate et l\'action la moins adéquate parmi les quatre proposées.',
    `Chaque choix rapporte jusqu'à 2 points selon sa proximité avec la grille de référence, soit ${MAX_POINTS} points par situation : 2 points pour l'action attendue, 1 point pour sa voisine dans le classement, 0 sinon.`,
    'Répondez comme vous agiriez réellement, dans le respect de votre rôle, de la ligne hiérarchique et des règles de l\'administration.',
    'La grille a été élaborée pour l\'entraînement à partir des compétences génériques évaluées lors des sélections ; elle ne reproduit pas une grille officielle.',
  ];
  ui.guidelines.replaceChildren(...items.map((text) => createElement('li', '', frenchTypography(text))));
};

const updateStats = () => {
  const step = currentStep();
  const { points, max } = summarize(state.results);
  if (step) ui.statScenario.textContent = `${step.index + 1} / ${step.count}`;
  ui.statPoints.textContent = `${points} / ${max}`;
};

const updateValidate = () => {
  const complete = isComplete(state.picks);
  ui.validate.disabled = !complete;
  ui.hint.textContent = complete ? '' : 'Choisissez une action « plus adéquate » et une action « moins adéquate ».';
};

const showStep = () => {
  const { scenario, order, index, count } = currentStep();
  Object.assign(state, { picks: {}, answered: false });
  ui.theme.textContent = scenario.theme;
  ui.count.textContent = `Situation ${index + 1} sur ${count}`;
  ui.title.textContent = frenchTypography(scenario.title);
  ui.situation.replaceChildren(...situationContent(scenario));
  ui.actions.replaceChildren(
    actionPicker(scenario, order, {
      name: `situation-${index}`,
      onChange: (picks) => {
        state.picks = picks;
        updateValidate();
      },
    }),
  );
  ui.feedback.replaceChildren();
  ui.validateWrapper.hidden = false;
  ui.nextWrapper.hidden = true;
  updateValidate();
  updateStats();
};

const verdict = (points) => {
  if (points === MAX_POINTS) return 'Excellent jugement : vos deux choix correspondent à la grille.';
  if (points >= MAX_POINTS / 2) return 'Bon jugement, à affiner : relisez les explications des actions les mieux classées.';
  return 'Jugement à retravailler : comparez votre raisonnement aux explications ci-dessous.';
};

const validate = () => {
  const step = currentStep();
  if (!step || state.answered || !isComplete(state.picks)) return;
  state.answered = true;
  const { scenario, order } = step;
  const { points, max } = scoreChoice(scenario, state.picks);
  state.results.push({ scenario, points, max });

  ui.actions.replaceChildren(correctionList(scenario, order, state.picks));
  const box = createElement('div', 'feedback');
  box.dataset.result = points === MAX_POINTS ? 'correct' : points === 0 ? 'wrong' : 'partial';
  const lines = scoreLines(scenario, order, state.picks);
  box.append(
    createElement('p', 'feedback__title', `${points} point${points > 1 ? 's' : ''} sur ${max}`),
    createElement('p', 'feedback__answer', verdict(points)),
    lines.list,
    ...debriefContent(scenario),
  );
  box.tabIndex = -1;
  ui.feedback.replaceChildren(box);

  ui.validateWrapper.hidden = true;
  ui.nextLabel.textContent = state.steps[state.index + 1] ? 'Situation suivante' : 'Voir le bilan';
  ui.nextWrapper.hidden = false;
  updateStats();
  moveFocusTo(box);
};

const showSummary = () => {
  const { points, max, byCompetency } = summarize(state.results);
  const rate = max ? points / max : 0;
  ui.summaryScore.textContent = `${points} / ${max}`;
  const assessed = Object.entries(byCompetency).filter(([, stats]) => stats.max > 0);
  const weakest = [...assessed].sort(([, a], [, b]) => a.points / a.max - b.points / b.max)[0];
  const message =
    rate >= 0.8
      ? 'Excellent : vos choix reflètent un jugement professionnel solide et loyal.'
      : rate >= 0.6
        ? 'Bon résultat : relisez les situations où vous avez perdu des points pour affiner votre jugement.'
        : 'Continuez à vous entraîner : les explications montrent les réflexes attendus d\'un agent public.';
  const focus = weakest && weakest[1].points < weakest[1].max ? ` Compétence à travailler : ${COMPETENCIES[weakest[0]].label.toLowerCase()}.` : '';
  ui.summaryMessage.textContent = frenchTypography(message + focus);
  ui.summaryDetails.replaceChildren(
    ...assessed.map(([id, stats]) => {
      const tile = createElement('div', 'summary-stat');
      tile.append(createElement('dt', 'summary-stat__label', COMPETENCIES[id].label), createElement('dd', 'summary-stat__value', `${stats.points} / ${stats.max}`));
      return tile;
    }),
  );
  ui.exercise.hidden = true;
  ui.summary.hidden = false;
  moveFocusTo(ui.summaryTitle);
};

const goToNext = () => {
  state.index += 1;
  if (!currentStep()) {
    showSummary();
    return;
  }
  showStep();
  moveFocusTo(ui.title);
};

const startSeries = () => {
  Object.assign(state, { steps: buildSteps(state.scenarios), index: 0, results: [] });
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
};

/* ----- Événements ----- */

ui.validate.addEventListener('click', validate);
ui.next.addEventListener('click', goToNext);
ui.restart.addEventListener('click', () => {
  startSeries();
  moveFocusTo(ui.title);
});

/* ----- Démarrage ----- */

renderGuidelines();

try {
  const response = await fetch(BANK_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state.scenarios = (await response.json()).scenarios;
  startSeries();
} catch (error) {
  console.error('Chargement de la banque de situations impossible :', error);
  ui.theme.textContent = 'Erreur';
  ui.situation.replaceChildren(
    createElement('p', 'text-red-700', 'Impossible de charger les situations. Vérifiez que la page est servie par un serveur web (voir le README), puis rechargez-la.'),
  );
}
