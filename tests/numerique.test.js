import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createSeededRandom } from '../assets/js/lib/random.js';
import {
  OPTION_LETTERS,
  SKILLS,
  buildSteps,
  computeSteps,
  dataReferences,
  displayExpression,
  distractorValue,
  evaluate,
  formatAnswer,
  formatNumber,
  summarize,
  usedData,
  validateBank,
} from '../assets/js/numerique/quiz.js';
import { computeBank, computeOptions, serialize } from '../scripts/calculer-numerique.js';
import { NON_BELGIAN_NUMERALS, similarity } from './helpers/texte.js';

const bankText = readFileSync(new URL('../data/numerique.json', import.meta.url), 'utf8');
const bank = JSON.parse(bankText);
const questions = bank.scenarios.flatMap((scenario) => scenario.questions.map((question) => ({ scenario, question })));

/* ----- Banque de données ----- */

test('la banque est valide : chaque bonne réponse et chaque piège découlent des données', () => {
  assert.deepEqual(validateBank(bank), []);
});

/** Questions de la banque initiale : leurs identifiants ne doivent jamais changer (progression enregistrée). */
const ORIGINAL_IDS = [
  'budget-variation-total', 'budget-part-personnel', 'budget-projection-investissements', 'budget-ratio-subsides',
  'effectifs-variation-totale', 'effectifs-ratio-accueil-rh', 'effectifs-part-controle', 'effectifs-projection-informatique',
  'permis-taux-traitement', 'permis-variation-recues', 'permis-projection-lineaire',
  'centres-moyenne-generale', 'centres-reussite-globale', 'centres-projection-namur',
  'fournitures-prix-moyen', 'fournitures-variation-depense', 'fournitures-part-toner',
];

test('chaque réponse est recalculée par le script à partir des données : aucun écart', () => {
  for (const { scenario, question } of questions) {
    const computed = computeOptions(scenario, question);
    assert.equal(question.answer, computed.answer, `« ${question.id} » : bonne réponse en position ${question.answer}, le calcul donne ${computed.answer}`);
    assert.deepEqual(question.options.map((option) => option.value), computed.options.map((option) => option.value), `« ${question.id} » : valeurs des propositions`);
  }
  assert.equal(serialize(computeBank(bank)), bankText, 'data/numerique.json n’est pas à jour : lancez « node scripts/calculer-numerique.js »');
});

test('le script refuse une valeur à mi-chemin entre deux arrondis et deux propositions identiques', () => {
  const { scenario, question } = questions.find(({ question: q }) => q.id === 'budget-part-personnel');
  const tie = structuredClone(scenario);
  tie.rows.find((row) => row.key === 'personnel').values['2024'] = 7.785;
  tie.rows.find((row) => row.key === 'total').values['2024'] = 100;
  assert.doesNotThrow(() => computeOptions(tie, question));
  const twin = structuredClone(question);
  twin.options[1].expression = twin.steps[0].expression;
  assert.throws(() => computeOptions(scenario, twin), /identiques/);
  const ambiguous = { ...structuredClone(question), format: { decimals: 2, unit: '' } };
  ambiguous.steps = [{ label: 'Rapport', expression: '18.4 / 6.4' }];
  assert.throws(() => computeOptions(scenario, ambiguous), /mi-chemin/);
});

test('les identifiants des questions initiales sont conservés', () => {
  const ids = new Set(questions.map(({ question }) => question.id));
  for (const id of ORIGINAL_IDS) assert.ok(ids.has(id), `« ${id} » a disparu`);
});

test('au moins 51 questions (le triple de la banque initiale), 3 à 4 par jeu de données, 4 propositions', () => {
  assert.ok(questions.length >= 3 * ORIGINAL_IDS.length, `${questions.length} questions seulement`);
  for (const scenario of bank.scenarios) {
    assert.ok(scenario.questions.length >= 3 && scenario.questions.length <= 4, `« ${scenario.id} » : ${scenario.questions.length} questions`);
    for (const question of scenario.questions) assert.equal(question.options.length, OPTION_LETTERS.length);
  }
});

test('les quatre compétences clés sont travaillées, chacune au moins 3 fois', () => {
  for (const skill of Object.keys(SKILLS)) {
    const count = questions.filter(({ question }) => question.skill === skill).length;
    assert.ok(count >= 3, `« ${skill} » : ${count} questions`);
  }
});

test('les visuels sont variés : tableaux, barres, courbes et secteurs, chacun au moins deux fois', () => {
  for (const display of ['table', 'bar', 'line', 'pie']) {
    const count = bank.scenarios.filter((scenario) => scenario.display === display).length;
    assert.ok(count >= 2, `« ${display} » : ${count} jeu(x) de données`);
  }
});

