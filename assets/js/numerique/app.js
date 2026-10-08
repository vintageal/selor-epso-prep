/*
 * Module « Raisonnement numérique » : interface d'entraînement.
 * Données (tableau ou graphique) à gauche, question à droite ; correction immédiate
 * avec les données utilisées, la formule et le calcul étape par étape.
 */
import { createElement, moveFocusTo } from '../lib/dom.js';
import { createReviewControls, requestedReview } from '../progression/review.js';
import { createStore } from '../progression/store.js';
import { frenchTypography } from '../verbal/quiz.js';
import { SKILLS, buildReviewSteps, buildSteps, summarize } from './quiz.js';
import { answerSentence, calculationDetails, errorHint, optionButton, scenarioVisual } from './view.js';

const MODULE = 'numerique';
const BANK_URL = new URL('../../../data/numerique.json', import.meta.url);
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
      item.append(createElement('strong', 'font-semibold', `${label} : `), frenchTypography(tip));
      return item;
    }),
    createElement('li', '', frenchTypography('Une calculatrice peut vous aider : gardez-la à portée de main, comme le jour de l\'épreuve.')),
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
  if (!upcoming) return 'Voir le bilan';
  return upcoming.scenario === currentStep().scenario ? 'Question suivante' : 'Données suivantes';
};

const showStep = () => {
  const step = currentStep();
  const previous = state.steps[state.index - 1];
  const isNewScenario = !previous || previous.scenario !== step.scenario;
  const { scenario, question } = step;

  if (isNewScenario) {
    ui.theme.textContent = scenario.theme;
    ui.title.textContent = frenchTypography(scenario.title);
    ui.note.textContent = frenchTypography(`${scenario.note ?? ''} Données fictives.`.trim());
    ui.visual.replaceChildren(scenarioVisual(scenario));
  }
  ui.count.textContent = `Données ${step.scenarioIndex + 1} sur ${step.scenarioCount}`;
  ui.questionLabel.textContent = `Question ${step.questionIndex + 1} sur ${step.questionCount}`;
  ui.questionText.textContent = frenchTypography(question.text);
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
    createElement('p', 'feedback__title', isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'),
    createElement('p', 'feedback__answer', frenchTypography(answerSentence(question, chosen))),
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
    if (index === question.answer) markChoice(button, 'correct', 'Bonne réponse');
    else if (index === chosen) markChoice(button, 'wrong', 'Votre choix');
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
  const verdict =
    rate >= 0.8
      ? 'Excellent travail : vos calculs sont solides et rigoureux.'
      : rate >= 0.6
        ? 'Bon résultat : relisez le détail des calculs manqués pour repérer vos erreurs de méthode.'
        : 'Continuez à vous entraîner : le détail de chaque calcul vous montre où se cache le piège.';
  const focus = weakest && weakest.correct < weakest.total
    ? ` Point à travailler : ${weakest.label.toLowerCase()} (${weakest.correct} sur ${weakest.total} réussies).`
    : '';
  ui.summaryMessage.textContent = frenchTypography(verdict + focus);

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
  ui.theme.textContent = 'Erreur';
  ui.visual.replaceChildren(
    createElement('p', 'text-red-700', 'Impossible de charger les données. Vérifiez que la page est servie par un serveur web (voir le README), puis rechargez-la.'),
  );
}

