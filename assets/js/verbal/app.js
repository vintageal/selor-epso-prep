/*
 * Module « Raisonnement verbal » : interface d'entraînement.
 * Texte à gauche, affirmation à droite ; correction immédiate avec citation
 * exacte du texte (surlignée dans le texte et reprise dans l'explication).
 */
import {
  ANSWERS,
  METHOD_TIPS,
  answerLabel,
  buildReviewSteps,
  buildSteps,
  summarize,
} from './quiz.js';
import { renderDifficulty } from '../lib/difficulty.js';
import { createElement, moveFocusTo } from '../lib/dom.js';
import { bankUrl, t, typography } from '../lib/i18n.js';
import { createReviewControls, requestedReview } from '../progression/review.js';
import { createStore } from '../progression/store.js';
import { choiceButton, evidenceQuotes, passageParagraphs } from './view.js';

const MODULE = 'verbal';
const BANK_URL = bankUrl('verbal');
const KEY_TO_ANSWER = Object.fromEntries(ANSWERS.flatMap(({ id, keys }) => keys.map((key) => [key, id])));

const $ = (selector) => document.querySelector(selector);
const ui = {
  statPassage: $('[data-stat-passage]'),
  statScore: $('[data-stat-score]'),
  guidelines: $('[data-guidelines]'),
  exercise: $('[data-exercise]'),
  passageTheme: $('[data-passage-theme]'),
  passageCount: $('[data-passage-count]'),
  passageTitle: $('[data-passage-title]'),
  passageBody: $('[data-passage-body]'),
  statementLabel: $('[data-statement-label]'),
  statementLevel: $('[data-statement-level]'),
  statementText: $('[data-statement-text]'),
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
const state = { passages: [], steps: [], index: 0, answered: false, results: [], reviewing: false, shownAt: 0 };
const currentStep = () => state.steps[state.index];

/* ----- Rendu ----- */

const renderGuidelines = () => {
  ui.guidelines.replaceChildren(
    ...Object.values(METHOD_TIPS).map((tip) => createElement('li', '', typography(tip))),
    createElement('li', '', typography(t('verbal.guidelineNuances'))),
  );
};

const renderChoices = () => {
  ui.choices.replaceChildren(...ANSWERS.map(choiceButton));
};

/** Affiche les paragraphes du texte, en surlignant les citations fournies. */
const renderPassageBody = (passage, quotes = []) => {
  ui.passageBody.replaceChildren(...passageParagraphs(passage, quotes));
};

const updateStats = () => {
  const step = currentStep();
  const { correct, total } = summarize(state.results);
  if (step) ui.statPassage.textContent = `${step.passageIndex + 1} / ${step.passageCount}`;
  ui.statScore.textContent = `${correct} / ${total}`;
};

const nextButtonLabel = () => {
  const upcoming = state.steps[state.index + 1];
  if (!upcoming) return t('common.seeSummary');
  return upcoming.passage === currentStep().passage ? t('verbal.nextStatement') : t('verbal.nextText');
};

const showStep = () => {
  const step = currentStep();
  const previous = state.steps[state.index - 1];
  const isNewPassage = !previous || previous.passage !== step.passage;

  if (isNewPassage) {
    ui.passageTheme.textContent = step.passage.theme;
    ui.passageTitle.textContent = typography(step.passage.title);
  }
  ui.passageCount.textContent = t('verbal.textCount', { index: step.passageIndex + 1, count: step.passageCount });
  renderPassageBody(step.passage);

  ui.statementLabel.textContent = t('verbal.statementCount', { index: step.statementIndex + 1, count: step.statementCount });
  ui.statementText.textContent = typography(step.statement.text);
  renderDifficulty(step.statement.difficulty, ui.statementLevel);
  ui.statementLevel.hidden = false;

  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = false;
    delete button.dataset.state;
    button.querySelector('.choice__status')?.remove();
  });
  ui.feedback.replaceChildren();
  ui.nextWrapper.hidden = true;
  state.answered = false;
  state.shownAt = performance.now();
  if (state.reviewing) review.progress(state.index, state.steps.length);
  updateStats();
  return isNewPassage;
};

const renderFeedback = (statement, chosen) => {
  const isCorrect = chosen === statement.answer;
  const box = createElement('div', 'feedback');
  box.dataset.result = isCorrect ? 'correct' : 'wrong';

  box.append(
    createElement('p', 'feedback__title', typography(isCorrect ? t('common.correctTitle') : t('common.wrongTitle'))),
    createElement(
      'p',
      'feedback__answer',
      typography(
        isCorrect
          ? t('verbal.correctAnswer', { answer: answerLabel(statement.answer) })
          : t('verbal.wrongAnswer', { chosen: answerLabel(chosen), answer: answerLabel(statement.answer) }),
      ),
    ),
    createElement('p', 'feedback__label', statement.quotes.length > 1 ? t('verbal.evidenceMany') : t('verbal.evidenceOne')),
    ...evidenceQuotes(statement.quotes),
    createElement('p', 'feedback__label', t('common.explanation')),
    createElement('p', 'feedback__text', typography(statement.explanation)),
  );

  const tip = createElement('p', 'method-tip');
  tip.append(createElement('strong', '', typography(t('common.methodReminder'))), typography(METHOD_TIPS[statement.answer]));
  box.append(tip);

  ui.feedback.replaceChildren(box);
};