test('difficulté 1, 2 ou 3 pour chaque question, environ un tiers par niveau', () => {
  for (const level of [1, 2, 3]) {
    const count = questions.filter(({ question }) => question.difficulty === level).length;
    assert.ok(Math.abs(count - questions.length / 3) <= questions.length * 0.07, `niveau ${level} : ${count} sur ${questions.length}`);
  }
});

test('les pièges reproduisent les erreurs typiques : mauvaise base, ligne oubliée, ratio inversé', () => {
  const families = {
    'mauvaise base de pourcentage': /base|dénominateur|valeur d.arrivée|au lieu du total|par rapport à/i,
    'ligne oubliée': /oubli/i,
    'ratio inversé': /invers/i,
  };
  for (const [family, pattern] of Object.entries(families)) {
    const count = questions.filter(({ question }) => question.options.some((option) => pattern.test(option.why ?? ''))).length;
    assert.ok(count >= 10, `« ${family} » : ${count} questions seulement`);
  }
});

/** Structure d'une question : calcul et pièges, données remplacées par « x ». */
const shape = (expression) => expression.replace(/\{[^}]+\}/g, 'x');
const calculationShape = (question) =>
  [question.steps.map((step) => shape(step.expression)).join(' ; '), ...question.options.filter((option) => option.expression).map((option) => shape(option.expression)).sort()].join(' | ');

test('aucun doublon ni quasi-doublon : jeux de données distincts, pas deux questions au même énoncé, au même calcul et aux mêmes pièges', () => {
  const titles = bank.scenarios.map((scenario) => scenario.title);
  assert.equal(new Set(titles).size, titles.length, 'titres en double');
  const datasets = bank.scenarios.map((scenario) => `${scenario.title} ${scenario.rows.map((row) => row.label).join(' ')}`);
  for (let i = 0; i < datasets.length; i += 1) {
    for (let j = i + 1; j < datasets.length; j += 1) {
      assert.ok(similarity(datasets[i], datasets[j]) < 0.3, `jeux trop proches : ${bank.scenarios[i].id} et ${bank.scenarios[j].id}`);
    }
  }
  for (let i = 0; i < questions.length; i += 1) {
    for (let j = i + 1; j < questions.length; j += 1) {
      const [a, b] = [questions[i].question, questions[j].question];
      if (ORIGINAL_IDS.includes(a.id) && ORIGINAL_IDS.includes(b.id)) continue; // banque initiale, inchangée
      if (similarity(a.text, b.text) < 0.45) continue;
      assert.notEqual(calculationShape(a), calculationShape(b), `même énoncé, même calcul et mêmes pièges : ${a.id} et ${b.id}`);
    }
  }
});

test('usage belge : septante et nonante, jamais soixante-dix ni quatre-vingt-dix', () => {
  assert.doesNotMatch(bankText, NON_BELGIAN_NUMERALS);
});

test('chaque proposition fautive correspond à une erreur explicite et recalculable', () => {
  for (const { scenario, question } of questions) {
    question.options.forEach((option, index) => {
      if (index === question.answer) return;
      assert.ok(option.why?.length > 30, `« ${question.id} », ${OPTION_LETTERS[index]} : erreur non expliquée`);
      assert.ok(option.expression, `« ${question.id} », ${OPTION_LETTERS[index]} : calcul de l'erreur manquant`);
      assert.equal(formatAnswer(distractorValue(scenario, question, option), question.format), formatAnswer(option.value, question.format));
    });
  }
});

test('chaque correction détaille données, formule et au moins une étape de calcul', () => {
  for (const { scenario, question } of questions) {
    const { steps } = computeSteps(scenario, question);
    assert.ok(steps.length >= 1);
    assert.ok(usedData(scenario, question).length >= 1, `« ${question.id} » : aucune donnée utilisée`);
    assert.match(question.formula, /=/, `« ${question.id} » : la formule doit être une égalité`);
    for (const step of steps) assert.doesNotMatch(`${step.label} ${step.calculation} ${step.result}`, /undefined|NaN|Infinity/);
  }
});

test('les propositions sont présentées dans l’ordre croissant', () => {
  for (const { question } of questions) {
    const values = question.options.map((option) => option.value);
    assert.deepEqual(values, [...values].sort((a, b) => a - b), `« ${question.id} »`);
  }
});

