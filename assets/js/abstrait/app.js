/*
 * Module « Raisonnement abstrait » : interface d'entraînement.
 * Affiche une série, les 4 propositions, corrige immédiatement et explique la règle.
 */
import { createElement, moveFocusTo } from '../lib/dom.js';
import { createReviewControls, requestedReview } from '../progression/review.js';
import { createStore } from '../progression/store.js';
import { OPTION_LETTERS, createQuestionStream, questionFromId } from './generator.js';
import { optionButton, revealedFigureCell, sequenceCells } from './view.js';

const MODULE = 'abstrait';
const DIFFICULTY_LABELS = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
const KEY_TO_OPTION = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };

const ui = {
  questionNumber: document.querySelector('[data-question-number]'),
  score: document.querySelector('[data-score]'),
  title: document.getElementById('question-titre'),
  difficulty: document.querySelector('[data-difficulty]'),
  sequence: document.querySelector('[data-sequence]'),
  options: document.querySelector('[data-options]'),
  feedback: document.querySelector('[data-feedback]'),
  nextWrapper: document.querySelector('[data-next-wrapper]'),
  next: document.querySelector('[data-next]'),
  nextLabel: document.querySelector('[data-next-label]'),
  review: document.querySelector('[data-review]'),
};

const nextQuestion = createQuestionStream();
const progress = createStore();
const state = { question: null, number: 0, answered: 0, correct: 0, locked: false, shownAt: 0, reviewQueue: null, reviewIndex: 0, reviewCorrect: 0 };
const reviewing = () => state.reviewQueue !== null;

const renderSequence = (question) => {
  ui.sequence.replaceChildren(...sequenceCells(question));
};

const renderOptions = ({ options }) => {
  ui.options.replaceChildren(...options.map(optionButton));
};

const updateStats = () => {
  ui.questionNumber.textContent = String(state.number);
  ui.score.textContent = `${state.correct} / ${state.answered}`;
};

const showQuestion = () => {
  const question = reviewing() ? state.reviewQueue[state.reviewIndex] : nextQuestion();
  Object.assign(state, { question, number: state.number + 1, locked: false, shownAt: performance.now() });
  if (reviewing()) review.progress(state.reviewIndex, state.reviewQueue.length);

  ui.difficulty.textContent = DIFFICULTY_LABELS[question.difficulty];
  ui.difficulty.dataset.level = question.difficulty;
  renderSequence(question);
  renderOptions(question);
  ui.feedback.replaceChildren();
  ui.nextWrapper.hidden = true;
  updateStats();
};

const markOption = (button, status, label) => {
  button.dataset.state = status;
  button.append(createElement('span', 'option__status', label));
};

/** Remplace le « ? » de la série par la bonne réponse. */
const revealAnswer = ({ sequence, answer }) => {
  ui.sequence.querySelector('[data-missing]').replaceWith(revealedFigureCell(answer, sequence.length + 1));
};

const renderFeedback = ({ correctIndex, ruleTitle, explanation }, chosenIndex) => {
  const isCorrect = chosenIndex === correctIndex;
  const correctLetter = OPTION_LETTERS[correctIndex];
  const box = createElement('div', 'feedback');
  box.dataset.result = isCorrect ? 'correct' : 'wrong';
  box.append(
    createElement('p', 'feedback__title', isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'),
    createElement(
      'p',
      'feedback__answer',
      isCorrect
        ? `La proposition ${correctLetter} complète bien la série.`
        : `Vous avez choisi ${OPTION_LETTERS[chosenIndex]} ; la bonne réponse était ${correctLetter}.`,
    ),
    createElement('p', 'feedback__rule', `Règle : ${ruleTitle}`),
    createElement('p', 'feedback__text', explanation),
  );
  ui.feedback.replaceChildren(box);
};

const answer = (chosenIndex) => {
  const { question } = state;
  if (!question || state.locked) return;
  state.locked = true;
  state.answered += 1;
  const correct = chosenIndex === question.correctIndex;
  if (correct) state.correct += 1;
  if (correct && reviewing()) state.reviewCorrect += 1;
  progress.recordAnswer({
    module: MODULE,
    questionId: question.id,
    correct,
    durationMs: performance.now() - state.shownAt,
    source: reviewing() ? 'revision' : 'entrainement',
  });
  review.refresh();

  ui.options.querySelectorAll('.option').forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctIndex) markOption(button, 'correct', 'Bonne réponse');
    else if (index === chosenIndex) markOption(button, 'wrong', 'Votre choix');
    else button.dataset.state = 'dimmed';
  });

  revealAnswer(question);
  renderFeedback(question, chosenIndex);
  updateStats();
  const lastReviewed = reviewing() && state.reviewIndex === state.reviewQueue.length - 1;
  ui.nextLabel.textContent = lastReviewed ? 'Terminer la révision' : 'Question suivante';
  ui.nextWrapper.hidden = false;
  ui.next.focus();
};

/** Révision : les séries ratées, régénérées à l'identique à partir de leur identifiant. */
const startReview = (mode) => {
  const ids = progress.reviewList(MODULE).map((entry) => entry.questionId);
  const queue = [];
  for (const id of ids) {
    const question = questionFromId(id);
    if (question) queue.push(question);
    else progress.dropReview(MODULE, id); // identifiant devenu invalide : il sort de la liste
  }
  if (queue.length === 0) {
    review.nothingToReview(mode);
    return false;
  }
  Object.assign(state, { reviewQueue: queue, reviewIndex: 0, reviewCorrect: 0 });
  review.begin(queue.length, mode);
  showQuestion();
  moveFocusTo(ui.title);
  return true;
};

const stopReview = () => {
  const total = state.reviewQueue.length;
  state.reviewQueue = null;
  return { correct: state.reviewCorrect, total };
};

const quitReview = () => {
  stopReview();
  review.end();
  showQuestion();
  moveFocusTo(ui.title);
};

const review = createReviewControls({ container: ui.review, store: progress, module: MODULE, onStart: startReview, onQuit: quitReview });

ui.options.addEventListener('click', (event) => {
  const button = event.target.closest('.option');
  if (button) answer(Number(button.dataset.index));
});

ui.next.addEventListener('click', () => {
  if (reviewing() && state.reviewIndex === state.reviewQueue.length - 1) {
    // Fin de la révision : bilan, puis reprise de l'entraînement normal.
    const outcome = review.end(stopReview());
    showQuestion();
    moveFocusTo(outcome);
    return;
  }
  if (reviewing()) state.reviewIndex += 1;
  showQuestion();
  // Ramène l'attention (clavier, lecteur d'écran, défilement mobile) sur la nouvelle série.
  moveFocusTo(ui.title);
});

// Raccourcis clavier : 1-4 ou A-D pour répondre.
document.addEventListener('keydown', (event) => {
  if (state.locked || event.altKey || event.ctrlKey || event.metaKey) return;
  const index = KEY_TO_OPTION[event.key.toLowerCase()];
  if (index === undefined) return;
  event.preventDefault();
  answer(index);
});

const requested = requestedReview();
if (!requested || !startReview(requested)) showQuestion();
