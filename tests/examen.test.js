import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  EXAM_CONFIG,
  ExamSession,
  createExam,
  expectedAnswer,
  formatClock,
  gradeExam,
  isAnswered,
  pickSpread,
} from '../assets/js/examen/exam.js';
import { expectedPicks } from '../assets/js/jugement/quiz.js';
import { createSeededRandom } from '../assets/js/lib/random.js';

const readBank = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const bank = readBank('verbal.json');
const numericBank = readBank('numerique.json');
const judgementBank = readBank('jugement.json');
const banks = { passages: bank.passages, scenarios: numericBank.scenarios, situations: judgementBank.scenarios };
const TOTAL = EXAM_CONFIG.abstractCount + EXAM_CONFIG.verbalCount + EXAM_CONFIG.numericCount + EXAM_CONFIG.judgementCount;
const MINUTE = 60 * 1000;
const indexOfRank = (scenario, rank) => scenario.actions.findIndex((action) => action.rank === rank);

/* ----- Composition de l'examen ----- */

test('un examen compte 35 questions : 10 abstraites, 10 verbales, 10 numériques et 5 situations de jugement, mélangées', () => {
  assert.equal(TOTAL, 35);
  assert.equal(EXAM_CONFIG.durationMs, 40 * MINUTE);
  for (let seed = 1; seed <= 50; seed += 1) {
    const items = createExam(banks, { random: createSeededRandom(seed) });
    assert.equal(items.length, TOTAL);
    assert.equal(items.filter((item) => item.type === 'abstrait').length, EXAM_CONFIG.abstractCount);
    assert.equal(items.filter((item) => item.type === 'verbal').length, EXAM_CONFIG.verbalCount);
    assert.equal(items.filter((item) => item.type === 'numerique').length, EXAM_CONFIG.numericCount);
    assert.equal(items.filter((item) => item.type === 'jugement').length, EXAM_CONFIG.judgementCount);
    assert.equal(new Set(items.map((item) => item.id)).size, TOTAL);
    const firstHalf = new Set(items.slice(0, TOTAL / 2).map((item) => item.type));
    assert.ok(firstHalf.size >= 2, `graine ${seed} : les types de questions doivent être mélangés`);
  }
});

test('les affirmations verbales sont distinctes et réparties entre les textes', () => {
  const items = createExam(banks, { random: createSeededRandom(8) }).filter((item) => item.type === 'verbal');
  assert.equal(new Set(items.map((item) => item.statement.id)).size, items.length);
  const perPassage = Math.ceil(EXAM_CONFIG.verbalCount / bank.passages.length);
  for (const passage of bank.passages) {
    const count = items.filter((item) => item.passage === passage).length;
    assert.ok(count <= perPassage, `« ${passage.id} » : ${count} affirmations`);
    items.filter((item) => item.passage === passage).forEach((item) => assert.ok(passage.statements.includes(item.statement)));
  }
});

test('les questions numériques sont distinctes et réparties entre les jeux de données', () => {
  const items = createExam(banks, { random: createSeededRandom(8) }).filter((item) => item.type === 'numerique');
  assert.equal(new Set(items.map((item) => item.question.id)).size, items.length);
  const perScenario = Math.ceil(EXAM_CONFIG.numericCount / numericBank.scenarios.length);
  for (const scenario of numericBank.scenarios) {
    const own = items.filter((item) => item.scenario === scenario);
    assert.ok(own.length <= perScenario, `« ${scenario.id} » : ${own.length} questions`);
    own.forEach((item) => assert.ok(scenario.questions.includes(item.question)));
  }
});

test('les situations de jugement sont distinctes, avec leurs actions dans un ordre aléatoire', () => {
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed += 1) {
    const items = createExam(banks, { random: createSeededRandom(seed) }).filter((item) => item.type === 'jugement');
    assert.equal(new Set(items.map((item) => item.scenario.id)).size, items.length);
    for (const item of items) {
      assert.ok(judgementBank.scenarios.includes(item.scenario));
      assert.deepEqual([...item.order].sort(), [0, 1, 2, 3]);
      orders.add(item.order.join());
    }
  }
  assert.ok(orders.size > 5, 'l’ordre des actions doit varier');
});

test('pickSpread s’arrête au nombre demandé ou à l’épuisement de la banque', () => {
  const random = createSeededRandom(3);
  const total = bank.passages.reduce((sum, passage) => sum + passage.statements.length, 0);
  assert.equal(pickSpread(bank.passages, 'statements', 3, random).length, 3);
  assert.equal(pickSpread(bank.passages, 'statements', total + 10, random).length, total);
  assert.deepEqual(pickSpread([], 'statements', 5, random), []);
  const picked = pickSpread(numericBank.scenarios, 'questions', 5, random);
  assert.equal(new Set(picked.map(({ group }) => group.id)).size, 5, 'une question par jeu de données au premier tour');
});

