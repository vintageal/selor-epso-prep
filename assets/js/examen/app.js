/*
 * Mode examen : interface de l'épreuve chronométrée.
 * Aucune correction pendant l'épreuve : le bilan et la correction détaillée
 * s'affichent quand le candidat termine l'examen ou quand le temps est écoulé.
 */
import { OPTION_LETTERS } from '../abstrait/generator.js';
import { optionButton, sequenceCells } from '../abstrait/view.js';
import { createElement, hiddenFromScreenReaders, moveFocusTo } from '../lib/dom.js';
import { ANSWERS, METHOD_TIPS, answerLabel, frenchTypography } from '../verbal/quiz.js';
import { choiceButton, evidenceQuotes, passageParagraphs } from '../verbal/view.js';
import {
  answerSentence,
  calculationDetails,
  dataTable,
  errorHint,
  optionButton as numericOptionButton,
  scenarioVisual,
} from '../numerique/view.js';
import { MAX_POINTS } from '../jugement/quiz.js';
import { actionPicker, correctionList, debriefContent, scoreLines, situationContent } from '../jugement/view.js';
import { createStore } from '../progression/store.js';
import { EXAM_CONFIG, ExamSession, SECTIONS, createExam, formatClock, gradeExam, isAnswered, itemQuestionId } from './exam.js';

/** Banques chargées au démarrage : nom dans l'examen → fichier et clé du tableau dans le JSON. */
const BANKS = {
  passages: { url: new URL('../../../data/verbal.json', import.meta.url), key: 'passages' },
  scenarios: { url: new URL('../../../data/numerique.json', import.meta.url), key: 'scenarios' },
  situations: { url: new URL('../../../data/jugement.json', import.meta.url), key: 'scenarios' },
};
const TICK_MS = 250;
const WARNING_MS = 5 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;
const ANNOUNCEMENTS = [
  { at: 5 * 60 * 1000, text: 'Attention : il reste 5 minutes.' },
  { at: 60 * 1000, text: 'Attention : il reste 1 minute.' },
];
const OPTION_KEYS = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
const VERBAL_KEYS = Object.fromEntries(ANSWERS.flatMap(({ id, keys }) => keys.map((key) => [key, id])));
const REVIEW_STATUS = {
  correct: { icon: '✓', label: 'Bonne réponse' },
  wrong: { icon: '✕', label: 'Mauvaise réponse' },
  partial: { icon: '½', label: 'Réponse partielle' },
  blank: { icon: '–', label: 'Sans réponse' },
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  intro: $('[data-intro]'),
  introTitle: $('#intro-titre'),
  introCount: $('[data-intro-count]'),
  introDuration: $('[data-intro-duration]'),
  introSections: $('[data-intro-sections]'),
  introMix: $('[data-intro-mix]'),
  start: $('[data-start]'),
  startLabel: $('[data-start-label]'),
  loadError: $('[data-load-error]'),
  exam: $('[data-exam]'),
  examBar: $('[data-exam-bar]'),
  answeredCount: $('[data-answered-count]'),
  totalCount: $('[data-total-count]'),
  timer: $('[data-timer]'),
  timerValue: $('[data-timer-value]'),
  announcer: $('[data-timer-announcer]'),
  finish: $('[data-finish]'),
  palette: $('[data-palette]'),
  questionTitle: $('[data-question-title]'),
  sectionChip: $('[data-section-chip]'),
  flag: $('[data-flag]'),
  flagLabel: $('[data-flag-label]'),
  body: $('[data-question-body]'),
  clear: $('[data-clear]'),
  prev: $('[data-prev]'),
  next: $('[data-next]'),
  confirm: $('[data-confirm]'),
  confirmText: $('[data-confirm-text]'),
  confirmCancel: $('[data-confirm-cancel]'),
  confirmOk: $('[data-confirm-ok]'),
  results: $('[data-results]'),
  resultsTitle: $('#bilan-titre'),
  endBanner: $('[data-end-banner]'),
  resultScore: $('[data-result-score]'),
  resultPercent: $('[data-result-percent]'),
  resultMessage: $('[data-result-message]'),
  resultStats: $('[data-result-stats]'),
  reviewList: $('[data-review-list]'),
  restart: $('[data-restart]'),
  progressNote: $('[data-progress-note]'),
};

