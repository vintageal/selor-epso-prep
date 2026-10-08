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
  pickSpread,
} from '../assets/js/examen/exam.js';
import { createSeededRandom } from '../assets/js/lib/random.js';

const readBank = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const bank = readBank('verbal.json');
const numericBank = readBank('numerique.json');
const banks = { passages: bank.passages, scenarios: numericBank.scenarios };
const TOTAL = EXAM_CONFIG.abstractCount + EXAM_CONFIG.verbalCount + EXAM_CONFIG.numericCount;
const MINUTE = 60 * 1000;

/* ----- Composition de l'examen ----- */

test('un examen compte 30 questions : 10 abstraites, 10 verbales et 10 numériques, mélangées', () => {
  assert.equal(TOTAL, 30);
  assert.equal(EXAM_CONFIG.durationMs, 30 * MINUTE);
  for (let seed = 1; seed <= 50; seed += 1) {
    const items = createExam(banks, { random: createSeededRandom(seed) });
    assert.equal(items.length, TOTAL);
    assert.equal(items.filter((item) => item.type === 'abstrait').length, EXAM_CONFIG.abstractCount);
    assert.equal(items.filter((item) => item.type === 'verbal').length, EXAM_CONFIG.verbalCount);
    assert.equal(items.filter((item) => item.type === 'numerique').length, EXAM_CONFIG.numericCount);
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
  assert.equal(session.answeredCount, 0);
  assert.ok(session.setAnswer(0, 2, 1000));
  assert.ok(session.setAnswer(5, 'vrai', 2000));
  assert.ok(session.setAnswer(0, 3, 3000), 'une réponse peut être modifiée');
  assert.equal(session.answers[0], 3);
  assert.equal(session.answeredCount, 2);
  assert.ok(session.setAnswer(5, null, 4000), 'une réponse peut être effacée');
  assert.equal(session.answeredCount, 1);
  session.toggleFlag(7, 5000);
  assert.equal(session.flags[7], true);
  session.toggleFlag(7, 6000);
  assert.equal(session.flags[7], false);
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
  assert.equal(grade.correct, 3);
  assert.equal(grade.wrong, 1);
  assert.equal(grade.blank, TOTAL - 4);
  assert.deepEqual(grade.bySection.abstrait, { total: 10, correct: 1 });
  assert.deepEqual(grade.bySection.verbal, { total: 10, correct: 1 });
  assert.deepEqual(grade.bySection.numerique, { total: 10, correct: 1 });
  assert.equal(grade.results[verbalIndexes[1]].status, 'wrong');
  assert.equal(grade.results[verbalIndexes[1]].answer, wrongVerbal);
});

test('expectedAnswer renvoie l’index de la proposition (abstrait, numérique) ou l’identifiant verbal', () => {
  const items = createExam(banks, { random: createSeededRandom(2) });
  for (const item of items) {
    const expected = expectedAnswer(item);
    if (item.type === 'verbal') assert.ok(['vrai', 'faux', 'impossible'].includes(expected));
    else assert.ok(Number.isInteger(expected) && expected >= 0 && expected < 4, `${item.type} : ${expected}`);
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
