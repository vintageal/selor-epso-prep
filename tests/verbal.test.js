import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createSeededRandom } from '../assets/js/lib/random.js';
import {
  ANSWERS,
  METHOD_TIPS,
  buildSteps,
  frenchTypography,
  highlightSegments,
  summarize,
  validateBank,
} from '../assets/js/verbal/quiz.js';
import { NON_BELGIAN_NUMERALS, mostSimilarPair, similarity } from './helpers/texte.js';

const bank = JSON.parse(readFileSync(new URL('../data/verbal.json', import.meta.url), 'utf8'));
const statements = bank.passages.flatMap((passage) => passage.statements.map((statement) => ({ passage, statement })));

/* ----- Banque de questions ----- */

test('la banque est valide : identifiants uniques, réponses connues, citations exactes', () => {
  assert.deepEqual(validateBank(bank), []);
});

/** Affirmations de la banque initiale : leurs identifiants ne doivent jamais changer (progression enregistrée). */
const ORIGINAL_IDS = [
  'teletravail-accueil', 'teletravail-silence', 'teletravail-majorite', 'teletravail-indemnite',
  'inflation-energie', 'inflation-recul-pouvoir-achat', 'inflation-prevision', 'inflation-menages-modestes',
  'air-toxicite', 'air-capteurs', 'air-ventilation', 'air-absenteisme',
  'documents-justification', 'documents-delai', 'documents-acces-partiel', 'documents-statistiques',
  'pollinisateurs-zones', 'pollinisateurs-pesticides', 'pollinisateurs-cultures', 'pollinisateurs-revenus',
];

test('les identifiants des affirmations initiales sont conservés', () => {
  const ids = new Set(statements.map(({ statement }) => statement.id));
  for (const id of ORIGINAL_IDS) assert.ok(ids.has(id), `« ${id} » a disparu`);
});

test('au moins 60 affirmations (le triple de la banque initiale), 3 à 4 par texte', () => {
  assert.ok(statements.length >= 3 * ORIGINAL_IDS.length, `${statements.length} affirmations seulement`);
  for (const passage of bank.passages) {
    assert.ok(passage.statements.length >= 3 && passage.statements.length <= 4, `« ${passage.id} » : ${passage.statements.length} affirmations`);
  }
});

test('chaque citation est une phrase complète et exacte du texte', () => {
  for (const { passage, statement } of statements) {
    for (const quote of statement.quotes) {
      const paragraph = passage.paragraphs.find((candidate) => candidate.includes(quote));
      const before = paragraph.slice(0, paragraph.indexOf(quote)).trimEnd();
      assert.match(quote, /^[A-ZÀ-Ý]/, `« ${statement.id} » : la citation doit commencer une phrase`);
      assert.match(quote, /[.!?]$/, `« ${statement.id} » : la citation doit finir une phrase`);
      assert.ok(before === '' || /[.!?]$/.test(before), `« ${statement.id} » : la citation doit débuter au début d'une phrase`);
    }
  }
});

test('les trois réponses sont représentées de façon équilibrée (environ un tiers chacune)', () => {
  for (const { id } of ANSWERS) {
    const count = statements.filter(({ statement }) => statement.answer === id).length;
    assert.ok(Math.abs(count - statements.length / 3) <= statements.length * 0.05, `« ${id} » : ${count} sur ${statements.length}`);
  }
});

test('difficulté 1, 2 ou 3 pour chaque affirmation, environ un tiers par niveau', () => {
  for (const level of [1, 2, 3]) {
    const count = statements.filter(({ statement }) => statement.difficulty === level).length;
    assert.ok(Math.abs(count - statements.length / 3) <= statements.length * 0.07, `niveau ${level} : ${count} sur ${statements.length}`);
  }
  for (const passage of bank.passages) {
    const levels = new Set(passage.statements.map((statement) => statement.difficulty));
    assert.ok(levels.size >= 2, `« ${passage.id} » : toutes les affirmations ont le même niveau`);
  }
});

test('« On ne peut pas savoir » : l’explication établit que le texte ne permet pas de trancher', () => {
  for (const { statement } of statements.filter(({ statement }) => statement.answer === 'impossible')) {
    assert.match(statement.explanation, /on ne peut (donc )?pas savoir/i, `« ${statement.id} »`);
  }
});

test('aucun doublon ni quasi-doublon : titres, textes et affirmations', () => {
  const titles = bank.passages.map((passage) => passage.title);
  assert.equal(new Set(titles).size, titles.length, 'titres en double');
  const closest = mostSimilarPair(bank.passages.map((passage) => passage.paragraphs.join(' ')));
  assert.ok(closest.score < 0.3, `textes trop proches : ${bank.passages[closest.i]?.id} et ${bank.passages[closest.j]?.id}`);
  for (let i = 0; i < statements.length; i += 1) {
    for (let j = i + 1; j < statements.length; j += 1) {
      const [a, b] = [statements[i], statements[j]];
      const limit = a.passage === b.passage ? 0.5 : 0.4;
      assert.ok(similarity(a.statement.text, b.statement.text) < limit, `affirmations trop proches : ${a.statement.id} et ${b.statement.id}`);
    }
  }
});