const progress = createStore();
const state = { banks: null, session: null, index: 0, running: false, timerId: null, announced: new Set() };
const currentItem = () => state.session.items[state.index];
const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`;
const pointsLabel = (points) => `${points} point${points > 1 ? 's' : ''} sur ${MAX_POINTS}`;
/** Score éventuellement fractionnaire (jugement situationnel), à la française : 31,75. */
const formatScore = (value) => value.toLocaleString('fr-BE', { maximumFractionDigits: 2 });

const warnBeforeLeaving = (event) => {
  event.preventDefault();
  event.returnValue = '';
};

/* ----- Épreuve : affichage d'une question (sans correction) ----- */

const labelledGroup = (className, labelId) => {
  const group = createElement('div', className);
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', labelId);
  return group;
};

const renderAbstractQuestion = ({ question }, answer) => {
  const sequence = createElement('ol', 'figure-row');
  sequence.setAttribute('aria-label', 'Série de figures');
  sequence.append(...sequenceCells(question));

  const label = createElement('p', 'exam-label', 'Propositions');
  label.id = 'examen-propositions';
  const options = labelledGroup('option-row', label.id);
  options.append(
    ...question.options.map((figure, index) => {
      const button = optionButton(figure, index);
      button.setAttribute('aria-pressed', String(answer === index));
      return button;
    }),
  );

  return [createElement('p', 'exam-prompt', frenchTypography('Quelle figure complète la série ?')), sequence, label, options];
};

const renderVerbalQuestion = ({ passage, statement }, answer) => {
  const article = createElement('article', 'exam-passage');
  const body = createElement('div', 'passage');
  body.append(...passageParagraphs(passage));
  article.append(
    createElement('span', 'exam-passage__theme', passage.theme),
    createElement('h3', 'exam-passage__title', frenchTypography(passage.title)),
    body,
  );

  const label = createElement('p', 'exam-prompt', 'Selon le texte, cette affirmation est…');
  label.id = 'examen-choix';
  const choices = labelledGroup('choice-list', label.id);
  choices.append(
    ...ANSWERS.map((option) => {
      const button = choiceButton(option);
      button.setAttribute('aria-pressed', String(answer === option.id));
      return button;
    }),
  );

  const side = createElement('div', 'exam-statement');
  side.append(
    createElement('p', 'exam-label', 'Affirmation'),
    createElement('p', 'statement-box', frenchTypography(statement.text)),
    label,
    choices,
  );

  const layout = createElement('div', 'exam-split');
  layout.append(article, side);
  return [layout];
};

const renderNumericQuestion = ({ scenario, question }, answer) => {
  const article = createElement('article', 'exam-passage');
  article.append(
    createElement('span', 'exam-passage__theme', scenario.theme),
    createElement('h3', 'exam-passage__title', frenchTypography(scenario.title)),
    createElement('p', 'exam-passage__note', frenchTypography(`${scenario.note ?? ''} Données fictives.`.trim())),
    scenarioVisual(scenario),
  );

  const label = createElement('p', 'exam-prompt', 'Votre réponse');
  label.id = 'examen-choix';
  const choices = labelledGroup('choice-list', label.id);
  choices.append(
    ...question.options.map((option, index) => {
      const button = numericOptionButton(question, option, index);
      button.setAttribute('aria-pressed', String(answer === index));
      return button;
    }),
  );

  const side = createElement('div', 'exam-statement');
  side.append(createElement('p', 'exam-label', 'Question'), createElement('p', 'statement-box', frenchTypography(question.text)), label, choices);

  const layout = createElement('div', 'exam-split');
  layout.append(article, side);
  return [layout];
};

const renderJudgementQuestion = ({ id, scenario, order }, answer) => {
  const content = situationContent(scenario);
  const prompt = content.pop();
  const article = createElement('article', 'exam-passage');
  article.append(
    createElement('span', 'exam-passage__theme', scenario.theme),
    createElement('h3', 'exam-passage__title', frenchTypography(scenario.title)),
    ...content,
  );

  // Les choix sont enregistrés à chaque clic ; un seul des deux choix est une réponse incomplète.
  const picker = actionPicker(scenario, order, {
    name: `examen-${id}`,
    picks: answer ?? {},
    onChange: (picks) => selectAnswer(Number.isInteger(picks.best) || Number.isInteger(picks.worst) ? picks : null),
  });
  return [article, prompt, picker];
};

const QUESTION_RENDERERS = {
  abstrait: renderAbstractQuestion,
  verbal: renderVerbalQuestion,
  numerique: renderNumericQuestion,
  jugement: renderJudgementQuestion,
};

/** Valeur d'un bouton de réponse : identifiant (verbal) ou index de la proposition (abstrait, numérique). */
const buttonValue = (button) => button.dataset.answer ?? Number(button.dataset.index);

const renderPalette = () => {
  const { session } = state;
  ui.palette.replaceChildren(
    ...session.items.map((item, index) => {
      const answered = isAnswered(item, session.answers[index]);
      const started = session.answers[index] !== null;
      const flagged = session.flags[index];
      const button = createElement('button', 'palette-item', String(index + 1));
      button.type = 'button';
      button.dataset.index = String(index);
      button.dataset.state = answered ? 'answered' : started ? 'partial' : 'blank';
      if (flagged) button.dataset.flagged = '';
      if (index === state.index) button.setAttribute('aria-current', 'step');
      const status = answered ? 'répondue' : started ? 'réponse incomplète' : 'sans réponse';
      button.setAttribute('aria-label', `Question ${index + 1}, ${SECTIONS[item.type].toLowerCase()}, ${status}${flagged ? ', à revoir' : ''}`);
      const entry = createElement('li');
      entry.append(button);
      return entry;
    }),
  );
};

const updateQuestionControls = () => {
  const { session, index } = state;
  const flagged = session.flags[index];
  ui.flag.setAttribute('aria-pressed', String(flagged));
  ui.flagLabel.textContent = flagged ? 'Marquée à revoir' : 'Marquer à revoir';
  ui.clear.hidden = session.answers[index] === null;
  ui.answeredCount.textContent = String(session.answeredCount);
  renderPalette();
};

const showQuestion = (index, { focus = true } = {}) => {
  const { session } = state;
  state.index = Math.max(0, Math.min(index, session.items.length - 1));
  const item = currentItem();
  const answer = session.answers[state.index];

  ui.questionTitle.textContent = `Question ${state.index + 1} sur ${session.items.length}`;
  ui.sectionChip.textContent = SECTIONS[item.type];
  ui.sectionChip.dataset.section = item.type;
  ui.body.replaceChildren(...QUESTION_RENDERERS[item.type](item, answer));
  if (state.running) session.view(state.index); // temps passé par question (suivi de progression)
  ui.prev.disabled = state.index === 0;
  ui.next.disabled = state.index === session.items.length - 1;
  updateQuestionControls();
  if (focus) moveFocusTo(ui.questionTitle);
};

/* ----- Épreuve : actions ----- */

const selectAnswer = (value) => {
  if (!state.running) return;
  if (!state.session.setAnswer(state.index, value)) {
    endExam('timeout');
    return;
  }
  ui.body.querySelectorAll('.option, .choice').forEach((button) => {
    button.setAttribute('aria-pressed', String(buttonValue(button) === value));
  });
  // Effacement d'une situation de jugement : décoche les choix.
  if (value === null) {
    ui.body.querySelectorAll('input:checked').forEach((input) => {
      input.checked = false;
    });
  }
  updateQuestionControls();
};

const toggleFlag = () => {
  if (!state.running) return;
  if (!state.session.toggleFlag(state.index)) {
    endExam('timeout');
    return;
  }
  updateQuestionControls();
};

const tick = () => {
  const remaining = state.session.remainingMs(Date.now());
  ui.timerValue.textContent = formatClock(remaining);
  ui.timer.dataset.level = remaining <= CRITICAL_MS ? 'critical' : remaining <= WARNING_MS ? 'warning' : 'normal';
  for (const { at, text } of ANNOUNCEMENTS) {
    if (remaining <= at && remaining > 0 && !state.announced.has(at)) {
      state.announced.add(at);
      ui.announcer.textContent = frenchTypography(text);
    }
  }
  if (remaining <= 0) endExam('timeout');
};

const startExam = () => {
  const items = createExam(state.banks);
  state.session = new ExamSession(items, { durationMs: EXAM_CONFIG.durationMs, startedAt: Date.now() });
  state.running = true;
  // Les alertes supérieures à la durée de l'examen n'ont pas lieu d'être.
  state.announced = new Set(ANNOUNCEMENTS.filter(({ at }) => at >= EXAM_CONFIG.durationMs).map(({ at }) => at));
  ui.announcer.textContent = '';
  ui.totalCount.textContent = String(items.length);

  ui.intro.hidden = true;
  ui.results.hidden = true;
  ui.exam.hidden = false;
  ui.examBar.hidden = false;
  showQuestion(0);
  tick();
  state.timerId = setInterval(tick, TICK_MS);
  window.addEventListener('beforeunload', warnBeforeLeaving);
};

const askToFinish = () => {
  if (!state.running) return;
  const { session } = state;
  const incomplete = session.items.filter((item, index) => session.answers[index] !== null && !isAnswered(item, session.answers[index])).length;
  const blank = session.items.length - session.answeredCount - incomplete;
  const flagged = session.flags.filter(Boolean).length;
  const parts = [
    blank + incomplete === 0 ? 'Vous avez répondu à toutes les questions.' : '',
    blank > 0
      ? `${plural(blank, 'question')} sans réponse ${blank > 1 ? 'seront comptées' : 'sera comptée'} comme ${blank > 1 ? 'fausses' : 'fausse'}.`
      : '',
    incomplete > 0
      ? `${plural(incomplete, 'situation de jugement', 'situations de jugement')} ${incomplete > 1 ? 'n\'ont' : 'n\'a'} qu'un choix sur deux : seul ce choix sera noté.`
      : '',
    flagged > 0 ? `${plural(flagged, 'question marquée', 'questions marquées')} « à revoir ».` : '',
    'Une fois l\'examen terminé, vous ne pourrez plus modifier vos réponses.',
  ];
  ui.confirmText.textContent = frenchTypography(parts.filter(Boolean).join(' '));
  ui.confirm.showModal();
};

