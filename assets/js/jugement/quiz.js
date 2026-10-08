/*
 * Module « Jugement situationnel » : logique de l'exercice, sans dépendance au DOM
 * (réutilisée par le mode examen et testable sous Node).
 *
 * La banque est stockée dans data/jugement.json :
 *   { scenarios: [{ id, title, theme, competency, competencies: [...], difficulty, context,
 *       situation: [...], debrief, actions: [{ id, text, rank: 1 à 4, competencies: [...], explanation }] }] }
 * `competency` est la compétence principale de la situation (elle figure aussi dans `competencies`) ;
 * `difficulty` vaut 1 (facile), 2 (moyen) ou 3 (difficile).
 * `rank` est la place de l'action dans la grille de référence : 1 = la plus adéquate,
 * 4 = la moins adéquate. Le candidat désigne l'action la plus adéquate et la moins adéquate.
 * Les identifiants ne changent jamais : la progression enregistrée des candidats y fait référence.
 */
import { isDifficulty } from '../lib/difficulty.js';
import { t } from '../lib/i18n.js';
import { shuffle } from '../lib/random.js';

export const ACTION_COUNT = 4;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const PICK_POINTS = 2;

/** Points maximum par scénario : 2 pour l'action « plus adéquate », 2 pour la « moins adéquate ». */
export const MAX_POINTS = 2 * PICK_POINTS;

/**
 * Compétences comportementales, inspirées des compétences génériques évaluées lors des
 * sélections européennes (EPSO) et fédérales belges. Libellés et descriptions suivent la langue de la page.
 */
export const COMPETENCIES = Object.fromEntries(
  ['problemes', 'equipe', 'resultats', 'communication', 'priorites', 'service', 'integrite', 'resilience', 'leadership'].map((id) => [
    id,
    {
      get label() {
        return t(`jugement.competencies.${id}.label`);
      },
      get description() {
        return t(`jugement.competencies.${id}.description`);
      },
    },
  ]),
);

/** Libellé de la place d'une action dans la grille de référence (dans la langue de la page). */
export const RANK_LABELS = {};
for (const rank of [1, 2, 3, 4]) Object.defineProperty(RANK_LABELS, rank, { enumerable: true, get: () => t(`jugement.ranks.${rank}`) });

/** Index (dans `scenario.actions`) des actions attendues : la plus et la moins adéquate. */
export const expectedPicks = (scenario) => ({
  best: scenario.actions.findIndex((action) => action.rank === 1),
  worst: scenario.actions.findIndex((action) => action.rank === ACTION_COUNT),
});

/**
 * Points selon la proximité avec la grille de référence (2 points par choix) :
 * - « plus adéquate » : 2 points pour l'action classée 1re, 1 point pour la 2e, 0 sinon ;
 * - « moins adéquate » : 2 points pour l'action classée 4e, 1 point pour la 3e, 0 sinon.
 * Un choix manquant (ou une réponse vide, `null`) vaut 0 point.
 */
export function scoreChoice(scenario, picks) {
  const rankOf = (index) => (Number.isInteger(index) ? scenario.actions[index]?.rank : undefined);
  const bestRank = rankOf(picks?.best);
  const worstRank = rankOf(picks?.worst);
  const bestPoints = bestRank === undefined ? 0 : Math.max(0, PICK_POINTS - (bestRank - 1));
  const worstPoints = worstRank === undefined ? 0 : Math.max(0, PICK_POINTS - (ACTION_COUNT - worstRank));
  return { bestPoints, worstPoints, points: bestPoints + worstPoints, max: MAX_POINTS };
}

/** Vrai si les deux choix (plus et moins adéquate) ont été faits. */
export const isComplete = (picks) => Number.isInteger(picks?.best) && Number.isInteger(picks?.worst);

/** Ordre d'affichage aléatoire des actions (index dans `scenario.actions`), pour éviter tout biais de position. */
export const shuffledOrder = (scenario, random = Math.random) => shuffle(random, scenario.actions.map((_, index) => index));

/** Enchaînement d'une série : scénarios et actions dans un ordre aléatoire. */
export const buildSteps = (scenarios, random = Math.random) =>
  shuffle(random, scenarios).map((scenario, index) => ({
    scenario,
    order: shuffledOrder(scenario, random),
    index,
    count: scenarios.length,
  }));

/** Bilan : points obtenus au total et par compétence (chaque scénario compte pour ses compétences). */
export function summarize(results) {
  const byCompetency = Object.fromEntries(Object.keys(COMPETENCIES).map((id) => [id, { points: 0, max: 0 }]));
  for (const { scenario, points, max } of results) {
    for (const id of scenario.competencies) {
      byCompetency[id].points += points;
      byCompetency[id].max += max;
    }
  }
  return {
    points: results.reduce((sum, result) => sum + result.points, 0),
    max: results.reduce((sum, result) => sum + result.max, 0),
    byCompetency,
  };
}

/** Vérifie la cohérence de la banque et renvoie la liste des erreurs (vide si tout va bien). */
export function validateBank(bank) {
  if (!Array.isArray(bank?.scenarios) || bank.scenarios.length === 0) return ['La banque ne contient aucun scénario.'];

  const errors = [];
  const ids = new Set();
  const registerId = (id, where) => {
    if (typeof id !== 'string' || id === '') errors.push(`${where} : identifiant manquant.`);
    else if (ids.has(id)) errors.push(`${where} : identifiant « ${id} » en double.`);
    else ids.add(id);
  };
  const checkCompetencies = (list, where) => {
    if (!Array.isArray(list) || list.length === 0) errors.push(`${where} : aucune compétence associée.`);
    else list.filter((id) => !COMPETENCIES[id]).forEach((id) => errors.push(`${where} : compétence « ${id} » inconnue.`));
  };

  for (const scenario of bank.scenarios) {
    const where = `Scénario « ${scenario.id} »`;
    registerId(scenario.id, where);
    if (!scenario.title || !scenario.theme || !scenario.context || !scenario.debrief) errors.push(`${where} : titre, thème, contexte ou synthèse manquant.`);
    if (!Array.isArray(scenario.situation) || scenario.situation.length === 0) errors.push(`${where} : situation manquante.`);
    checkCompetencies(scenario.competencies, where);
    if (!scenario.competencies?.includes(scenario.competency)) errors.push(`${where} : compétence principale absente ou hors de la liste des compétences.`);
    if (!isDifficulty(scenario.difficulty)) errors.push(`${where} : difficulté 1, 2 ou 3 attendue.`);
    if (!Array.isArray(scenario.actions) || scenario.actions.length !== ACTION_COUNT) {
      errors.push(`${where} : ${ACTION_COUNT} actions attendues.`);
      continue;
    }
    const ranks = scenario.actions.map((action) => action.rank).sort();
    if (ranks.join() !== '1,2,3,4') errors.push(`${where} : les rangs doivent être 1, 2, 3 et 4 (trouvés : ${ranks.join(', ')}).`);
    for (const action of scenario.actions) {
      const at = `${where}, action « ${action.id} »`;
      registerId(`${scenario.id}/${action.id}`, at);
      if (!action.text || !action.explanation) errors.push(`${at} : texte ou explication manquant.`);
      checkCompetencies(action.competencies, at);
    }
  }
  return errors;
}