const markChoice = (button, status, label) => {
  button.dataset.state = status;
  button.append(createElement('span', 'choice__status', label));
};

/* ----- Actions ----- */

const answer = (chosen) => {
  const step = currentStep();
  if (!step || state.answered) return;
  state.answered = true;
  const { statement } = step;
  const correct = chosen === statement.answer;
  state.results.push({ expected: statement.answer, correct });
  progress.recordAnswer({
    module: MODULE,
    questionId: statement.id,
    correct,
    durationMs: performance.now() - state.shownAt,
    source: state.reviewing ? 'revision' : 'entrainement',
  });
  review.refresh();

  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = true;
    const id = button.dataset.answer;
    if (id === statement.answer) markChoice(button, 'correct', t('common.correctMark'));
    else if (id === chosen) markChoice(button, 'wrong', t('common.yourChoice'));
    else button.dataset.state = 'dimmed';
  });

  renderPassageBody(step.passage, statement.quotes);
  renderFeedback(statement, chosen);
  updateStats();
  ui.nextLabel.textContent = nextButtonLabel();
  ui.nextWrapper.hidden = false;
  ui.next.focus();
};

const showSummary = () => {
  const { correct, total, byAnswer } = summarize(state.results);
  const rate = total ? correct / total : 0;

  ui.summaryScore.textContent = `${correct} / ${total}`;
  const weakest = ANSWERS
    .map(({ id, label }) => ({ label, ...byAnswer[id] }))
    .filter(({ total: count }) => count > 0)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
  const verdict =
    rate >= 0.8 ? t('verbal.verdict.excellent') : rate >= 0.6 ? t('verbal.verdict.good') : t('verbal.verdict.keepGoing');
  const focus = weakest && weakest.correct < weakest.total ? ` ${t('verbal.focus', { label: weakest.label, correct: weakest.correct, total: weakest.total })}` : '';
  ui.summaryMessage.textContent = typography(verdict + focus);

  ui.summaryDetails.replaceChildren(
    ...ANSWERS.map(({ id, label }) => {
      const item = createElement('div', 'summary-stat');
      item.append(
        createElement('dt', 'summary-stat__label', label),
        createElement('dd', 'summary-stat__value', `${byAnswer[id].correct} / ${byAnswer[id].total}`),
      );
      return item;
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
  const isNewPassage = showStep();
  moveFocusTo(isNewPassage ? ui.passageTitle : ui.statementLabel);
};

const startSeries = () => {
  Object.assign(state, { steps: buildSteps(state.passages), index: 0, answered: false, results: [], reviewing: false });
  review.clearOutcome();
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
};

/** Révision : uniquement les affirmations ratées, avec la correction habituelle. */
const startReview = (mode) => {
  const ids = progress.reviewList(MODULE).map((entry) => entry.questionId);
  const steps = buildReviewSteps(state.passages, ids);
  // Affirmation retirée de la banque : elle sort de la liste.
  const known = new Set(steps.map((step) => step.statement.id));
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
  moveFocusTo(ui.passageTitle);
};

const quitReview = () => {
  review.end();
  startSeries();
  moveFocusTo(ui.passageTitle);
};

const review = createReviewControls({ container: ui.review, store: progress, module: MODULE, onStart: startReview, onQuit: quitReview });

/* ----- Événements ----- */

ui.choices.addEventListener('click', (event) => {
  const button = event.target.closest('.choice');
  if (button) answer(button.dataset.answer);
});

ui.next.addEventListener('click', goToNext);

ui.restart.addEventListener('click', () => {
  startSeries();
  moveFocusTo(ui.passageTitle);
});

// Raccourcis clavier : V / F / ? en français, W / N / ? en néerlandais (ou 1 à 3) pour répondre.
document.addEventListener('keydown', (event) => {
  if (state.answered || !currentStep() || event.altKey || event.ctrlKey || event.metaKey) return;
  const chosen = KEY_TO_ANSWER[event.key.toLowerCase()];
  if (!chosen) return;
  event.preventDefault();
  answer(chosen);
});

/* ----- Démarrage ----- */

renderGuidelines();
renderChoices();

try {
  const response = await fetch(BANK_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  state.passages = (await response.json()).passages;
  const requested = requestedReview();
  if (requested) startReview(requested);
  else startSeries();
} catch (error) {
  console.error('Chargement de la banque de questions impossible :', error);
  ui.passageTheme.textContent = t('common.error');
  ui.passageBody.replaceChildren(
    createElement('p', 'text-red-700', t('verbal.loadError')),
  );
  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = true;
  });
}