test('validateBank détecte une bonne réponse fausse, un piège incohérent ou un total erroné', () => {
  const broken = structuredClone(bank);
  const [first] = broken.scenarios;
  first.questions[0].options[first.questions[0].answer].value += 1;
  first.questions[1].options.find((option, index) => index !== first.questions[1].answer).value += 10;
  first.rows.find((row) => row.total).values['2024'] += 1;
  broken.scenarios[1].questions[0].steps[0].expression = '{inconnu.2024} + 1';
  delete broken.scenarios[2].questions[0].difficulty;
  const pie = broken.scenarios.find((scenario) => scenario.display === 'pie');
  pie.pieColumn = 'inconnue';
  const errors = validateBank(broken).join('\n');
  assert.match(errors, /difficulté 1, 2 ou 3 attendue/);
  assert.match(errors, /colonne « inconnue » du graphique en secteurs inconnue/);
  assert.match(errors, /le calcul donne/);
  assert.match(errors, /son calcul donne/);
  assert.match(errors, /le total « 2024 »/);
  assert.match(errors, /Référence inconnue/);
  assert.deepEqual(validateBank({ scenarios: [] }), ['La banque ne contient aucun scénario.']);
});

/* ----- Moteur de calcul ----- */

const values = { 'a.x': 1010, 'a.y': 960, '@r': 1.2 };
const resolve = (name) => values[name];

test('evaluate respecte les priorités et les parenthèses', () => {
  assert.equal(evaluate('1 + 2 * 3 - 4 / 2', resolve), 5);
  assert.equal(evaluate('(1 + 2) * 3', resolve), 9);
  assert.equal(evaluate('2 ^ 3 ^ 2', resolve), 512);
  assert.equal(evaluate('-2 ^ 2', resolve), -4);
  assert.equal(evaluate('3 - -2', resolve), 5);
  assert.ok(Math.abs(evaluate('({a.x} - {a.y}) / {a.y} * 100', resolve) - 5.2083) < 1e-4);
  assert.ok(Math.abs(evaluate('114 * {@r} ^ 2', resolve) - 164.16) < 1e-9);
});

test('evaluate refuse les références inconnues et les expressions invalides (jamais exécutées)', () => {
  assert.throws(() => evaluate('{b.z} + 1', resolve), /Référence inconnue/);
  assert.throws(() => evaluate('2 + * 3', resolve), SyntaxError);
  assert.throws(() => evaluate('(2 + 3', resolve), SyntaxError);
  assert.throws(() => evaluate('alert(1)', resolve), SyntaxError);
  assert.deepEqual(dataReferences('{a.x} + {@r} * {a.y}'), ['a.x', 'a.y']);
});

test('displayExpression rend le calcul lisible (opérateurs et puissances)', () => {
  const format = (name) => String(values[name]).replace('.', ',');
  assert.equal(displayExpression('({a.x} - {a.y}) / {a.y} * 100', format), '(1010 − 960) ÷ 960 × 100');
  assert.equal(displayExpression('114 * {@r} ^ 2', format), '114 × 1,2²');
  assert.equal(displayExpression('-2 + 0.36', format), '−2 + 0,36');
});

test('les nombres sont formatés à la française', () => {
  const nbsp = /[  ]/;
  assert.match(formatNumber(1010), new RegExp(`^1${nbsp.source}010$`));
  assert.equal(formatNumber(7.785, 2), '7,79');
  assert.equal(formatNumber(-1.836, 1, { signed: true }), '−1,8');
  assert.equal(formatNumber(1.836, 1, { signed: true }), '+1,8');
  assert.equal(formatAnswer(5.2083, { decimals: 1, unit: '%' }), '5,2 %');
});

test('computeSteps signale les résultats arrondis par « ≈ »', () => {
  const { scenario, question } = questions.find(({ question: q }) => q.id === 'budget-variation-total');
  const { steps, result } = computeSteps(scenario, question);
  assert.equal(steps[0].calculation, '1 010 − 960');
  assert.equal(steps[0].approximate, false);
  assert.equal(steps[0].result, '50');
  assert.equal(steps[1].approximate, true);
  assert.equal(formatAnswer(result, question.format), '5,2 %');
});

/* ----- Déroulement ----- */

test('une série présente chaque question une fois, jeu de données par jeu de données', () => {
  const steps = buildSteps(bank.scenarios, createSeededRandom(6));
  assert.equal(steps.length, questions.length);
  assert.equal(new Set(steps.map((step) => step.question.id)).size, questions.length);
  steps.forEach((step, i) => {
    const previous = steps[i - 1];
    if (previous && previous.scenario !== step.scenario) assert.equal(step.questionIndex, 0);
    assert.equal(step.scenario.questions[step.questionIndex], step.question);
  });
});

test('summarize compte les réussites par compétence', () => {
  const summary = summarize([
    { skill: 'variation', correct: true },
    { skill: 'ratio', correct: false },
    { skill: 'ratio', correct: true },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.correct, 2);
  assert.deepEqual(summary.bySkill.ratio, { total: 2, correct: 1 });
  assert.deepEqual(summary.bySkill['moyenne-ponderee'], { total: 0, correct: 0 });
});