const endExam = (reason) => {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timerId);
  state.session.finish(reason, Date.now());
  if (ui.confirm.open) ui.confirm.close();
  window.removeEventListener('beforeunload', warnBeforeLeaving);

  saveToProgress(renderResults());
  ui.exam.hidden = true;
  ui.examBar.hidden = true;
  ui.results.hidden = false;
  ui.resultsTitle.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
};

/* ----- Bilan et correction détaillée ----- */

const statTile = (label, value) => {
  const tile = createElement('div', 'summary-stat');
  tile.append(createElement('dt', 'summary-stat__label', label), createElement('dd', 'summary-stat__value', value));
  return tile;
};

const verdictMessage = (grade, session) => {
  const rate = grade.score / grade.total;
  const parts = [
    rate >= 0.8
      ? 'Excellent résultat dans les conditions de l\'épreuve.'
      : rate >= 0.6
        ? 'Bon résultat : analysez la correction des questions manquées pour gagner encore quelques points.'
        : 'Continuez à vous entraîner dans les modules d\'entraînement, puis retentez l\'examen.',
  ];
  const sections = Object.entries(grade.bySection)
    .filter(([, { total }]) => total > 0)
    .map(([id, { score, total }]) => ({ id, rate: score / total, score, total }));
  const sorted = [...sections].sort((a, b) => a.rate - b.rate);
  const [weakest, strongest] = [sorted[0], sorted.at(-1)];
  if (weakest && strongest && weakest.rate < strongest.rate) {
    parts.push(`Section à travailler en priorité : ${SECTIONS[weakest.id].toLowerCase()} (${formatScore(weakest.score)} sur ${weakest.total}).`);
  }
  if (session.endReason === 'timeout' && grade.blank > 0) {
    parts.push(`${plural(grade.blank, 'question est restée', 'questions sont restées')} sans réponse : travaillez aussi votre gestion du temps.`);
  }
  return frenchTypography(parts.join(' '));
};

