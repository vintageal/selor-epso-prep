import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SHAPES, describeFigure, figureKey, isValidFigure, renderFigure } from '../assets/js/abstrait/figures.js';
import { OPTION_LETTERS, createQuestion, createQuestionStream, createSeededQuestion } from '../assets/js/abstrait/generator.js';
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
  'cycle-formes': (figures) => {
    const period = figures[0].shape === figures[2].shape ? 2 : 3;
    figures.slice(period).forEach((f, i) => assert.equal(f.shape, figures[i].shape));
    assert.equal(new Set(figures.slice(0, period).map((f) => f.shape)).size, period);
    assert.equal(new Set(figures.map((f) => f.fill)).size, 1);
  },
  cotes: (figures) => {
    const sides = figures.map((f) => SHAPES[f.shape].sides);
    assertConstantStep(sides);
    assert.equal(Math.abs(sides[1] - sides[0]), 1);
    assert.equal(new Set(figures.map((f) => f.fill)).size, 1);
  },
  'rotation-acceleree': (figures) => {
    // Les angles ajoutés (45°, 90°, 135°, 180°) augmentent eux-mêmes d'un pas constant de 45°.
    const steps = figures.slice(1).map((f, i) => f.rotation - figures[i].rotation);
    assertConstantStep(steps, 360);
    assert.ok([45, 315].includes(((steps[1] - steps[0]) % 360 + 360) % 360));
    assert.equal(new Set(figures.map((f) => f.fill)).size, 1);
  },
  'points-couleur': (figures) => {
    assertConstantStep(figures.map((f) => f.dots));
    figures.slice(2).forEach((f, i) => assert.equal(f.fill, figures[i].fill));
    assert.notEqual(figures[0].fill, figures[1].fill);
    assert.equal(new Set(figures.map((f) => f.shape)).size, 1);
  },
};

/** Empreinte des questions d'une règle (série, propositions, bonne réponse, explication), sur 200 graines. */
const fnv = (text) => {
  let hash = 0x811c9dc5;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
};
const fingerprint = (rule) =>
  fnv(
    Array.from({ length: 200 }, (_, i) => createSeededQuestion(rule, (i * 2654435761) % 2 ** 32))
      .map((q) => [q.sequence.map(figureKey).join(';'), q.options.map(figureKey).join(';'), q.correctIndex, q.explanation].join('#'))
      .join('\n'),
  );

/** Règles existantes et empreinte de leurs questions : les identifiants « règle/graine » déjà enregistrés en dépendent. */
const ORIGINAL_FINGERPRINTS = {
  rotation: 'cfcd43a4',
  couleur: '0ff63822',
  points: '6622e014',
  deplacement: '86dbbc4a',
  'rotation-couleur': 'b4d2ad7d',
};

test('les règles existantes produisent exactement les mêmes questions (identifiants stables)', () => {
  for (const [id, expected] of Object.entries(ORIGINAL_FINGERPRINTS)) {
    const rule = RULES.find((candidate) => candidate.id === id);
    assert.ok(rule, `règle « ${id} » disparue`);
    assert.equal(fingerprint(rule), expected, `la génération de la règle « ${id} » a changé`);
  }
});

test('neuf règles, trois par niveau de difficulté (1, 2, 3)', () => {
  assert.ok(RULES.length >= 9, `${RULES.length} règles seulement`);
  assert.equal(new Set(RULES.map((rule) => rule.id)).size, RULES.length, 'identifiants de règle en double');
  for (const level of [1, 2, 3]) {
    assert.equal(RULES.filter((rule) => rule.difficulty === level).length, RULES.length / 3, `niveau ${level}`);
  }
});

test('les polygones réguliers ont le nombre de sommets annoncé', () => {
  for (const shape of Object.values(SHAPES).filter((candidate) => candidate.sides && candidate.svg.startsWith('<polygon'))) {
    const points = /points="([^"]+)"/.exec(shape.svg)[1].trim().split(/\s+/);
    assert.equal(points.length, shape.sides, shape.name);
  }
});

test('chaque règle logique a un invariant testé', () => {
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
