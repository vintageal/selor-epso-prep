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
  pickVerbalItems,
} from '../assets/js/examen/exam.js';
import { createSeededRandom } from '../assets/js/lib/random.js';

const bank = JSON.parse(readFileSync(new URL('../data/verbal.json', import.meta.url), 'utf8'));
const MINUTE = 60 * 1000;

/* ----- Composition de l'examen ----- */

test('un examen compte 20 questions : 10 abstraites et 10 verbales, mélangées', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const items = createExam(bank.passages, { random: createSeededRandom(seed) });
    assert.equal(items.length, 20);
    assert.equal(items.filter((item) => item.type === 'abstrait').length, EXAM_CONFIG.abstractCount);
    assert.equal(items.filter((item) => item.type === 'verbal').length, EXAM_CONFIG.verbalCount);
    assert.equal(new Set(items.map((item) => item.id)).size, 20);
    const firstHalf = new Set(items.slice(0, 10).map((item) => item.type));
    assert.equal(firstHalf.size, 2, `graine ${seed} : les deux types doivent être mélangés`);
  }
});

test('les affirmations verbales sont distinctes et réparties entre les textes', () => {
  const items = createExam(bank.passages, { random: createSeededRandom(8) }).filter((item) => item.type === 'verbal');
  assert.equal(new Set(items.map((item) => item.statement.id)).size, items.length);
  const perPassage = Math.ceil(EXAM_CONFIG.verbalCount / bank.passages.length);
  for (const passage of bank.passages) {
    const count = items.filter((item) => item.passage === passage).length;
    assert.ok(count <= perPassage, `« ${passage.id} » : ${count} affirmations`);
    items.filter((item) => item.passage === passage).forEach((item) => assert.ok(passage.statements.includes(item.statement)));
  }
});

test('pickVerbalItems s’arrête au nombre demandé ou à l’épuisement de la banque', () => {
  const random = createSeededRandom(3);
  const total = bank.passages.reduce((sum, passage) => sum + passage.statements.length, 0);
  assert.equal(pickVerbalItems(bank.passages, 3, random).length, 3);
  assert.equal(pickVerbalItems(bank.passages, total + 10, random).length, total);
  assert.deepEqual(pickVerbalItems([], 5, random), []);
});

test('la banque verbale suffit pour un examen', () => {
  const total = bank.passages.reduce((sum, passage) => sum + passage.statements.length, 0);
  assert.ok(total >= EXAM_CONFIG.verbalCount);
});

test('la composition est reproductible avec une même graine', () => {
  const first = createExam(bank.passages, { random: createSeededRandom(21) });
  const second = createExam(bank.passages, { random: createSeededRandom(21) });
  assert.deepEqual(first, second);
});

/* ----- Session et chronomètre ----- */

const newSession = () => {
  const items = createExam(bank.passages, { random: createSeededRandom(5) });
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
  const items = createExam(bank.passages, { random: createSeededRandom(13) });
  const answers = items.map(() => null);
  const abstractIndex = items.findIndex((item) => item.type === 'abstrait');
  const verbalIndexes = items.flatMap((item, index) => (item.type === 'verbal' ? [index] : []));

  answers[abstractIndex] = expectedAnswer(items[abstractIndex]);
  answers[verbalIndexes[0]] = expectedAnswer(items[verbalIndexes[0]]);
  const wrongVerbal = ['vrai', 'faux', 'impossible'].find((id) => id !== expectedAnswer(items[verbalIndexes[1]]));
  answers[verbalIndexes[1]] = wrongVerbal;

  const grade = gradeExam(items, answers);
  assert.equal(grade.total, 20);
  assert.equal(grade.correct, 2);
  assert.equal(grade.wrong, 1);
  assert.equal(grade.blank, 17);
  assert.deepEqual(grade.bySection.abstrait, { total: 10, correct: 1 });
  assert.deepEqual(grade.bySection.verbal, { total: 10, correct: 1 });
  assert.equal(grade.results[verbalIndexes[1]].status, 'wrong');
  assert.equal(grade.results[verbalIndexes[1]].answer, wrongVerbal);
});

test('expectedAnswer renvoie l’index abstrait ou l’identifiant verbal', () => {
  const items = createExam(bank.passages, { random: createSeededRandom(2) });
  for (const item of items) {
    const expected = expectedAnswer(item);
    if (item.type === 'abstrait') assert.ok(Number.isInteger(expected) && expected >= 0 && expected < 4);
    else assert.ok(['vrai', 'faux', 'impossible'].includes(expected));
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