const markButton = (button, status, label, statusClass) => {
  button.dataset.state = status;
  button.append(createElement('span', statusClass, label));
};

const reviewAbstract = ({ item: { question }, answer, status }) => {
  const sequence = createElement('ol', 'figure-row');
  sequence.setAttribute('aria-label', 'Série de figures complétée');
  sequence.append(...sequenceCells(question, { reveal: true }));

  const options = createElement('div', 'option-row');
  options.append(
    ...question.options.map((figure, index) => {
      const button = optionButton(figure, index);
      button.disabled = true;
      if (index === question.correctIndex) markButton(button, 'correct', 'Bonne réponse', 'option__status');
      else if (index === answer) markButton(button, 'wrong', 'Votre choix', 'option__status');
      else button.dataset.state = 'dimmed';
      return button;
    }),
  );

  const expected = OPTION_LETTERS[question.correctIndex];
  const verdict = {
    correct: `Vous avez choisi ${expected} : c'est la bonne réponse.`,
    wrong: `Vous avez choisi ${OPTION_LETTERS[answer]} ; la bonne réponse était ${expected}.`,
    blank: `Sans réponse. La bonne réponse était ${expected}.`,
  }[status];

  return [
    sequence,
    options,
    createElement('p', 'review-answer', frenchTypography(verdict)),
    createElement('p', 'feedback__rule', frenchTypography(`Règle : ${question.ruleTitle}`)),
    createElement('p', 'feedback__text', question.explanation),
  ];
};

