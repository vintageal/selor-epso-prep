import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeFigure, figureKey, isValidFigure, renderFigure } from '../assets/js/abstrait/figures.js';
import { OPTION_LETTERS, createQuestion, createQuestionStream } from '../assets/js/abstrait/generator.js';
import { RULES, SEQUENCE_LENGTH } from '../assets/js/abstrait/rules.js';
import { createSeededRandom } from '../assets/js/lib/random.js';

const SAMPLES = 500;

const sampleQuestions = (rule, seed = 1) => {
  const random = createSeededRandom(seed);
  return Array.from({ length: SAMPLES }, () => createQuestion(rule, random));
};

/** Vérifie que `values` progresse d'un pas constant (modulo `modulo` si fourni). */
const assertConstantStep = (values, modulo) => {
  const normalize = (value) => (modulo ? ((value % modulo) + modulo) % modulo : value);
  const step = normalize(values[1] - values[0]);
  values.slice(1).forEach((value, i) => {
    assert.equal(normalize(value - values[i]), step, `pas constant attendu dans ${values.join(', ')}`);
  });
};

/** Invariant propre à chaque règle, vérifié sur la série complétée par la réponse. */
const RULE_INVARIANTS = {
  rotation: (figures) => {
    assertConstantStep(figures.map((f) => f.rotation), 360);
    assert.equal(new Set(figures.map((f) => f.fill)).size, 1);
  },
  couleur: (figures) => {
    const period = figures[0].fill === figures[2].fill ? 2 : 3;
    figures.slice(period).forEach((f, i) => assert.equal(f.fill, figures[i].fill));
    assert.equal(new Set(figures.map((f) => f.shape)).size, 1);
  },
  points: (figures) => {
    assertConstantStep(figures.map((f) => f.dots));
    assert.equal(new Set(figures.map((f) => f.shape)).size, 1);
  },
  deplacement: (figures) => {
    assertConstantStep(figures.map((f) => f.marker), 8);
    assert.equal(new Set(figures.map((f) => f.shape)).size, 1);
  },
  'rotation-couleur': (figures) => {
    assertConstantStep(figures.map((f) => f.rotation), 360);
    figures.slice(2).forEach((f, i) => assert.equal(f.fill, figures[i].fill));
    assert.notEqual(figures[0].fill, figures[1].fill);
  },
};

test('au moins trois règles logiques, chacune avec un invariant testé', () => {
  assert.ok(RULES.length >= 3);
  RULES.forEach((rule) => assert.ok(RULE_INVARIANTS[rule.id], `invariant manquant pour « ${rule.id} »`));
});

for (const rule of RULES) {
  test(`règle « ${rule.id} » : questions bien formées`, () => {
    for (const question of sampleQuestions(rule)) {
      assert.equal(question.sequence.length, SEQUENCE_LENGTH);
      assert.equal(question.options.length, OPTION_LETTERS.length);
      [...question.sequence, ...question.options].forEach((figure) => assert.ok(isValidFigure(figure)));

      const keys = question.options.map(figureKey);
      assert.equal(new Set(keys).size, keys.length, 'les propositions doivent être distinctes');
      const labels = question.options.map(describeFigure);
      assert.equal(new Set(labels).size, labels.length, 'les descriptions (lecteurs d’écran) doivent être distinctes');

      assert.equal(keys.indexOf(figureKey(question.answer)), question.correctIndex, 'une seule bonne réponse');
      assert.ok(question.explanation.length > 40);
      assert.doesNotMatch(question.explanation, /undefined|NaN/);
    }
  });

  test(`règle « ${rule.id} » : la réponse prolonge la série`, () => {
    for (const question of sampleQuestions(rule, 7)) {
      RULE_INVARIANTS[rule.id]([...question.sequence, question.answer]);
    }
  });
}

test('le générateur est reproductible avec une même graine', () => {
  const first = createQuestionStream(createSeededRandom(123));
  const second = createQuestionStream(createSeededRandom(123));
  for (let i = 0; i < 20; i += 1) assert.deepEqual(first(), second());
});

test('le flux varie les règles sans jamais répéter deux fois la même', () => {
  const next = createQuestionStream(createSeededRandom(99));
  const ids = Array.from({ length: 200 }, () => next().ruleId);
  ids.slice(1).forEach((id, i) => assert.notEqual(id, ids[i]));
  assert.deepEqual(new Set(ids.slice(0, RULES.length)), new Set(RULES.map((rule) => rule.id)));
});

test('le rendu SVG est autonome et complet', () => {
  for (const rule of RULES) {
    const question = createQuestion(rule, createSeededRandom(5));
    for (const figure of [...question.sequence, ...question.options]) {
      const svg = renderFigure(figure);
      assert.match(svg, /^<svg viewBox="0 0 100 100"[^>]*>.*<\/svg>$/);
      assert.doesNotMatch(svg, /undefined|NaN|href=/);
      assert.equal((svg.match(/<circle [^>]*r="3.5"/g) ?? []).length, figure.dots);
    }
  }
});
