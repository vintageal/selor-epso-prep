/*
 * Module « Raisonnement verbal » : interface d'entraînement.
 * Texte à gauche, affirmation à droite ; correction immédiate avec citation
 * exacte du texte (surlignée dans le texte et reprise dans l'explication).
 */
import {
  ANSWERS,
  METHOD_TIPS,
  answerLabel,
  buildSteps,
  frenchTypography,
  highlightSegments,
  summarize,
} from './quiz.js';

const BANK_URL = new URL('../../../data/verbal.json', import.meta.url);
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
};

const state = { passages: [], steps: [], index: 0, answered: false, results: [] };
const currentStep = () => state.steps[state.index];

/** Crée un élément ; le texte passe par textContent (jamais interprété comme du HTML). */
const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/* ----- Rendu ----- */

const renderGuidelines = () => {
  ui.guidelines.replaceChildren(
    ...Object.values(METHOD_TIPS).map((tip) => createElement('li', '', frenchTypography(tip))),
    createElement('li', '', frenchTypography('Lisez chaque phrase jusqu\'au bout : les nuances (« au moins », « sauf », « en principe », conditionnel…) font souvent la différence.')),
  );
};

const renderChoices = () => {
  ui.choices.replaceChildren(
    ...ANSWERS.map(({ id, label, icon, keys }) => {
      const button = createElement('button', 'choice');
      button.type = 'button';
      button.dataset.answer = id;
      const iconElement = createElement('span', 'choice__icon', icon);
      const keyElement = createElement('kbd', 'kbd choice__key', keys[1].toUpperCase());
      iconElement.setAttribute('aria-hidden', 'true');
      keyElement.setAttribute('aria-hidden', 'true');
      button.append(iconElement, createElement('span', 'choice__label', label), keyElement);
      return button;
    }),
  );
};

/** Affiche les paragraphes du texte, en surlignant les citations fournies. */
const renderPassageBody = (passage, quotes = []) => {
  ui.passageBody.replaceChildren(
    ...passage.paragraphs.map((paragraph) => {
      const element = createElement('p');
      for (const { text, highlighted } of highlightSegments(paragraph, quotes)) {
        element.append(highlighted ? createElement('mark', 'evidence-mark', frenchTypography(text)) : frenchTypography(text));
      }
      return element;
    }),
  );
};

const updateStats = () => {
  const step = currentStep();
  const { correct, total } = summarize(state.results);
  if (step) ui.statPassage.textContent = `${step.passageIndex + 1} / ${step.passageCount}`;
  ui.statScore.textContent = `${correct} / ${total}`;
};

const nextButtonLabel = () => {
  const upcoming = state.steps[state.index + 1];
  if (!upcoming) return 'Voir le bilan';
  return upcoming.passage === currentStep().passage ? 'Affirmation suivante' : 'Texte suivant';
};

const showStep = () => {
  const step = currentStep();
  const previous = state.steps[state.index - 1];
  const isNewPassage = !previous || previous.passage !== step.passage;

  if (isNewPassage) {
    ui.passageTheme.textContent = step.passage.theme;
    ui.passageTitle.textContent = frenchTypography(step.passage.title);
  }
  ui.passageCount.textContent = `Texte ${step.passageIndex + 1} sur ${step.passageCount}`;
  renderPassageBody(step.passage);

  ui.statementLabel.textContent = `Affirmation ${step.statementIndex + 1} sur ${step.statementCount}`;
  ui.statementText.textContent = frenchTypography(step.statement.text);

  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = false;
    delete button.dataset.state;
    button.querySelector('.choice__status')?.remove();
  });
  ui.feedback.replaceChildren();
  ui.nextWrapper.hidden = true;
  state.answered = false;
  updateStats();
  return isNewPassage;
};

const renderFeedback = (statement, chosen) => {
  const isCorrect = chosen === statement.answer;
  const box = createElement('div', 'feedback');
  box.dataset.result = isCorrect ? 'correct' : 'wrong';

  box.append(
    createElement('p', 'feedback__title', isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'),
    createElement(
      'p',
      'feedback__answer',
      isCorrect
        ? `La réponse est bien « ${answerLabel(statement.answer)} ».`
        : `Vous avez répondu « ${answerLabel(chosen)} » ; la bonne réponse est « ${answerLabel(statement.answer)} ».`,
    ),
    createElement('p', 'feedback__label', statement.quotes.length > 1 ? 'Preuves dans le texte (surlignées)' : 'Preuve dans le texte (surlignée)'),
    ...statement.quotes.map((quote) => {
      const blockquote = createElement('blockquote', 'evidence');
      blockquote.append(createElement('p', '', frenchTypography(`« ${quote} »`)));
      return blockquote;
    }),
    createElement('p', 'feedback__label', 'Explication'),
    createElement('p', 'feedback__text', frenchTypography(statement.explanation)),
  );

  const tip = createElement('p', 'method-tip');
  tip.append(createElement('strong', '', 'Rappel de méthode : '), frenchTypography(METHOD_TIPS[statement.answer]));
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
  state.results.push({ expected: statement.answer, correct: chosen === statement.answer });

  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = true;
    const id = button.dataset.answer;
    if (id === statement.answer) markChoice(button, 'correct', 'Bonne réponse');
    else if (id === chosen) markChoice(button, 'wrong', 'Votre choix');
    else button.dataset.state = 'dimmed';
  });

  renderPassageBody(step.passage, statement.quotes);
  renderFeedback(statement, chosen);
  updateStats();
  ui.nextLabel.textContent = nextButtonLabel();
  ui.nextWrapper.hidden = false;
  ui.next.focus();
};

/** Déplace le focus (clavier, lecteur d'écran) et, si nécessaire, le défilement. */
const moveFocusTo = (element) => {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'nearest' });
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
    rate >= 0.8 ? 'Excellent travail : vous maîtrisez la logique de ces épreuves.'
      : rate >= 0.6 ? 'Bon résultat : relisez les explications des questions manquées pour progresser encore.'
        : 'Continuez à vous entraîner : lisez attentivement chaque explication, les pièges reviennent souvent.';
  const focus = weakest && weakest.correct < weakest.total
    ? ` Point à travailler : les affirmations « ${weakest.label} » (${weakest.correct} sur ${weakest.total} réussies).`
    : '';
  ui.summaryMessage.textContent = frenchTypography(verdict + focus);

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
  moveFocusTo(ui.summaryTitle);
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
  Object.assign(state, { steps: buildSteps(state.passages), index: 0, answered: false, results: [] });
  ui.summary.hidden = true;
  ui.exercise.hidden = false;
  showStep();
};

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

// Raccourcis clavier : V / F / ? (ou 1 à 3) pour répondre.
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
  startSeries();
} catch (error) {
  console.error('Chargement de la banque de questions impossible :', error);
  ui.passageTheme.textContent = 'Erreur';
  ui.passageBody.replaceChildren(
    createElement('p', 'text-red-700', 'Impossible de charger les textes. Vérifiez que la page est servie par un serveur web (voir le README), puis rechargez-la.'),
  );
  ui.choices.querySelectorAll('.choice').forEach((button) => {
    button.disabled = true;
  });
}