const reviewVerbal = ({ item: { passage, statement }, answer, status }) => {
  const expected = answerLabel(statement.answer);
  const verdict = {
    correct: `Vous avez répondu « ${expected} » : c'est la bonne réponse.`,
    wrong: `Vous avez répondu « ${answerLabel(answer)} » ; la bonne réponse était « ${expected} ».`,
    blank: `Sans réponse. La bonne réponse était « ${expected} ».`,
  }[status];

  const tip = createElement('p', 'method-tip');
  tip.append(createElement('strong', '', 'Rappel de méthode : '), frenchTypography(METHOD_TIPS[statement.answer]));

  const fullText = createElement('details', 'review-passage');
  const body = createElement('div', 'passage');
  body.append(...passageParagraphs(passage, statement.quotes));
  fullText.append(
    createElement('summary', '', 'Afficher le texte complet'),
    createElement('p', 'exam-passage__title', frenchTypography(passage.title)),
    body,
  );

  return [
    createElement('p', 'exam-label', frenchTypography(`Texte : ${passage.title}`)),
    createElement('p', 'statement-box', frenchTypography(statement.text)),
    createElement('p', 'review-answer', frenchTypography(verdict)),
    createElement('p', 'feedback__label', statement.quotes.length > 1 ? 'Preuves dans le texte' : 'Preuve dans le texte'),
    ...evidenceQuotes(statement.quotes),
    createElement('p', 'feedback__label', 'Explication'),
    createElement('p', 'feedback__text', frenchTypography(statement.explanation)),
    tip,
    fullText,
  ];
};

const reviewNumeric = ({ item: { scenario, question }, answer }) => {
  const choices = createElement('div', 'choice-list');
  choices.append(
    ...question.options.map((option, index) => {
      const button = numericOptionButton(question, option, index);
      button.disabled = true;
      if (index === question.answer) markButton(button, 'correct', 'Bonne réponse', 'choice__status');
      else if (index === answer) markButton(button, 'wrong', 'Votre choix', 'choice__status');
      else button.dataset.state = 'dimmed';
      return button;
    }),
  );

  const data = createElement('details', 'review-passage');
  data.append(createElement('summary', '', 'Afficher les données'), createElement('p', 'exam-passage__title', frenchTypography(scenario.title)), dataTable(scenario));

  const hint = answer === null ? null : errorHint(question, answer);
  return [
    createElement('p', 'exam-label', frenchTypography(`Données : ${scenario.title}`)),
    createElement('p', 'statement-box', frenchTypography(question.text)),
    choices,
    createElement('p', 'review-answer', frenchTypography(answerSentence(question, answer))),
    ...(hint ? [hint] : []),
    ...calculationDetails(scenario, question),
    data,
  ];
};

