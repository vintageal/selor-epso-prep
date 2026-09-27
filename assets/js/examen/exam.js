/*
 * Mode examen : composition de l'épreuve, session chronométrée et notation.
 * Aucune dépendance au DOM ; le temps est toujours passé en paramètre (`now`),
 * ce qui rend le chronomètre testable sans attendre.
 */
import { createQuestionStream } from '../abstrait/generator.js';
import { shuffle } from '../lib/random.js';

export const EXAM_CONFIG = Object.freeze({
  abstractCount: 10,
  verbalCount: 10,
  durationMs: 20 * 60 * 1000,
});

export const SECTIONS = {
  abstrait: 'Raisonnement abstrait',
  verbal: 'Raisonnement verbal',
};

/**
 * Tire `count` affirmations en les répartissant le plus équitablement possible
 * entre les textes (une par texte, puis une deuxième, etc.).
 */
export function pickVerbalItems(passages, count, random = Math.random) {
  const pools = shuffle(random, passages).map((passage) => ({ passage, statements: shuffle(random, passage.statements) }));
  const picked = [];
  for (let round = 0; picked.length < count && pools.some((pool) => round < pool.statements.length); round += 1) {
    for (const { passage, statements } of pools) {
      if (picked.length === count) break;
      if (round < statements.length) picked.push({ passage, statement: statements[round] });
    }
  }
  return picked;
}

/** Compose un examen : questions abstraites générées et affirmations verbales tirées, puis mélangées. */
export function createExam(passages, { random = Math.random, config = EXAM_CONFIG } = {}) {
  const nextAbstract = createQuestionStream(random);
  const abstractItems = Array.from({ length: config.abstractCount }, () => ({ type: 'abstrait', question: nextAbstract() }));
  const verbalItems = pickVerbalItems(passages, config.verbalCount, random).map((item) => ({ type: 'verbal', ...item }));
  return shuffle(random, [...abstractItems, ...verbalItems]).map((item, index) => ({ id: `q${index + 1}`, ...item }));
}

/** Réponse attendue : index de la proposition (abstrait) ou identifiant de réponse (verbal). */
export const expectedAnswer = (item) => (item.type === 'abstrait' ? item.question.correctIndex : item.statement.answer);

/** Session d'examen : réponses, questions marquées « à revoir » et chronomètre strict. */
export class ExamSession {
  constructor(items, { durationMs = EXAM_CONFIG.durationMs, startedAt = Date.now() } = {}) {
    this.items = items;
    this.durationMs = durationMs;
    this.startedAt = startedAt;
    this.deadline = startedAt + durationMs;
    this.answers = items.map(() => null);
    this.flags = items.map(() => false);
    this.finishedAt = null;
    this.endReason = null;
  }

  get isFinished() {
    return this.finishedAt !== null;
  }

  get answeredCount() {
    return this.answers.filter((answer) => answer !== null).length;
  }

  remainingMs(now = Date.now()) {
    return Math.max(0, this.deadline - (this.finishedAt ?? now));
  }

  elapsedMs(now = Date.now()) {
    return Math.min(this.durationMs, (this.finishedAt ?? now) - this.startedAt);
  }

  /** Enregistre (ou efface avec `null`) une réponse. Refusé une fois le temps écoulé. */
  setAnswer(index, answer, now = Date.now()) {
    if (this.#closeIfTimeUp(now)) return false;
    this.answers[index] = answer;
    return true;
  }

  toggleFlag(index, now = Date.now()) {
    if (this.#closeIfTimeUp(now)) return false;
    this.flags[index] = !this.flags[index];
    return true;
  }

  /** Termine l'examen (`reason` : 'submitted' ou 'timeout'). Sans effet s'il est déjà terminé. */
  finish(reason, now = Date.now()) {
    if (this.isFinished) return;
    this.finishedAt = Math.min(now, this.deadline);
    this.endReason = now >= this.deadline ? 'timeout' : reason;
  }

  #closeIfTimeUp(now) {
    if (!this.isFinished && now >= this.deadline) this.finish('timeout', now);
    return this.isFinished;
  }
}

/** Notation : chaque question est correcte, fausse ou sans réponse (une question vide vaut 0). */
export function gradeExam(items, answers) {
  const bySection = Object.fromEntries(Object.keys(SECTIONS).map((section) => [section, { total: 0, correct: 0 }]));
  const results = items.map((item, index) => {
    const answer = answers[index];
    const expected = expectedAnswer(item);
    const status = answer === null ? 'blank' : answer === expected ? 'correct' : 'wrong';
    bySection[item.type].total += 1;
    if (status === 'correct') bySection[item.type].correct += 1;
    return { item, answer, expected, status };
  });
  const count = (status) => results.filter((result) => result.status === status).length;
  return {
    results,
    total: items.length,
    correct: count('correct'),
    wrong: count('wrong'),
    blank: count('blank'),
    bySection,
  };
}

/**
 * Durée au format « mm:ss ». Par défaut arrondie à la seconde supérieure, comme
 * un compte à rebours (il reste 0,4 s → « 00:01 ») ; passer Math.floor pour un temps écoulé.
 */
export function formatClock(ms, round = Math.ceil) {
  const totalSeconds = Math.max(0, round(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
