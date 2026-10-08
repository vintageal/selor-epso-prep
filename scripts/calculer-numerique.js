/*
 * Calcule les propositions du raisonnement numérique à partir des données de chaque question
 * (data/numerique.json). Aucune valeur de proposition n'est écrite à la main :
 *
 * - la bonne réponse est le résultat de la dernière étape du calcul (`steps`) ;
 * - chaque proposition fautive est le résultat de son `expression`, qui reproduit une erreur
 *   typique (mauvaise base de pourcentage, ligne oubliée, ratio inversé…) ;
 * - les valeurs sont arrondies au format de la question, les propositions triées par ordre
 *   croissant, et `answer` désigne la bonne (la seule proposition sans `expression`).
 *
 * Usage :
 *   node scripts/calculer-numerique.js          met à jour data/numerique.json
 *   node scripts/calculer-numerique.js --check  échoue si le fichier n'est pas à jour (utilisé par les tests)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { columnFormat, computeSteps, distractorValue, formatAnswer } from '../assets/js/numerique/quiz.js';

export const BANK_PATH = fileURLToPath(new URL('../data/numerique.json', import.meta.url));

/** Arrondi décimal (le petit epsilon évite qu'un 2,45 stocké 2,4499999… soit arrondi à 2,4). */
const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Math.sign(value) * 1e-9) / factor;
};

/** Propositions et index de la bonne réponse, recalculés à partir des données et des expressions. */
export function computeOptions(scenario, question) {
  const decimals = question.format?.decimals ?? 0;
  const correct = question.options.filter((option) => !option.expression);
  if (correct.length !== 1) throw new Error(`« ${question.id} » : une seule proposition sans expression (la bonne réponse) est attendue.`);

  const options = question.options.map((option) => {
    const raw = option.expression ? distractorValue(scenario, question, option) : computeSteps(scenario, question).result;
    if (!Number.isFinite(raw)) throw new Error(`« ${question.id} » : calcul non numérique.`);
    const value = round(raw, decimals);
    // Valeur à mi-chemin entre deux arrondis mal représentée en binaire (18,4 ÷ 6,4 = 2,875 calculé 2,87499…) :
    // la correction afficherait un autre arrondi que la proposition. Il faut alors changer les données.
    if (formatAnswer(value, question.format) !== formatAnswer(raw, question.format)) {
      throw new Error(`« ${question.id} » : ${raw} est à mi-chemin entre deux arrondis ; modifiez les données.`);
    }
    const rest = { ...option };
    delete rest.value;
    return { value, ...rest };
  });
  const values = options.map((option) => option.value);
  if (new Set(values).size !== values.length) throw new Error(`« ${question.id} » : propositions identiques après arrondi (${values.join(' | ')}).`);

  options.sort((a, b) => a.value - b.value);
  return { answer: options.findIndex((option) => !option.expression), options };
}

/** Banque complète recalculée (les clés gardent leur ordre ; `answer` précède `options`). */
export function computeBank(bank) {
  return {
    ...bank,
    scenarios: bank.scenarios.map((scenario) => ({
      ...scenario,
      questions: scenario.questions.map((question) => {
        const { answer, options } = computeOptions(scenario, question);
        const result = {};
        for (const [key, value] of Object.entries(question)) {
          if (key === 'answer' || key === 'options') continue;
          if (key === 'explanation') Object.assign(result, { answer, options });
          result[key] = value;
        }
        return result;
      }),
    })),
  };
}

/* ----- Écriture au format du dépôt : objets sans tableau sur une ligne, nombres avec leurs décimales ----- */

/** Nombre écrit avec au moins `decimals` décimales (5 → « 5.0 » pour un format à une décimale). */
class Fixed {
  constructor(value, decimals) {
    const text = String(value);
    const current = text.includes('.') ? text.split('.')[1].length : 0;
    this.text = current >= decimals ? text : value.toFixed(decimals);
  }
}

const withFixedNumbers = (bank) => ({
  ...bank,
  scenarios: bank.scenarios.map((scenario) => ({
    ...scenario,
    rows: scenario.rows.map((row) => ({
      ...row,
      values: Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, new Fixed(value, columnFormat(scenario, key).decimals)])),
    })),
    questions: scenario.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option, value: new Fixed(option.value, question.format?.decimals ?? 0) })),
    })),
  })),
});

const hasArray = (value) => Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Fixed) && Object.values(value).some(hasArray));

const inline = (value) => {
  if (value instanceof Fixed) return value.text;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
};

const format = (value, indent = '') => {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    return value.length ? `[\n${value.map((item) => inner + format(item, inner)).join(',\n')}\n${indent}]` : '[]';
  }
  if (value !== null && typeof value === 'object' && hasArray(value)) {
    return `{\n${Object.entries(value).map(([key, item]) => `${inner}${JSON.stringify(key)}: ${format(item, inner)}`).join(',\n')}\n${indent}}`;
  }
  return inline(value);
};

/** Texte JSON de la banque, tel qu'il doit figurer dans data/numerique.json. */
export const serialize = (bank) => `${format(withFixedNumbers(bank))}\n`;

/* ----- Ligne de commande ----- */

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = readFileSync(BANK_PATH, 'utf8');
  const expected = serialize(computeBank(JSON.parse(text)));
  if (process.argv.includes('--check')) {
    if (expected !== text) {
      console.error('data/numerique.json n’est pas à jour : lancez « node scripts/calculer-numerique.js ».');
      process.exit(1);
    }
    console.log('data/numerique.json est à jour.');
  } else {
    writeFileSync(BANK_PATH, expected);
    console.log(expected === text ? 'data/numerique.json était déjà à jour.' : 'data/numerique.json mis à jour.');
  }
}
