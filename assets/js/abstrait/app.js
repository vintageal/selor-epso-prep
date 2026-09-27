/*
 * Module « Raisonnement abstrait » : interface d'entraînement.
 * Affiche une série, les 4 propositions, corrige immédiatement et explique la règle.
 */
import { createElement, moveFocusTo } from '../lib/dom.js';
import { OPTION_LETTERS, createQuestionStream } from './generator.js';
import { optionButton, revealedFigureCell, sequenceCells } from './view.js';

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
};

const nextQuestion = createQuestionStream();
const state = { question: null, number: 0, answered: 0, correct: 0, locked: false };

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
  const question = nextQuestion();
  Object.assign(state, { question, number: state.number + 1, locked: false });

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
  if (chosenIndex === question.correctIndex) state.correct += 1;

  ui.options.querySelectorAll('.option').forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctIndex) markOption(button, 'correct', 'Bonne réponse');
    else if (index === chosenIndex) markOption(button, 'wrong', 'Votre choix');
    else button.dataset.state = 'dimmed';
  });

  revealAnswer(question);
  renderFeedback(question, chosenIndex);
  updateStats();
  ui.nextWrapper.hidden = false;
  ui.next.focus();
};

ui.options.addEventListener('click', (event) => {
  const button = event.target.closest('.option');
  if (button) answer(Number(button.dataset.index));
});

ui.next.addEventListener('click', () => {
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

showQuestion();
