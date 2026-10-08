import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ACTION_COUNT,
  COMPETENCIES,
  MAX_POINTS,
  buildSteps,
  expectedPicks,
  isComplete,
  scoreChoice,
  shuffledOrder,
  summarize,
  validateBank,
} from '../assets/js/jugement/quiz.js';
import { createSeededRandom } from '../assets/js/lib/random.js';

const bank = JSON.parse(readFileSync(new URL('../data/jugement.json', import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);
const indexOfRank = (scenario, rank) => scenario.actions.findIndex((action) => action.rank === rank);

/* ----- Banque de situations ----- */

test('la banque est valide : identifiants uniques, rangs 1 à 4, compétences connues', () => {
  assert.deepEqual(validateBank(bank), []);
});

test('au moins 4 situations, chacune avec 4 actions et une explication détaillée par action', () => {
  assert.ok(bank.scenarios.length >= 4, `${bank.scenarios.length} situations seulement`);
  for (const scenario of bank.scenarios) {
    assert.equal(scenario.actions.length, ACTION_COUNT, `« ${scenario.id} »`);
    assert.ok(`${scenario.context} ${scenario.situation.join(' ')}`.length >= 300, `« ${scenario.id} » : situation trop courte`);
    for (const action of scenario.actions) {
      assert.ok(action.explanation.length >= 300, `« ${scenario.id}/${action.id} » : explication trop courte`);
    }
  }
});

test('les compétences clés (problèmes, équipe, résultats) sont travaillées dans plusieurs situations', () => {
  for (const id of ['problemes', 'equipe', 'resultats']) {
    const scenarios = bank.scenarios.filter((scenario) => scenario.actions.some((action) => action.competencies.includes(id)));
    assert.ok(scenarios.length >= 2, `« ${id} » : ${scenarios.length} situation(s)`);
  }
});

test('les thèmes demandés sont couverts : conflit, priorités, hiérarchie', () => {
  const themes = bank.scenarios.map((scenario) => scenario.theme);
  for (const theme of ['Gestion de conflit', 'Relation avec la hiérarchie']) assert.ok(themes.includes(theme), `thème « ${theme} » absent`);
  assert.ok(bank.scenarios.some((scenario) => scenario.competencies.includes('priorites')), 'aucune situation de gestion des priorités');
});

test('validateBank signale les incohérences', () => {
  assert.deepEqual(validateBank({ scenarios: [] }), ['La banque ne contient aucun scénario.']);

  const duplicateRank = clone(bank);
  duplicateRank.scenarios[0].actions[0].rank = duplicateRank.scenarios[0].actions[1].rank;
  assert.match(validateBank(duplicateRank).join('\n'), /les rangs doivent être 1, 2, 3 et 4/);

  const unknownCompetency = clone(bank);
  unknownCompetency.scenarios[1].actions[2].competencies = ['intuition'];
  assert.match(validateBank(unknownCompetency).join('\n'), /compétence « intuition » inconnue/);

  const duplicateId = clone(bank);
  duplicateId.scenarios[1].id = duplicateId.scenarios[0].id;
  assert.match(validateBank(duplicateId).join('\n'), /en double/);

  const missingAction = clone(bank);
  missingAction.scenarios[2].actions.pop();
  assert.match(validateBank(missingAction).join('\n'), /4 actions attendues/);
});

/* ----- Notation par proximité ----- */

test('expectedPicks désigne les actions classées 1re et 4e', () => {
  for (const scenario of bank.scenarios) {
    const { best, worst } = expectedPicks(scenario);
    assert.equal(scenario.actions[best].rank, 1);
    assert.equal(scenario.actions[worst].rank, ACTION_COUNT);
  }
});

test('les choix attendus rapportent le maximum, leurs voisins la moitié, l’inverse zéro', () => {
  const [scenario] = bank.scenarios;
  const rank = (value) => indexOfRank(scenario, value);
  assert.deepEqual(scoreChoice(scenario, { best: rank(1), worst: rank(4) }), { bestPoints: 2, worstPoints: 2, points: MAX_POINTS, max: MAX_POINTS });
  assert.deepEqual(scoreChoice(scenario, { best: rank(2), worst: rank(3) }), { bestPoints: 1, worstPoints: 1, points: 2, max: MAX_POINTS });
  assert.deepEqual(scoreChoice(scenario, { best: rank(1), worst: rank(2) }), { bestPoints: 2, worstPoints: 0, points: 2, max: MAX_POINTS });
  assert.equal(scoreChoice(scenario, { best: rank(4), worst: rank(1) }).points, 0);
  assert.equal(scoreChoice(scenario, { best: rank(3), worst: rank(2) }).points, 0);
});

test('un choix manquant ou une réponse vide vaut zéro', () => {
  const [scenario] = bank.scenarios;
  assert.deepEqual(scoreChoice(scenario, { best: indexOfRank(scenario, 1), worst: null }), { bestPoints: 2, worstPoints: 0, points: 2, max: MAX_POINTS });
  assert.equal(scoreChoice(scenario, {}).points, 0);
  assert.equal(scoreChoice(scenario, null).points, 0);
  assert.equal(scoreChoice(scenario).points, 0);
});

test('toutes les combinaisons : le maximum n’est atteint qu’avec la grille, jamais en dessous de zéro', () => {
  for (const scenario of bank.scenarios) {
    const expected = expectedPicks(scenario);
    for (let best = 0; best < ACTION_COUNT; best += 1) {
      for (let worst = 0; worst < ACTION_COUNT; worst += 1) {
        if (best === worst) continue;
        const { points } = scoreChoice(scenario, { best, worst });
        assert.ok(points >= 0 && points <= MAX_POINTS);
        assert.equal(points === MAX_POINTS, best === expected.best && worst === expected.worst);
      }
    }
  }
});

test('isComplete exige les deux choix', () => {
  assert.equal(isComplete({ best: 0, worst: 3 }), true);
  assert.equal(isComplete({ best: 0, worst: null }), false);
  assert.equal(isComplete({ best: null, worst: 2 }), false);
  assert.equal(isComplete(null), false);
  assert.equal(isComplete({}), false);
});

/* ----- Série et bilan ----- */

test('l’ordre des actions est une permutation aléatoire, reproductible avec une graine', () => {
  const [scenario] = bank.scenarios;
  const orders = new Set();
  for (let seed = 1; seed <= 30; seed += 1) {
    const order = shuffledOrder(scenario, createSeededRandom(seed));
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    orders.add(order.join());
  }
  assert.ok(orders.size > 5, 'les actions doivent être mélangées');
  assert.deepEqual(shuffledOrder(scenario, createSeededRandom(4)), shuffledOrder(scenario, createSeededRandom(4)));
});

test('une série parcourt toutes les situations une seule fois', () => {
  const steps = buildSteps(bank.scenarios, createSeededRandom(9));
  assert.equal(steps.length, bank.scenarios.length);
  assert.equal(new Set(steps.map((step) => step.scenario.id)).size, bank.scenarios.length);
  steps.forEach((step, index) => {
    assert.equal(step.index, index);
    assert.equal(step.count, bank.scenarios.length);
  });
});

test('le bilan totalise les points et les ventile par compétence', () => {
  const [first, second] = bank.scenarios;
  const results = [
    { scenario: first, points: 4, max: MAX_POINTS },
    { scenario: second, points: 1, max: MAX_POINTS },
  ];
  const { points, max, byCompetency } = summarize(results);
  assert.equal(points, 5);
  assert.equal(max, 2 * MAX_POINTS);
  assert.deepEqual(Object.keys(byCompetency).sort(), Object.keys(COMPETENCIES).sort());
  for (const [id, stats] of Object.entries(byCompetency)) {
    const expected = results.filter(({ scenario }) => scenario.competencies.includes(id));
    assert.equal(stats.max, expected.length * MAX_POINTS, id);
    assert.equal(stats.points, expected.reduce((sum, result) => sum + result.points, 0), id);
  }
  assert.deepEqual(summarize([]), { points: 0, max: 0, byCompetency: Object.fromEntries(Object.keys(COMPETENCIES).map((id) => [id, { points: 0, max: 0 }])) });
});
