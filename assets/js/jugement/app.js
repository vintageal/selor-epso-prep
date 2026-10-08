/*
 * Module « Jugement situationnel » : interface d'entraînement.
 * Le candidat désigne l'action la plus adéquate et la moins adéquate ; la correction
 * attribue des points selon la proximité avec la grille de référence et explique chaque action.
 */
import { renderDifficulty } from '../lib/difficulty.js';
import { createElement, moveFocusTo } from '../lib/dom.js';
import { bankUrl, t, typography } from '../lib/i18n.js';
import { createReviewControls, requestedReview } from '../progression/review.js';
import { createStore } from '../progression/store.js';
import { COMPETENCIES, MAX_POINTS, buildSteps, isComplete, scoreChoice, summarize } from './quiz.js';
import { actionPicker, correctionList, debriefContent, scoreLines, situationContent } from './view.js';

const MODULE = 'jugement';
const BANK_URL = bankUrl('jugement');

const $ = (selector) => document.querySelector(selector);
const ui = {
  statScenario: $('[data-stat-scenario]'),
  statPoints: $('[data-stat-points]'),
  guidelines: $('[data-guidelines]'),
  exercise: $('[data-exercise]'),
  theme: $('[data-scenario-theme]'),
  level: $('[data-scenario-level]'),
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
  review: $('[data-review]'),
};

const progress = createStore();
const state = { scenarios: [], steps: [], index: 0, picks: {}, answered: false, results: [], reviewing: false, shownAt: 0 };
const currentStep = () => state.steps[state.index];

/* ----- Rendu ----- */

const renderGuidelines = () => {
  const items = [t('jugement.guidelines.read'), t('jugement.guidelines.points', { max: MAX_POINTS }), t('jugement.guidelines.honest'), t('jugement.guidelines.grid')];
  ui.guidelines.replaceChildren(...items.map((text) => createElement('li', '', typography(text))));
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
  ui.hint.textContent = complete ? '' : typography(t('jugement.validateHint'));
};

const showStep = () => {
  const { scenario, order, index, count } = currentStep();
  Object.assign(state, { picks: {}, answered: false });
  ui.theme.textContent = scenario.theme;
  renderDifficulty(scenario.difficulty, ui.level);
  ui.level.hidden = false;
  ui.count.textContent = t('jugement.situationCount', { index: index + 1, count });
  ui.title.textContent = typography(scenario.title);
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
  state.shownAt = performance.now();
  if (state.reviewing) review.progress(state.index, state.steps.length);
  updateValidate();
  updateStats();
};

const verdict = (points) => {
  if (points === MAX_POINTS) return t('jugement.verdict.max');
  if (points >= MAX_POINTS / 2) return t('jugement.verdict.half');
  return t('jugement.verdict.low');
};

const validate = () => {
  const step = currentStep();
  if (!step || state.answered || !isComplete(state.picks)) return;
  state.answered = true;
  const { scenario, order } = step;
  const { points, max } = scoreChoice(scenario, state.picks);
  state.results.push({ scenario, points, max });
  // Une situation est réussie avec le maximum de points ; le score partiel est conservé.
  progress.recordAnswer({
    module: MODULE,
    questionId: scenario.id,
    correct: points === max,
    score: points / max,
    durationMs: performance.now() - state.shownAt,
    source: state.reviewing ? 'revision' : 'entrainement',
  });
  review.refresh();

  ui.actions.replaceChildren(correctionList(scenario, order, state.picks));
  const box = createElement('div', 'feedback');
  box.dataset.result = points === MAX_POINTS ? 'correct' : points === 0 ? 'wrong' : 'partial';
  const lines = scoreLines(scenario, order, state.picks);
  box.append(
    createElement('p', 'feedback__title', t('jugement.points', { points, max })),
    createElement('p', 'feedback__answer', typography(verdict(points))),
    lines.list,
    ...debriefContent(scenario),
  );
  box.tabIndex = -1;
  ui.feedback.replaceChildren(box);

  ui.validateWrapper.hidden = true;
  ui.nextLabel.textContent = t(state.steps[state.index + 1] ? 'jugement.nextSituation' : 'common.seeSummary');
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
  const message = rate >= 0.8 ? t('jugement.summary.excellent') : rate >= 0.6 ? t('jugement.summary.good') : t('jugement.summary.keepGoing');
  const focus = weakest && weakest[1].points < weakest[1].max ? ` ${t('jugement.summary.focus', { label: COMPETENCIES[weakest[0]].label.toLowerCase() })}` : '';
  ui.summaryMessage.textContent = typography(message + focus);
  ui.summaryDetails.replaceChildren(
    ...assessed.map(([id, stats]) => {
      const tile = createElement('div', 'summary-stat');
      tile.append(createElement('dt', 'summary-stat__label', COMPETENCIES[id].label), createElement('dd', 'summary-stat__value', `${stats.points} / ${stats.max}`));
      return tile;
    }),
  );
  ui.exercise.hidden = true;
  ui.summary.hidden = false;
  if (state.reviewing) {
    state.reviewing = false;
    const full = state.results.filter((result) => result.points === result.max).length;
    moveFocusTo(review.end({ correct: full, total: state.results.length }));
  } else {
    moveFocusTo(ui.summaryTitle);
  }
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
  Object.assign(state, { steps: buildSteps(state.scenarios), index: 0, results: [], reviewing: false });
  review.clearOutcome();
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
};

/** Révision : uniquement les situations où le maximum de points n'a pas été obtenu. */
const startReview = (mode) => {
  const ids = progress.reviewList(MODULE).map((entry) => entry.questionId);
  const scenarios = ids.map((id) => state.scenarios.find((scenario) => scenario.id === id)).filter(Boolean);
  // Situation retirée de la banque : elle sort de la liste.
  ids.filter((id) => !scenarios.some((scenario) => scenario.id === id)).forEach((id) => progress.dropReview(MODULE, id));

  if (scenarios.length === 0) {
    startSeries();
    review.nothingToReview(mode);
    return;
  }
  Object.assign(state, { steps: buildSteps(scenarios), index: 0, results: [], reviewing: true });
  review.begin(scenarios.length, mode);
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
  moveFocusTo(ui.title);
};

const quitReview = () => {
  review.end();
  startSeries();
  moveFocusTo(ui.title);
};

const review = createReviewControls({ container: ui.review, store: progress, module: MODULE, onStart: startReview, onQuit: quitReview });

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
  const requested = requestedReview();
  if (requested) startReview(requested);
  else startSeries();
} catch (error) {
  console.error('Chargement de la banque de situations impossible :', error);
  ui.theme.textContent = t('common.error');
  ui.situation.replaceChildren(createElement('p', 'text-red-700', t('jugement.loadError')));
}