test('les banques suffisent pour un examen', () => {
  const count = (groups, key) => groups.reduce((sum, group) => sum + group[key].length, 0);
  assert.ok(count(bank.passages, 'statements') >= EXAM_CONFIG.verbalCount);
  assert.ok(count(numericBank.scenarios, 'questions') >= EXAM_CONFIG.numericCount);
  assert.ok(judgementBank.scenarios.length >= EXAM_CONFIG.judgementCount);
});

test('la composition est reproductible avec une même graine', () => {
  const first = createExam(banks, { random: createSeededRandom(21) });
  const second = createExam(banks, { random: createSeededRandom(21) });
  assert.deepEqual(first, second);
});

/* ----- Session et chronomètre ----- */

const newSession = () => {
  const items = createExam(banks, { random: createSeededRandom(5) });
  return new ExamSession(items, { durationMs: 20 * MINUTE, startedAt: 0 });
};

test('navigation libre : réponses modifiables, effaçables, questions marquées', () => {
  const session = newSession();
  const [first, second] = session.items.flatMap((item, index) => (item.type === 'jugement' ? [] : [index]));
  assert.equal(session.answeredCount, 0);
  assert.ok(session.setAnswer(first, 2, 1000));
  assert.ok(session.setAnswer(second, 'vrai', 2000));
  assert.ok(session.setAnswer(first, 3, 3000), 'une réponse peut être modifiée');
  assert.equal(session.answers[first], 3);
  assert.equal(session.answeredCount, 2);
  assert.ok(session.setAnswer(second, null, 4000), 'une réponse peut être effacée');
  assert.equal(session.answeredCount, 1);
  session.toggleFlag(7, 5000);
  assert.equal(session.flags[7], true);
  session.toggleFlag(7, 6000);
  assert.equal(session.flags[7], false);
});

test('une situation de jugement n’est répondue qu’avec ses deux choix', () => {
  const session = newSession();
  const index = session.items.findIndex((item) => item.type === 'jugement');
  const item = session.items[index];
  assert.ok(session.setAnswer(index, { best: 0, worst: null }, 1000));
  assert.equal(isAnswered(item, session.answers[index]), false);
  assert.equal(session.answeredCount, 0, 'un seul choix ne compte pas comme une réponse');
  session.setAnswer(index, { best: 0, worst: 2 }, 2000);
  assert.equal(isAnswered(item, session.answers[index]), true);
  assert.equal(session.answeredCount, 1);
  const other = session.items.findIndex((candidate) => candidate.type !== 'jugement');
  assert.equal(isAnswered(session.items[other], null), false);
  assert.equal(isAnswered(session.items[other], 0), true, 'l’index 0 est une réponse');
});

test('le chronomètre décompte le temps restant', () => {
  const session = newSession();
  assert.equal(session.remainingMs(0), 20 * MINUTE);
  assert.equal(session.remainingMs(5 * MINUTE), 15 * MINUTE);
  assert.equal(session.remainingMs(25 * MINUTE), 0);
  assert.equal(session.elapsedMs(5 * MINUTE), 5 * MINUTE);
});

test('à zéro, l’examen est clos et plus aucune réponse n’est acceptée', () => {
  const session = newSession();
  session.setAnswer(0, 1, 19 * MINUTE);
  assert.equal(session.setAnswer(1, 2, 20 * MINUTE), false);
  assert.equal(session.isFinished, true);
  assert.equal(session.endReason, 'timeout');
  assert.equal(session.answers[1], null);
  assert.equal(session.toggleFlag(2, 21 * MINUTE), false);
  assert.equal(session.elapsedMs(30 * MINUTE), 20 * MINUTE, 'le temps utilisé est plafonné à la durée');
});

test('terminer l’examen fige le chrono ; une remise tardive compte comme temps écoulé', () => {
  const submitted = newSession();
  submitted.finish('submitted', 12 * MINUTE);
  assert.equal(submitted.endReason, 'submitted');
  assert.equal(submitted.remainingMs(15 * MINUTE), 8 * MINUTE, 'le temps restant ne bouge plus');
  assert.equal(submitted.elapsedMs(15 * MINUTE), 12 * MINUTE);
  assert.equal(submitted.setAnswer(0, 1, 13 * MINUTE), false);
  submitted.finish('timeout', 20 * MINUTE);
  assert.equal(submitted.endReason, 'submitted', 'finish est sans effet une seconde fois');

  const late = newSession();
  late.finish('submitted', 20 * MINUTE + 500);
  assert.equal(late.endReason, 'timeout');
});

/* ----- Notation ----- */