const reviewJudgement = ({ item: { scenario, order }, answer, points }) => {
  const situation = createElement('details', 'review-passage');
  situation.append(
    createElement('summary', '', 'Afficher la situation'),
    createElement('p', 'exam-passage__title', frenchTypography(scenario.title)),
    ...situationContent(scenario).slice(0, -1),
  );
  const verdict = answer === null ? `Sans réponse : 0 point sur ${MAX_POINTS}.` : `Vous obtenez ${pointsLabel(points)}, soit ${formatScore(points / MAX_POINTS)} point à l'examen.`;

  return [
    createElement('p', 'exam-label', frenchTypography(`Situation : ${scenario.title}`)),
    situation,
    createElement('p', 'review-answer', frenchTypography(verdict)),
    scoreLines(scenario, order, answer).list,
    correctionList(scenario, order, answer),
    ...debriefContent(scenario),
  ];
};

const REVIEW_RENDERERS = { abstrait: reviewAbstract, verbal: reviewVerbal, numerique: reviewNumeric, jugement: reviewJudgement };

/** Libellé du statut : points obtenus pour une situation de jugement, sinon bonne / mauvaise réponse. */
const statusLabel = ({ item, status, points }) => (item.type === 'jugement' && status !== 'blank' ? pointsLabel(points) : REVIEW_STATUS[status].label);

const reviewItem = (result, index) => {
  const { item, status } = result;
  const details = createElement('details', 'review-item');
  details.dataset.status = status;
  details.open = status !== 'correct';

  const summary = createElement('summary', 'review-item__summary');
  summary.append(
    hiddenFromScreenReaders(createElement('span', 'review-item__badge', REVIEW_STATUS[status].icon)),
    createElement('span', 'review-item__title', `Question ${index + 1}`),
    createElement('span', 'review-item__section', SECTIONS[item.type]),
    createElement('span', 'review-item__status', statusLabel(result)),
  );

  const body = createElement('div', 'review-item__body');
  body.append(...REVIEW_RENDERERS[item.type](result));
  details.append(summary, body);

  const entry = createElement('li');
  entry.append(details);
  return entry;
};

const renderResults = () => {
  const { session } = state;
  const grade = gradeExam(session.items, session.answers);

  ui.endBanner.dataset.reason = session.endReason;
  ui.endBanner.textContent = frenchTypography(
    session.endReason === 'timeout' ? 'Temps écoulé : l\'examen s\'est arrêté automatiquement.' : 'Examen terminé.',
  );
  ui.resultScore.textContent = `${formatScore(grade.score)} / ${grade.total}`;
  ui.resultPercent.textContent = frenchTypography(`${Math.round((grade.score / grade.total) * 100)} % des points`);
  ui.resultMessage.textContent = verdictMessage(grade, session);
  ui.resultStats.replaceChildren(
    statTile('Temps utilisé', `${formatClock(session.elapsedMs(), Math.floor)} / ${formatClock(session.durationMs)}`),
    statTile('Sans réponse', String(grade.blank)),
    ...Object.entries(grade.bySection).map(([id, { score, total }]) => statTile(SECTIONS[id], `${formatScore(score)} / ${total}`)),
  );
  ui.reviewList.replaceChildren(...grade.results.map(reviewItem));
  return grade;
};

/**
 * Suivi de progression (sur cet appareil uniquement) : score global, scores par catégorie,
 * durée, et chaque réponse donnée (les erreurs rejoignent la liste « Revoir mes erreurs » du module).
 */
