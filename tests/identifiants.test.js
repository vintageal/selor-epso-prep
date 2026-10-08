import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createQuestionStream, createSeededQuestion, questionFromId } from '../assets/js/abstrait/generator.js';
import { RULES } from '../assets/js/abstrait/rules.js';
import { createExam } from '../assets/js/examen/exam.js';
import { createSeededRandom } from '../assets/js/lib/random.js';
import { MODULE_IDS, reviewKey } from '../assets/js/progression/store.js';

/*
 * Le suivi de progression et la révision des erreurs reposent sur l'identifiant de chaque
 * question : il doit être présent, unique dans son module et stable (même question, même
 * identifiant, d'une visite à l'autre).
 */

const readBank = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));

/** Identifiants des questions de chaque module à banque fixe. */
const bankQuestionIds = () => ({
  verbal: readBank('verbal.json').passages.flatMap((passage) => passage.statements.map((statement) => statement.id)),
  numerique: readBank('numerique.json').scenarios.flatMap((scenario) => scenario.questions.map((question) => question.id)),
  jugement: readBank('jugement.json').scenarios.map((scenario) => scenario.id),
});

const duplicates = (ids) => ids.filter((id, index) => ids.indexOf(id) !== index);

test('chaque question des banques a un identifiant non vide et sans espace', () => {
  for (const [module, ids] of Object.entries(bankQuestionIds())) {
    assert.ok(ids.length > 0, module);
    for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]*$/, `${module} : identifiant « ${id} » invalide`);
  }
});

test('aucun identifiant de question en double, dans chaque module et entre modules', () => {
  const all = [];
  for (const [module, ids] of Object.entries(bankQuestionIds())) {
    assert.deepEqual(duplicates(ids), [], `${module} : identifiants en double`);
    all.push(...ids.map((id) => reviewKey(module, id)));
  }
  assert.deepEqual(duplicates(all), []);
});

test('le test de doublons détecte bien un identifiant répété', () => {
  const ids = bankQuestionIds().verbal;
  assert.deepEqual(duplicates([...ids, ids[0]]), [ids[0]]);
});

test('raisonnement abstrait : chaque question générée a un identifiant (règle + graine) unique', () => {
  const next = createQuestionStream(createSeededRandom(2026));
  const ids = Array.from({ length: 2000 }, () => next().id);
  assert.deepEqual(duplicates(ids), []);
  for (const id of ids) assert.match(id, /^[a-z-]+\/[0-9a-z]{1,7}$/);
});

test('raisonnement abstrait : l’identifiant est stable et régénère exactement la même question', () => {
  const next = createQuestionStream(createSeededRandom(7));
  for (let i = 0; i < 100; i += 1) {
    const question = next();
    assert.deepEqual(questionFromId(question.id), question);
  }
  for (const rule of RULES) assert.deepEqual(questionFromId(`${rule.id}/0`), createSeededQuestion(rule, 0));
});

test('raisonnement abstrait : un identifiant inconnu ou invalide ne produit aucune question', () => {
  for (const id of ['', 'rotation', 'inconnue/1a', 'rotation/', 'rotation/ABC', 'rotation/zzzzzzzz', null, undefined]) {
    assert.equal(questionFromId(id), null, String(id));
  }
});

test('mode examen : chaque question porte l’identifiant de sa question d’origine', () => {
  const banks = { passages: readBank('verbal.json').passages, scenarios: readBank('numerique.json').scenarios, situations: readBank('jugement.json').scenarios };
  const items = createExam(banks, { random: createSeededRandom(4) });
  const keys = items.map((item) => {
    const id = { abstrait: item.question?.id, verbal: item.statement?.id, numerique: item.question?.id, jugement: item.scenario?.id }[item.type];
    assert.ok(id, `${item.type} : identifiant manquant`);
    assert.ok(MODULE_IDS.includes(item.type));
    return reviewKey(item.type, id);
  });
  assert.deepEqual(duplicates(keys), []);
});