test('la notation distingue bonnes réponses, erreurs et questions vides', () => {
  const items = createExam(banks, { random: createSeededRandom(13) });
  const answers = items.map(() => null);
  const abstractIndex = items.findIndex((item) => item.type === 'abstrait');
  const verbalIndexes = items.flatMap((item, index) => (item.type === 'verbal' ? [index] : []));
  const numericIndex = items.findIndex((item) => item.type === 'numerique');

  answers[abstractIndex] = expectedAnswer(items[abstractIndex]);
  answers[numericIndex] = expectedAnswer(items[numericIndex]);
  answers[verbalIndexes[0]] = expectedAnswer(items[verbalIndexes[0]]);
  const wrongVerbal = ['vrai', 'faux', 'impossible'].find((id) => id !== expectedAnswer(items[verbalIndexes[1]]));
  answers[verbalIndexes[1]] = wrongVerbal;

  const grade = gradeExam(items, answers);
  assert.equal(grade.total, TOTAL);
  assert.equal(grade.score, 3);
  assert.equal(grade.correct, 3);
  assert.equal(grade.wrong, 1);
  assert.equal(grade.partial, 0);
  assert.equal(grade.blank, TOTAL - 4);
  assert.deepEqual(grade.bySection.abstrait, { total: 10, correct: 1, score: 1 });
  assert.deepEqual(grade.bySection.verbal, { total: 10, correct: 1, score: 1 });
  assert.deepEqual(grade.bySection.numerique, { total: 10, correct: 1, score: 1 });
  assert.deepEqual(grade.bySection.jugement, { total: 5, correct: 0, score: 0 });
  assert.equal(grade.results[verbalIndexes[1]].status, 'wrong');
  assert.equal(grade.results[verbalIndexes[1]].answer, wrongVerbal);
});

test('une situation de jugement rapporte une fraction de point selon la proximité avec la grille', () => {
  const items = createExam(banks, { random: createSeededRandom(17) });
  const indexes = items.flatMap((item, index) => (item.type === 'jugement' ? [index] : []));
  const answers = items.map(() => null);
  const [full, half, quarter, zero, single] = indexes.map((index) => items[index].scenario);
  answers[indexes[0]] = { best: indexOfRank(full, 1), worst: indexOfRank(full, 4) }; // 4 points sur 4
  answers[indexes[1]] = { best: indexOfRank(half, 2), worst: indexOfRank(half, 3) }; // 1 + 1
  answers[indexes[2]] = { best: indexOfRank(quarter, 2), worst: indexOfRank(quarter, 1) }; // 1 + 0
  answers[indexes[3]] = { best: indexOfRank(zero, 4), worst: indexOfRank(zero, 1) }; // 0 + 0
  answers[indexes[4]] = { best: indexOfRank(single, 1), worst: null }; // 2 + 0 : un seul choix

  const grade = gradeExam(items, answers);
  const results = indexes.map((index) => grade.results[index]);
  assert.deepEqual(results.map((result) => result.status), ['correct', 'partial', 'partial', 'wrong', 'partial']);
  assert.deepEqual(results.map((result) => result.points), [4, 2, 1, 0, 2]);
  assert.deepEqual(results.map((result) => result.score), [1, 0.5, 0.25, 0, 0.5]);
  assert.equal(grade.score, 2.25);
  assert.deepEqual(grade.bySection.jugement, { total: 5, correct: 1, score: 2.25 });
  assert.equal(grade.correct, 1);
  assert.equal(grade.partial, 3);
  assert.equal(grade.wrong, 1);
  assert.equal(grade.blank, TOTAL - 5);
  assert.deepEqual(gradeExam(items, items.map(() => null)).results[indexes[0]].status, 'blank');
  assert.deepEqual(
    gradeExam(items, items.map(() => null)).results[indexes[0]].expected,
    expectedPicks(full),
    'la réponse attendue est la paire « plus / moins adéquate »',
  );
});

test('expectedAnswer renvoie l’index de la proposition, l’identifiant verbal ou la paire de jugement', () => {
  const items = createExam(banks, { random: createSeededRandom(2) });
  for (const item of items) {
    const expected = expectedAnswer(item);
    if (item.type === 'verbal') assert.ok(['vrai', 'faux', 'impossible'].includes(expected));
    else if (item.type === 'jugement') {
      assert.equal(item.scenario.actions[expected.best].rank, 1);
      assert.equal(item.scenario.actions[expected.worst].rank, 4);
    } else assert.ok(Number.isInteger(expected) && expected >= 0 && expected < 4, `${item.type} : ${expected}`);
  }
});

test('formatClock affiche un compte à rebours mm:ss', () => {
  assert.equal(formatClock(20 * MINUTE), '20:00');
  assert.equal(formatClock(20 * MINUTE - 1), '20:00');
  assert.equal(formatClock(5 * MINUTE + 7000), '05:07');
  assert.equal(formatClock(400), '00:01');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(-50), '00:00');
  assert.equal(formatClock(59_900, Math.floor), '00:59');
});
