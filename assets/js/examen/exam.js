/*
 * Mode examen : composition de l'épreuve, session chronométrée et notation.
 * Aucune dépendance au DOM ; le temps est toujours passé en paramètre (`now`),
 * ce qui rend le chronomètre testable sans attendre.
 */
import { createQuestionStream } from '../abstrait/generator.js';
import { MAX_POINTS, expectedPicks, isComplete, scoreChoice, shuffledOrder } from '../jugement/quiz.js';
import { shuffle } from '../lib/random.js';

export const EXAM_CONFIG = Object.freeze({
  abstractCount: 10,
  verbalCount: 10,
  numericCount: 10,
  judgementCount: 5,
  durationMs: 40 * 60 * 1000,
});

export const SECTIONS = {
  abstrait: 'Raisonnement abstrait',
  verbal: 'Raisonnement verbal',
  numerique: 'Raisonnement numérique',
  jugement: 'Jugement situationnel',
};

/**
 * Quotas par niveau de difficulté : `count` réparti au plus égal entre les niveaux disponibles
 * (le reste va à des niveaux tirés au hasard, dans la limite des éléments de chaque niveau).
 */
function levelQuotas(available, count, random) {
  const levels = shuffle(random, Object.keys(available));
  const quotas = Object.fromEntries(levels.map((level) => [level, 0]));
  let remaining = Math.min(count, Object.values(available).reduce((sum, n) => sum + n, 0));
  while (remaining > 0) {
    for (const level of levels) {
      if (remaining > 0 && quotas[level] < available[level]) {
        quotas[level] += 1;
        remaining -= 1;
      }
    }
  }
  return quotas;
}

/**
 * Tire `count` éléments (`group[itemsKey]`) en les répartissant le plus équitablement
 * possible entre les groupes : un par groupe, puis un deuxième, etc. Sert pour les
 * affirmations (réparties entre les textes) et les questions numériques (entre les jeux de données).
 * Si `levelOf` est fourni, le tirage est aussi équilibré entre les niveaux de difficulté
 * (environ un tiers par niveau), sans renoncer à la répartition entre les groupes.
 */
export function pickBalanced(groups, itemsKey, count, random = Math.random, levelOf = null) {
  const pools = shuffle(random, groups).map((group) => ({ group, items: shuffle(random, group[itemsKey]) }));
  const level = (item) => (levelOf ? String(levelOf(item)) : 'tous');
  const available = {};
  for (const { items } of pools) for (const item of items) available[level(item)] = (available[level(item)] ?? 0) + 1;
  const quotas = levelQuotas(available, count, random);

  const picked = [];
  const take = (respectQuotas) => {
    for (let progress = true; progress && picked.length < count; ) {
      progress = false;
      // Un tour : au plus un élément par groupe.
      for (const pool of pools) {
        if (picked.length === count) break;
        const index = pool.items.findIndex((item) => !respectQuotas || quotas[level(item)] > 0);
        if (index === -1) continue;
        const [item] = pool.items.splice(index, 1);
        quotas[level(item)] -= 1;
        picked.push({ group: pool.group, item });
        progress = true;
      }
    }
  };
  take(true);
  take(false); // quotas impossibles à tenir avec la répartition entre groupes : on complète
  return picked;
}

/** Tirage réparti entre les groupes, sans contrainte de difficulté. */
export const pickSpread = (groups, itemsKey, count, random = Math.random) => pickBalanced(groups, itemsKey, count, random);

/**
 * Compose un examen : questions abstraites générées, affirmations verbales,
 * questions numériques et situations de jugement tirées des banques, le tout mélangé.
 * Les actions de chaque situation sont présentées dans un ordre aléatoire (`order`).
 */
export function createExam({ passages, scenarios, situations }, { random = Math.random, config = EXAM_CONFIG } = {}) {
  const nextAbstract = createQuestionStream(random);
  const items = [
    ...Array.from({ length: config.abstractCount }, () => ({ type: 'abstrait', question: nextAbstract() })),
    ...pickSpread(passages, 'statements', config.verbalCount, random).map(({ group, item }) => ({ type: 'verbal', passage: group, statement: item })),
    ...pickSpread(scenarios, 'questions', config.numericCount, random).map(({ group, item }) => ({ type: 'numerique', scenario: group, question: item })),
    ...pickBalanced(situations.map((scenario) => ({ scenario, items: [scenario] })), 'items', config.judgementCount, random, (scenario) => scenario.difficulty)
      .map(({ item: scenario }) => ({ type: 'jugement', scenario, order: shuffledOrder(scenario, random) })),
  ];
  return shuffle(random, items).map((item, index) => ({ id: `q${index + 1}`, ...item }));
}

/**
 * Réponse attendue : index de la proposition (abstrait, numérique), identifiant de réponse (verbal)
 * ou, pour le jugement situationnel, index des actions la plus et la moins adéquates `{ best, worst }`.
 */