const saveToProgress = (grade) => {
  const { session } = state;
  const saved = progress.recordExam({
    score: grade.score,
    total: grade.total,
    sections: Object.fromEntries(Object.entries(grade.bySection).map(([id, { score, total }]) => [id, { score, total }])),
    durationMs: session.elapsedMs(),
    endReason: session.endReason,
    answers: grade.results.flatMap((result, index) =>
      result.status === 'blank'
        ? []
        : [{
          module: result.item.type,
          questionId: itemQuestionId(result.item),
          correct: result.status === 'correct',
          score: result.item.type === 'jugement' ? result.score : undefined,
          durationMs: session.timeSpentMs[index],
          date: new Date(session.answeredAt[index]).toISOString(),
        }],
    ),
  });
  ui.progressNote.hidden = !saved;
};

const showIntro = () => {
  ui.results.hidden = true;
  ui.intro.hidden = false;
  window.scrollTo({ top: 0 });
  ui.introTitle.focus({ preventScroll: true });
};

/* ----- Événements ----- */

ui.start.addEventListener('click', startExam);
ui.restart.addEventListener('click', showIntro);
ui.finish.addEventListener('click', askToFinish);
ui.confirmCancel.addEventListener('click', () => ui.confirm.close());
ui.confirmOk.addEventListener('click', () => endExam('submitted'));
ui.flag.addEventListener('click', toggleFlag);
ui.clear.addEventListener('click', () => {
  selectAnswer(null);
  moveFocusTo(ui.questionTitle);
});
ui.prev.addEventListener('click', () => showQuestion(state.index - 1));
ui.next.addEventListener('click', () => showQuestion(state.index + 1));

ui.palette.addEventListener('click', (event) => {
  const button = event.target.closest('.palette-item');
  if (button && state.running) showQuestion(Number(button.dataset.index));
});

ui.body.addEventListener('click', (event) => {
  const button = event.target.closest('.option, .choice');
  if (button) selectAnswer(buttonValue(button));
});

// Raccourcis : flèches pour naviguer, A-D / 1-4 (abstrait, numérique) ou V, F, ? / 1-3 (verbal) pour répondre.
// Les situations de jugement se répondent avec Tab et les flèches, comme tout groupe de boutons radio :
// on laisse donc le navigateur gérer les touches quand le focus est sur un choix.
document.addEventListener('keydown', (event) => {
  if (!state.running || ui.confirm.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const target = state.index + (event.key === 'ArrowLeft' ? -1 : 1);
    if (target >= 0 && target < state.session.items.length) {
      event.preventDefault();
      showQuestion(target);
    }
    return;
  }
  if (currentItem().type === 'jugement') return;
  const keys = currentItem().type === 'verbal' ? VERBAL_KEYS : OPTION_KEYS;
  const value = keys[event.key.toLowerCase()];
  if (value === undefined) return;
  event.preventDefault();
  selectAnswer(value);
});

/* ----- Démarrage ----- */

const { abstractCount, verbalCount, numericCount, judgementCount, durationMs } = EXAM_CONFIG;
ui.introCount.textContent = String(abstractCount + verbalCount + numericCount + judgementCount);
ui.introSections.textContent = String(Object.keys(SECTIONS).length);
ui.introDuration.textContent = `${durationMs / 60000} min`;
ui.introMix.textContent = frenchTypography(
  `${abstractCount} questions de raisonnement abstrait, ${verbalCount} de raisonnement verbal, ${numericCount} de raisonnement numérique et ${judgementCount} situations de jugement, dans un ordre aléatoire.`,
);
ui.timerValue.textContent = formatClock(durationMs);

try {
  const entries = await Promise.all(
    Object.entries(BANKS).map(async ([name, { url, key }]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url.pathname} : HTTP ${response.status}`);
      return [name, (await response.json())[key]];
    }),
  );
  state.banks = Object.fromEntries(entries);
  ui.start.disabled = false;
  ui.startLabel.textContent = 'Commencer l\'examen';
} catch (error) {
  console.error('Chargement de la banque de questions impossible :', error);
  ui.startLabel.textContent = 'Examen indisponible';
  ui.loadError.hidden = false;
}
