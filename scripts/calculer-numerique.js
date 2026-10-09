/*
 * Calcule les propositions du raisonnement numérique à partir des données de chaque question,
 * dans les deux langues : data/numerique.json (français) et data/nl/numerique.json (néerlandais).
 * Aucune valeur de proposition n'est écrite à la main :
 *
 * - la bonne réponse est le résultat de la dernière étape du calcul (`steps`) ;
 * - chaque proposition fautive est le résultat de son `expression`, qui reproduit une erreur
 *   typique (mauvaise base de pourcentage, ligne oubliée, ratio inversé…) ;
 * - les valeurs sont arrondies au format de la question, les propositions triées par ordre
 *   croissant, et `answer` désigne la bonne (la seule proposition sans `expression`).
 *
 * La banque néerlandaise doit avoir exactement les mêmes calculs que la française : mêmes jeux de
 * données, mêmes valeurs, mêmes expressions, mêmes formats et mêmes réponses. Seuls les textes
 * (titres, libellés, unités, énoncés, explications) diffèrent ; le script refuse tout autre écart.
 *
 * Usage :
 *   node scripts/calculer-numerique.js          met à jour les deux banques
 *   node scripts/calculer-numerique.js --check  échoue si une banque n'est pas à jour ou si les calculs diffèrent
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { columnFormat, computeSteps, dataValue, distractorValue, evaluate, formatAnswer } from '../assets/js/numerique/quiz.js';

export const BANK_PATH = fileURLToPath(new URL('../data/numerique.json', import.meta.url));
export const NL_BANK_PATH = fileURLToPath(new URL('../data/nl/numerique.json', import.meta.url));

/** Champs de texte, propres à chaque langue ; tout le reste doit être identique dans les deux banques. */
const TEXT_KEYS = new Set(['title', 'theme', 'note', 'rowHeader', 'unit', 'label', 'text', 'formula', 'why', 'explanation']);

/** Réglages d'affichage propres à une langue, qui peuvent ne figurer que dans une banque (format.displayScale). */
const DISPLAY_KEYS = new Set(['displayScale']);

/**
 * Écarts de calcul entre la banque française et sa traduction (liste vide si elles concordent) :
 * même structure, mêmes clés, mêmes nombres, mêmes expressions ; seuls les champs de TEXT_KEYS et DISPLAY_KEYS
 * peuvent différer.
 */
export function calculationDifferences(french, translated, path = 'banque') {
  if (Array.isArray(french) || Array.isArray(translated)) {
    if (!Array.isArray(french) || !Array.isArray(translated) || french.length !== translated.length) return [`${path} : nombre d'éléments différent`];
    return french.flatMap((item, index) => calculationDifferences(item, translated[index], `${path}[${item?.id ?? item?.key ?? index}]`));
  }
  if (french !== null && typeof french === 'object') {
    if (translated === null || typeof translated !== 'object') return [`${path} : structure différente`];
    const keys = [...new Set([...Object.keys(french), ...Object.keys(translated)])];
    return keys.flatMap((key) => {
      if (DISPLAY_KEYS.has(key)) return [];
      if (!(key in french) || !(key in translated)) return [`${path}.${key} : présent dans une seule langue`];
      if (TEXT_KEYS.has(key)) return typeof translated[key] === typeof french[key] ? [] : [`${path}.${key} : texte manquant`];
      return calculationDifferences(french[key], translated[key], `${path}.${key}`);
    });
  }
  return Object.is(french, translated) ? [] : [`${path} : ${JSON.stringify(french)} ≠ ${JSON.stringify(translated)}`];
}

/** Arrondi décimal (le petit epsilon évite qu'un 2,45 stocké 2,4499999… soit arrondi à 2,4). */
const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Math.sign(value) * 1e-9) / factor;
};

/**
 * Résultat du calcul refait avec les résultats intermédiaires tels que la correction les affiche
 * (arrondis à deux décimales). Il doit mener à la même réponse, sinon le calcul affiché
 * contredirait la bonne réponse (par exemple « 820 × 0,9³ » pour un coefficient de 0,896).
 */
export function displayedResult(scenario, question) {
  const shown = {};
  let result;
  for (const step of question.steps) {
    result = evaluate(step.expression, (name) => (name.startsWith('@') ? shown[name.slice(1)] : dataValue(scenario, name)));
    if (step.id) shown[step.id] = Math.round(result * 100) / 100;
  }
  return result;
}

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
  const shownResult = formatAnswer(displayedResult(scenario, question), question.format);
  const correctValue = options.find((option) => !option.expression).value;
  if (shownResult !== formatAnswer(correctValue, question.format)) {
    throw new Error(`« ${question.id} » : refait avec les résultats intermédiaires affichés, le calcul donne ${shownResult}.`);
  }

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
  const check = process.argv.includes('--check');
  let failed = false;
  const banks = {};
  for (const [name, path] of [['data/numerique.json', BANK_PATH], ['data/nl/numerique.json', NL_BANK_PATH]]) {
    const text = readFileSync(path, 'utf8');
    const expected = serialize(computeBank(JSON.parse(text)));
    banks[name] = JSON.parse(expected);
    if (check) {
      if (expected !== text) {
        console.error(`${name} n’est pas à jour : lancez « node scripts/calculer-numerique.js ».`);
        failed = true;
      } else console.log(`${name} est à jour.`);
    } else {
      writeFileSync(path, expected);
      console.log(expected === text ? `${name} était déjà à jour.` : `${name} mis à jour.`);
    }
  }
  const differences = calculationDifferences(banks['data/numerique.json'], banks['data/nl/numerique.json']);
  if (differences.length) {
    console.error(`Les calculs de la banque néerlandaise diffèrent de la banque française :\n  ${differences.slice(0, 20).join('\n  ')}`);
    failed = true;
  } else console.log('Les deux langues ont exactement les mêmes calculs et les mêmes réponses.');
  if (failed) process.exit(1);
}