test('usage belge : septante et nonante, jamais soixante-dix ni quatre-vingt-dix', () => {
  assert.doesNotMatch(JSON.stringify(bank), NON_BELGIAN_NUMERALS);
});

test('chaque explication est détaillée et cite le texte', () => {
  for (const { statement } of statements) {
    assert.ok(statement.explanation.length >= 300, `« ${statement.id} » : explication trop courte`);
    assert.match(statement.explanation, /« [^»]+ »/, `« ${statement.id} » : l'explication doit citer le texte entre guillemets`);
  }
});

test('la typographie des données est propre (pas d’espaces doubles ni superflues)', () => {
  const texts = bank.passages.flatMap((passage) => [
    passage.title,
    ...passage.paragraphs,
    ...passage.statements.flatMap((statement) => [statement.text, statement.explanation, ...statement.quotes]),
  ]);
  for (const text of texts) {
    assert.equal(text, text.trim(), `espaces en bordure : « ${text.slice(0, 40)}… »`);
    assert.doesNotMatch(text, / {2}/, `espace double : « ${text.slice(0, 40)}… »`);
  }
});

/* ----- Validation ----- */

test('validateBank détecte une citation inexacte ou un identifiant en double', () => {
  const broken = structuredClone(bank);
  broken.passages[0].statements[0].quotes[0] += ' (modifié)';
  broken.passages[1].statements[0].id = broken.passages[0].statements[1].id;
  broken.passages[2].statements[0].answer = 'peut-être';
  delete broken.passages[3].statements[0].difficulty;
  const errors = validateBank(broken);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /difficulté 1, 2 ou 3 attendue/);
  assert.match(errors.join('\n'), /citation introuvable/);
  assert.match(errors.join('\n'), /en double/);
  assert.match(errors.join('\n'), /réponse « peut-être » invalide/);
  assert.deepEqual(validateBank({ passages: [] }), ['La banque ne contient aucun texte.']);
});

/* ----- Logique de l'exercice ----- */

test('une série présente chaque affirmation une fois, texte par texte', () => {
  const steps = buildSteps(bank.passages, createSeededRandom(4));
  assert.equal(steps.length, statements.length);
  assert.equal(new Set(steps.map((step) => step.statement.id)).size, statements.length);
  steps.forEach((step, i) => {
    assert.ok(step.passage.statements.includes(step.statement));
    const previous = steps[i - 1];
    if (previous && previous.passage !== step.passage) {
      assert.equal(step.passageIndex, previous.passageIndex + 1);
      assert.equal(step.statementIndex, 0);
    }
  });
  assert.deepEqual(buildSteps(bank.passages, createSeededRandom(4)), steps, 'reproductible avec une même graine');
});

test('highlightSegments isole les citations, y compris multiples ou chevauchantes', () => {
  const paragraph = 'Phrase un. Phrase deux. Phrase trois.';
  const join = (segments) => segments.map((segment) => segment.text).join('');
  const marked = (segments) => segments.filter((segment) => segment.highlighted).map((segment) => segment.text);

  const single = highlightSegments(paragraph, ['Phrase deux.']);
  assert.equal(join(single), paragraph);
  assert.deepEqual(marked(single), ['Phrase deux.']);

  assert.deepEqual(marked(highlightSegments(paragraph, ['Phrase trois.', 'Phrase un.'])), ['Phrase un.', 'Phrase trois.']);
  assert.deepEqual(marked(highlightSegments(paragraph, ['Phrase un. Phrase deux.', 'Phrase deux. Phrase trois.'])), [paragraph]);
  assert.deepEqual(highlightSegments(paragraph, ['Absente.']), [{ text: paragraph, highlighted: false }]);
});

test('frenchTypography insère les espaces insécables attendues', () => {
  assert.equal(frenchTypography('Vrai ? « Oui » : 1 000 ppm, 6,2 % ; bien !'), 'Vrai ? « Oui » : 1 000 ppm, 6,2 % ; bien !');
});

test('summarize compte les réussites par type de réponse attendue', () => {
  const summary = summarize([
    { expected: 'vrai', correct: true },
    { expected: 'impossible', correct: false },
    { expected: 'impossible', correct: true },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.correct, 2);
  assert.deepEqual(summary.byAnswer, {
    vrai: { total: 1, correct: 1 },
    faux: { total: 0, correct: 0 },
    impossible: { total: 2, correct: 1 },
  });
});

test('chaque type de réponse a un libellé, un raccourci unique et un rappel de méthode', () => {
  const keys = ANSWERS.flatMap((answer) => answer.keys);
  assert.equal(new Set(keys).size, keys.length);
  for (const { id, label } of ANSWERS) {
    assert.ok(label);
    assert.ok(METHOD_TIPS[id]);
  }
  assert.equal(ANSWERS.find((answer) => answer.id === 'impossible').label, 'On ne peut pas savoir');
});