export const expectedAnswer = (item) => {
  if (item.type === 'abstrait') return item.question.correctIndex;
  if (item.type === 'numerique') return item.question.answer;
  if (item.type === 'jugement') return expectedPicks(item.scenario);
  return item.statement.answer;
};

/** Identifiant de la question d'origine (celui du module), pour le suivi de progression. */
export const itemQuestionId = (item) => (item.type === 'verbal' ? item.statement.id : item.type === 'jugement' ? item.scenario.id : item.question.id);

/**
 * Vrai si la question a reçu une réponse complète. Une situation de jugement n'est
 * complète qu'avec ses deux choix (« plus » et « moins » adéquate).
 */
export const isAnswered = (item, answer) => (item.type === 'jugement' ? isComplete(answer) : answer !== null && answer !== undefined);

/** Session d'examen : réponses, questions marquées « à revoir » et chronomètre strict. */
export class ExamSession {
  constructor(items, { durationMs = EXAM_CONFIG.durationMs, startedAt = Date.now() } = {}) {
    this.items = items;
    this.durationMs = durationMs;
    this.startedAt = startedAt;
    this.deadline = startedAt + durationMs;
    this.answers = items.map(() => null);
    this.answeredAt = items.map(() => null);
    this.flags = items.map(() => false);
    this.timeSpentMs = items.map(() => 0);
    this.viewing = null;
    this.finishedAt = null;
    this.endReason = null;
  }

  get isFinished() {
    return this.finishedAt !== null;
  }

  get answeredCount() {
    return this.answers.filter((answer, index) => isAnswered(this.items[index], answer)).length;
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
    this.answeredAt[index] = answer === null ? null : now;
    return true;
  }

  /** La question `index` est affichée : le temps passé sur la question précédente est comptabilisé. */
  view(index, now = Date.now()) {
    if (this.#closeIfTimeUp(now)) return;
    this.#stopViewing(now);
    this.viewing = { index, since: now };
  }

  #stopViewing(now) {
    if (!this.viewing) return;
    this.timeSpentMs[this.viewing.index] += Math.max(0, Math.min(now, this.deadline) - this.viewing.since);
    this.viewing = null;
  }

  toggleFlag(index, now = Date.now()) {
    if (this.#closeIfTimeUp(now)) return false;
    this.flags[index] = !this.flags[index];
    return true;
  }

  /** Termine l'examen (`reason` : 'submitted' ou 'timeout'). Sans effet s'il est déjà terminé. */
  finish(reason, now = Date.now()) {
    if (this.isFinished) return;
    this.#stopViewing(now);
    this.finishedAt = Math.min(now, this.deadline);
    this.endReason = now >= this.deadline ? 'timeout' : reason;
  }

  #closeIfTimeUp(now) {
    if (!this.isFinished && now >= this.deadline) this.finish('timeout', now);
    return this.isFinished;
  }
}

/** Note d'une situation de jugement : fraction de point selon la proximité avec la grille. */
const gradeJudgement = (item, answer) => {
  const { points } = scoreChoice(item.scenario, answer);
  const picked = Number.isInteger(answer?.best) || Number.isInteger(answer?.worst);
  const status = !picked ? 'blank' : points === MAX_POINTS ? 'correct' : points === 0 ? 'wrong' : 'partial';
  return { status, score: points / MAX_POINTS, points };
};

/** Note d'une question à choix unique : 1 point si la réponse est exacte, 0 sinon. */
const gradeSingle = (item, answer) => {
  const status = answer === null || answer === undefined ? 'blank' : answer === expectedAnswer(item) ? 'correct' : 'wrong';
  return { status, score: status === 'correct' ? 1 : 0 };
};

/**
 * Notation : chaque question vaut 1 point. Une question à choix unique est correcte, fausse
 * ou sans réponse (une question vide vaut 0). Une situation de jugement rapporte une fraction
 * de point selon la proximité de ses deux choix avec la grille (statut « partial » entre 0 et 1).
 */
export function gradeExam(items, answers) {
  const bySection = Object.fromEntries(Object.keys(SECTIONS).map((section) => [section, { total: 0, correct: 0, score: 0 }]));
  const results = items.map((item, index) => {
    const answer = answers[index] ?? null;
    const grade = item.type === 'jugement' ? gradeJudgement(item, answer) : gradeSingle(item, answer);
    const section = bySection[item.type];
    section.total += 1;
    section.score += grade.score;
    if (grade.status === 'correct') section.correct += 1;
    return { item, answer, expected: expectedAnswer(item), ...grade };
  });
  const count = (status) => results.filter((result) => result.status === status).length;
  return {
    results,
    total: items.length,
    score: results.reduce((sum, result) => sum + result.score, 0),
    correct: count('correct'),
    partial: count('partial'),
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
