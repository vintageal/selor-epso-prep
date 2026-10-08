/*
 * Module « Raisonnement numérique » : interface d'entraînement.
 * Données (tableau ou graphique) à gauche, question à droite ; correction immédiate
 * avec les données utilisées, la formule et le calcul étape par étape.
 */
import { renderDifficulty } from '../lib/difficulty.js';
import { createElement, moveFocusTo } from '../lib/dom.js';
import { bankUrl, t, typography } from '../lib/i18n.js';
import { createReviewControls, requestedReview } from '../progression/review.js';
import { createStore } from '../progression/store.js';
import { SKILLS, buildReviewSteps, buildSteps, summarize } from './quiz.js';
import { answerSentence, calculationDetails, errorHint, optionButton, scenarioVisual } from './view.js';

const MODULE = 'numerique';
const BANK_URL = bankUrl('numerique');
const KEY_TO_OPTION = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };

const $ = (selector) => document.querySelector(selector);
const ui = {
  statScenario: $('[data-stat-scenario]'),
  statScore: $('[data-stat-score]'),
  guidelines: $('[data-guidelines]'),
  exercise: $('[data-exercise]'),
  theme: $('[data-scenario-theme]'),
  count: $('[data-scenario-count]'),
  title: $('[data-scenario-title]'),
  note: $('[data-scenario-note]'),
  visual: $('[data-scenario-visual]'),
  questionLabel: $('[data-question-label]'),
  questionLevel: $('[data-question-level]'),
  questionText: $('[data-question-text]'),
  choices: $('[data-choices]'),
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
const state = { scenarios: [], steps: [], index: 0, answered: false, results: [], reviewing: false, shownAt: 0 };
const currentStep = () => state.steps[state.index];

/* ----- Rendu ----- */

const renderGuidelines = () => {
  ui.guidelines.replaceChildren(
    ...Object.values(SKILLS).map(({ label, tip }) => {
      const item = createElement('li');
      item.append(createElement('strong', 'font-semibold', typography(t('numerique.guidelineLabel', { label }))), typography(tip));
      return item;
    }),
    createElement('li', '', typography(t('numerique.calculatorTip'))),
  );
};

const updateStats = () => {
  const step = currentStep();
  const { correct, total } = summarize(state.results);
  if (step) ui.statScenario.textContent = `${step.scenarioIndex + 1} / ${step.scenarioCount}`;
  ui.statScore.textContent = `${correct} / ${total}`;
};

const nextButtonLabel = () => {
  const upcoming = state.steps[state.index + 1];
  if (!upcoming) return t('common.seeSummary');
  return upcoming.scenario === currentStep().scenario ? t('common.nextQuestion') : t('numerique.nextData');
};

const showStep = () => {
  const step = currentStep();
  const previous = state.steps[state.index - 1];
  const isNewScenario = !previous || previous.scenario !== step.scenario;
  const { scenario, question } = step;

  if (isNewScenario) {
    ui.theme.textContent = scenario.theme;
    ui.title.textContent = typography(scenario.title);
    ui.note.textContent = typography(`${scenario.note ?? ''} ${t('numerique.fictional')}`.trim());
    ui.visual.replaceChildren(scenarioVisual(scenario));
  }
  ui.count.textContent = t('numerique.dataCount', { index: step.scenarioIndex + 1, count: step.scenarioCount });
  ui.questionLabel.textContent = t('common.questionCount', { index: step.questionIndex + 1, count: step.questionCount });
  ui.questionText.textContent = typography(question.text);
  renderDifficulty(question.difficulty, ui.questionLevel);
  ui.questionLevel.hidden = false;
  ui.choices.replaceChildren(...question.options.map((option, index) => optionButton(question, option, index)));
  ui.feedback.replaceChildren();
  ui.nextWrapper.hidden = true;
  state.answered = false;
  state.shownAt = performance.now();
  if (state.reviewing) review.progress(state.index, state.steps.length);
  updateStats();
  return isNewScenario;
};

const markChoice = (button, status, label) => {
  button.dataset.state = status;
  button.append(createElement('span', 'choice__status', label));
};

const renderFeedback = (scenario, question, chosen) => {
  const isCorrect = chosen === question.answer;
  const box = createElement('div', 'feedback');
  box.dataset.result = isCorrect ? 'correct' : 'wrong';
  box.append(
    createElement('p', 'feedback__title', typography(t(isCorrect ? 'common.correctTitle' : 'common.wrongTitle'))),
    createElement('p', 'feedback__answer', typography(answerSentence(question, chosen))),
  );
  const hint = errorHint(question, chosen);
  if (hint) box.append(hint);
  box.append(...calculationDetails(scenario, question));
  ui.feedback.replaceChildren(box);
};

/* ----- Actions ----- */

const answer = (chosen) => {
  const step = currentStep();
  if (!step || state.answered) return;
  state.answered = true;
  const { scenario, question } = step;
  const correct = chosen === question.answer;
  state.results.push({ skill: question.skill, correct });
  progress.recordAnswer({
    module: MODULE,
    questionId: question.id,
    correct,
    durationMs: performance.now() - state.shownAt,
    source: state.reviewing ? 'revision' : 'entrainement',
  });
  review.refresh();

  ui.choices.querySelectorAll('.choice').forEach((button, index) => {
    button.disabled = true;
    if (index === question.answer) markChoice(button, 'correct', t('common.correctMark'));
    else if (index === chosen) markChoice(button, 'wrong', t('common.yourChoice'));
    else button.dataset.state = 'dimmed';
  });

  renderFeedback(scenario, question, chosen);
  updateStats();
  ui.nextLabel.textContent = nextButtonLabel();
  ui.nextWrapper.hidden = false;
  ui.next.focus();
};

const showSummary = () => {
  const { correct, total, bySkill } = summarize(state.results);
  const rate = total ? correct / total : 0;
  ui.summaryScore.textContent = `${correct} / ${total}`;

  const weakest = Object.entries(bySkill)
    .filter(([, { total: count }]) => count > 0)
    .map(([skill, stats]) => ({ label: SKILLS[skill].label, ...stats }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  const verdict = rate >= 0.8 ? t('numerique.verdict.excellent') : rate >= 0.6 ? t('numerique.verdict.good') : t('numerique.verdict.keepGoing');
  const focus = weakest && weakest.correct < weakest.total
    ? ` ${t('numerique.focus', { label: weakest.label.toLowerCase(), correct: weakest.correct, total: weakest.total })}`
    : '';
  ui.summaryMessage.textContent = typography(verdict + focus);

  ui.summaryDetails.replaceChildren(
    ...Object.entries(bySkill).map(([skill, stats]) => {
      const tile = createElement('div', 'summary-stat');
      tile.append(createElement('dt', 'summary-stat__label', SKILLS[skill].label), createElement('dd', 'summary-stat__value', `${stats.correct} / ${stats.total}`));
      return tile;
    }),
  );

  ui.exercise.hidden = true;
  ui.summary.hidden = false;
  if (state.reviewing) {
    state.reviewing = false;
    moveFocusTo(review.end({ correct, total }));
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
  const isNewScenario = showStep();
  moveFocusTo(isNewScenario ? ui.title : ui.questionLabel);
};

const startSeries = () => {
  Object.assign(state, { steps: buildSteps(state.scenarios), index: 0, answered: false, results: [], reviewing: false });
  review.clearOutcome();
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
};

/** Révision : uniquement les questions ratées, avec la correction habituelle. */
const startReview = (mode) => {
  const ids = progress.reviewList(MODULE).map((entry) => entry.questionId);
  const steps = buildReviewSteps(state.scenarios, ids);
  // Question retirée de la banque : elle sort de la liste.
  const known = new Set(steps.map((step) => step.question.id));
  ids.filter((id) => !known.has(id)).forEach((id) => progress.dropReview(MODULE, id));

  if (steps.length === 0) {
    startSeries();
    review.nothingToReview(mode);
    return;
  }
  Object.assign(state, { steps, index: 0, answered: false, results: [], reviewing: true });
  review.begin(steps.length, mode);
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

ui.choices.addEventListener('click', (event) => {
  const button = event.target.closest('.choice');
  if (button) answer(Number(button.dataset.index));
});

ui.next.addEventListener('click', goToNext);

ui.restart.addEventListener('click', () => {
  startSeries();
  moveFocusTo(ui.title);
});

// Raccourcis clavier : A à D (ou 1 à 4) pour répondre.
document.addEventListener('keydown', (event) => {
  if (state.answered || !currentStep() || event.altKey || event.ctrlKey || event.metaKey) return;
  const chosen = KEY_TO_OPTION[event.key.toLowerCase()];
  if (chosen === undefined) return;
  event.preventDefault();
  answer(chosen);
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
  console.error('Chargement de la banque de questions impossible :', error);
  ui.theme.textContent = t('common.error');
  ui.visual.replaceChildren(createElement('p', 'text-red-700', t('numerique.loadError')));
}

