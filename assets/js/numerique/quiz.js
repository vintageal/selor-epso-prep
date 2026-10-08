/*
 * Module « Raisonnement numérique » : logique de l'exercice, sans dépendance au DOM
 * (réutilisée par le mode examen et testable sous Node).
 *
 * La banque est stockée dans data/numerique.json :
 *   { scenarios: [{ id, title, theme, display: 'table' | 'bar' | 'line', unit, decimals?,
 *       columns: [{ key, label, unit?, decimals? }],
 *       rows: [{ key, label, total?, values: { <colonne>: nombre } }],
 *       questions: [{ id, skill, text, formula, steps: [{ id?, label, expression }],
 *         format: { decimals, unit?, signed? }, answer, options: [{ value, why?, expression? }],
 *         explanation }] }] }
 *
 * Les expressions de calcul sont écrites en clair, par exemple
 * « ({total.2024} - {total.2023}) / {total.2023} * 100 » : {ligne.colonne} renvoie à une
 * donnée du tableau, {@etape} au résultat d'une étape précédente. Elles sont évaluées
 * (jamais exécutées comme du code) : le calcul affiché et la bonne réponse découlent
 * donc toujours des données.
 */
import { shuffle } from '../lib/random.js';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** Compétences évaluées, avec le rappel de méthode affiché dans la correction. */
export const SKILLS = {
  variation: {
    label: 'Taux de variation',
    tip: "Un taux de variation se calcule toujours par rapport à la valeur de départ : (arrivée − départ) ÷ départ × 100.",
  },
  ratio: {
    label: 'Ratio et proportion',
    tip: "Identifiez précisément ce qui est au numérateur (la partie) et au dénominateur (le tout ou la référence) avant de diviser.",
  },
  'moyenne-ponderee': {
    label: 'Moyenne pondérée',
    tip: "Quand les groupes n'ont pas la même taille, la moyenne des moyennes est fausse : chaque valeur doit être pondérée par son effectif.",
  },
  extrapolation: {
    label: 'Extrapolation de tendance',
    tip: "Distinguez une hausse constante en valeur (on ajoute le même montant chaque année) d'une hausse constante en pourcentage (on multiplie par le même coefficient).",
  },
};

/* ----- Expressions ----- */

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|\{(@?[\w-]+(?:\.[\w-]+)?)\}|([-+*/^()]))/y;

/** Découpe une expression en jetons : nombres, références et opérateurs. */
export function tokenize(expression) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < expression.length) {
    if (/^\s*$/.test(expression.slice(TOKEN.lastIndex))) break;
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(expression);
    if (!match) throw new SyntaxError(`Expression invalide près de « ${expression.slice(start).trim()} »`);
    const [, number, reference, operator] = match;
    if (number !== undefined) tokens.push({ type: 'number', value: Number(number), text: number });
    else if (reference !== undefined) tokens.push({ type: 'ref', name: reference });
    else tokens.push({ type: 'op', value: operator });
  }
  return tokens;
}

/**
 * Évalue une expression arithmétique (+ − × ÷ puissance, parenthèses).
 * `resolve(nom)` renvoie la valeur d'une référence ; une référence inconnue lève une erreur.
 */
export function evaluate(expression, resolve) {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const isOp = (value) => peek()?.type === 'op' && peek().value === value;
  const expect = (value) => {
    if (!isOp(value)) throw new SyntaxError(`« ${value} » attendu dans « ${expression} »`);
    position += 1;
  };

  const primary = () => {
    const token = peek();
    if (!token) throw new SyntaxError(`Expression incomplète : « ${expression} »`);
    if (token.type === 'number') {
      position += 1;
      return token.value;
    }
    if (token.type === 'ref') {
      position += 1;
      const value = resolve(token.name);
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new ReferenceError(`Référence inconnue : {${token.name}}`);
      return value;
    }
    if (isOp('(')) {
      position += 1;
      const value = sum();
      expect(')');
      return value;
    }
    throw new SyntaxError(`Jeton inattendu « ${token.value} » dans « ${expression} »`);
  };
  // Priorités usuelles : la puissance avant le moins unaire (−2² = −4), puis × ÷, puis + −.
  const power = () => {
    const base = primary();
    if (isOp('^')) {
      position += 1;
      return base ** unary();
    }
    return base;
  };
  function unary() {
    if (isOp('-')) {
      position += 1;
      return -unary();
    }
    return power();
  }
  const product = () => {
    let value = unary();
    while (isOp('*') || isOp('/')) {
      const operator = peek().value;
      position += 1;
      const right = unary();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  function sum() {
    let value = product();
    while (isOp('+') || isOp('-')) {
      const operator = peek().value;
      position += 1;
      const right = product();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = sum();
  if (position !== tokens.length) throw new SyntaxError(`Jeton inattendu dans « ${expression} »`);
  return result;
}

/** Références {ligne.colonne} utilisées par une expression (sans les résultats d'étapes). */
export const dataReferences = (expression) =>
  tokenize(expression).filter((token) => token.type === 'ref' && !token.name.startsWith('@')).map((token) => token.name);

/* ----- Nombres ----- */

const formatters = new Map();
const formatter = (decimals, signed) => {
  const key = `${decimals}|${signed}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('fr-BE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }),
    );
  }
  return formatters.get(key);
};

/** Nombre à la française : « 1 010 », « 7,8 », signe moins typographique « − ». */
export const formatNumber = (value, decimals = 0, { signed = false } = {}) =>
  formatter(decimals, signed).format(value).replace('-', '−');

const withUnit = (text, unit) => (unit ? `${text} ${unit}` : text);

/** Valeur d'une proposition ou d'un résultat, au format de la question. */
export const formatAnswer = (value, { decimals = 0, unit = '', signed = false }) =>
  withUnit(formatNumber(value, decimals, { signed }), unit);

/** Affichage d'un résultat intermédiaire : entier exact, sinon arrondi à 2 décimales (« ≈ »). */
const formatIntermediate = (value) => {
  const rounded = Math.round(value * 100) / 100;
  const decimals = Number.isInteger(rounded) ? 0 : Math.abs(rounded * 10 - Math.round(rounded * 10)) < 1e-9 ? 1 : 2;
  return { text: formatNumber(rounded, decimals), approximate: Math.abs(rounded - value) > 1e-9 };
};

const SUPERSCRIPTS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const OPERATORS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * Version lisible d'une expression, références remplacées par leur valeur formatée
 * (`formatReference(nom)`) : « ({total.2024} - {total.2023}) / {total.2023} * 100 »
 * devient « (1 010 − 960) ÷ 960 × 100 ».
 */
export function displayExpression(expression, formatReference) {
  const tokens = tokenize(expression);
  const isPower = (token) => token?.type === 'op' && token.value === '^';
  let text = '';
  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    if (isPower(token)) {
      if (tokens[index + 1]?.type !== 'number') text += '^';
      return;
    }
    if (isPower(previous) && token.type === 'number') {
      text += token.text.replace(/\d/g, (digit) => SUPERSCRIPTS[digit]);
      return;
    }
    if (token.type === 'number') text += formatNumber(token.value, (token.text.split('.')[1] ?? '').length);
    else if (token.type === 'ref') text += formatReference(token.name);
    else if (token.value === '(') text += '(';
    else if (token.value === ')') text += ')';
    else {
      const isUnary = token.value === '-' && (!previous || (previous.type === 'op' && previous.value !== ')'));
      text += isUnary ? '−' : ` ${OPERATORS[token.value]} `;
    }
  });
  return text;
}

/* ----- Scénarios et questions ----- */

const findRow = (scenario, key) => scenario.rows.find((row) => row.key === key);
const findColumn = (scenario, key) => scenario.columns.find((column) => column.key === key);

/** Valeur d'une donnée {ligne.colonne}, ou undefined si elle n'existe pas. */
export const dataValue = (scenario, reference) => {
  const [rowKey, columnKey] = reference.split('.');
  return findRow(scenario, rowKey)?.values[columnKey];
};

/** Unité et décimales d'une colonne (à défaut, celles du scénario). */
export const columnFormat = (scenario, columnKey) => {
  const column = findColumn(scenario, columnKey) ?? {};
  return { unit: column.unit ?? scenario.unit ?? '', decimals: column.decimals ?? scenario.decimals ?? 0 };
};

/** Donnée formatée pour l'affichage (tableau, graphique, correction). */
export const formatData = (scenario, columnKey, value, { withUnits = true } = {}) => {
  const { unit, decimals } = columnFormat(scenario, columnKey);
  const text = formatNumber(value, decimals);
  return withUnits ? withUnit(text, unit) : text;
};

/**
 * Calcul détaillé d'une question : chaque étape avec son expression chiffrée et
 * son résultat. `values` contient les résultats par identifiant d'étape.
 */
export function computeSteps(scenario, question) {
  const values = {};
  const resolve = (name) => (name.startsWith('@') ? values[name.slice(1)] : dataValue(scenario, name));
  const formatReference = (name) =>
    name.startsWith('@')
      ? formatIntermediate(values[name.slice(1)]).text
      : formatData(scenario, name.split('.')[1], dataValue(scenario, name), { withUnits: false });
  const steps = question.steps.map((step) => {
    const value = evaluate(step.expression, resolve);
    const calculation = displayExpression(step.expression, formatReference);
    if (step.id) values[step.id] = value;
    const { text, approximate } = formatIntermediate(value);
    return { label: step.label, calculation, result: text, approximate, value };
  });
  return { steps, result: steps.at(-1)?.value, values };
}

/** Données du tableau utilisées par le calcul, dans l'ordre d'apparition. */
export function usedData(scenario, question) {
  const references = [...new Set(question.steps.flatMap((step) => dataReferences(step.expression)))];
  return references.map((reference) => {
    const [rowKey, columnKey] = reference.split('.');
    return {
      reference,
      label: `${findRow(scenario, rowKey).label} — ${findColumn(scenario, columnKey).label}`,
      value: formatData(scenario, columnKey, dataValue(scenario, reference)),
    };
  });
}

/** Valeur d'une proposition « fautive » recalculée à partir de son expression (si fournie). */
export function distractorValue(scenario, question, option) {
  const { values } = computeSteps(scenario, question);
  return evaluate(option.expression, (name) => (name.startsWith('@') ? values[name.slice(1)] : dataValue(scenario, name)));
}

/**
 * Enchaînement d'une série : scénarios dans un ordre aléatoire, questions
 * dans l'ordre prévu (elles vont souvent du plus simple au plus complexe).
 */
export function buildSteps(scenarios, random = Math.random) {
  return shuffle(random, scenarios).flatMap((scenario, scenarioIndex) =>
    scenario.questions.map((question, questionIndex) => ({
      scenario,
      question,
      scenarioIndex,
      scenarioCount: scenarios.length,
      questionIndex,
      questionCount: scenario.questions.length,
    })),
  );
}

/**
 * Étapes d'une révision : les questions demandées, regroupées par jeu de données
 * (dans l'ordre de la banque au sein d'un même jeu). Les identifiants inconnus sont ignorés.
 */
export function buildReviewSteps(scenarios, questionIds) {
  const wanted = new Set(questionIds);
  const groups = scenarios
    .map((scenario) => ({ scenario, questions: scenario.questions.filter((question) => wanted.has(question.id)) }))
    .filter(({ questions }) => questions.length > 0);
  return groups.flatMap(({ scenario, questions }, scenarioIndex) =>
    questions.map((question, questionIndex) => ({
      scenario,
      question,
      scenarioIndex,
      scenarioCount: groups.length,
      questionIndex,
      questionCount: questions.length,
    })),
  );
}

/** Bilan d'une série par compétence. */
export function summarize(results) {
  const bySkill = Object.fromEntries(Object.keys(SKILLS).map((skill) => [skill, { total: 0, correct: 0 }]));
  for (const { skill, correct } of results) {
    bySkill[skill].total += 1;
    if (correct) bySkill[skill].correct += 1;
  }
  return { total: results.length, correct: results.filter((result) => result.correct).length, bySkill };
}

/* ----- Validation de la banque ----- */

/**
 * Vérifie la cohérence de la banque et renvoie la liste des erreurs (vide si tout va bien).
 * Contrôles clés : chaque calcul s'évalue à partir des données, la bonne proposition
 * correspond au résultat arrondi, les propositions fautives correspondent à l'erreur décrite,
 * et les lignes « total » sont bien la somme des autres lignes.
 */
export function validateBank(bank) {
  if (!Array.isArray(bank?.scenarios) || bank.scenarios.length === 0) return ['La banque ne contient aucun scénario.'];

  const errors = [];
  const ids = new Set();
  const registerId = (id, where) => {
    if (typeof id !== 'string' || id === '') errors.push(`${where} : identifiant manquant.`);
    else if (ids.has(id)) errors.push(`${where} : identifiant « ${id} » en double.`);
    else ids.add(id);
  };

  for (const scenario of bank.scenarios) {
    const where = `Scénario « ${scenario.id} »`;
    registerId(scenario.id, where);
    if (!scenario.title || !scenario.theme) errors.push(`${where} : titre ou thème manquant.`);
    if (!['table', 'bar', 'line'].includes(scenario.display)) errors.push(`${where} : affichage « ${scenario.display} » inconnu.`);
    if (!scenario.columns?.length || !scenario.rows?.length) {
      errors.push(`${where} : colonnes ou lignes manquantes.`);
      continue;
    }
    for (const row of scenario.rows) {
      for (const { key } of scenario.columns) {
        if (typeof row.values?.[key] !== 'number') errors.push(`${where} : valeur manquante pour « ${row.key}.${key} ».`);
      }
      if (row.total) {
        for (const { key } of scenario.columns) {
          const sum = scenario.rows.filter((other) => !other.total).reduce((total, other) => total + other.values[key], 0);
          if (Math.abs(sum - row.values[key]) > 1e-9) errors.push(`${where} : le total « ${key} » vaut ${row.values[key]} au lieu de ${sum}.`);
        }
      }
    }

    for (const question of scenario.questions ?? []) {
      const at = `${where}, question « ${question.id} »`;
      registerId(question.id, at);
      if (!SKILLS[question.skill]) errors.push(`${at} : compétence « ${question.skill} » inconnue.`);
      if (!question.text || !question.formula || !question.explanation) errors.push(`${at} : énoncé, formule ou explication manquant.`);
      if (!Array.isArray(question.options) || question.options.length !== OPTION_LETTERS.length) {
        errors.push(`${at} : ${OPTION_LETTERS.length} propositions attendues.`);
        continue;
      }
      if (!Number.isInteger(question.answer) || !question.options[question.answer]) {
        errors.push(`${at} : index de bonne réponse invalide.`);
        continue;
      }

      let computed;
      try {
        computed = computeSteps(scenario, question);
      } catch (error) {
        errors.push(`${at} : calcul impossible (${error.message}).`);
        continue;
      }
      const shown = question.options.map((option) => formatAnswer(option.value, question.format));
      if (new Set(shown).size !== shown.length) errors.push(`${at} : propositions identiques (${shown.join(' | ')}).`);
      const expected = formatAnswer(computed.result, question.format);
      if (shown[question.answer] !== expected) errors.push(`${at} : le calcul donne ${expected}, la bonne réponse affiche ${shown[question.answer]}.`);

      question.options.forEach((option, index) => {
        if (index === question.answer) return;
        if (!option.why) errors.push(`${at} : la proposition ${OPTION_LETTERS[index]} n'explique pas l'erreur qu'elle représente.`);
        if (!option.expression) return;
        try {
          const value = formatAnswer(distractorValue(scenario, question, option), question.format);
          if (value !== shown[index]) errors.push(`${at} : la proposition ${OPTION_LETTERS[index]} affiche ${shown[index]}, son calcul donne ${value}.`);
        } catch (error) {
          errors.push(`${at} : calcul de la proposition ${OPTION_LETTERS[index]} impossible (${error.message}).`);
        }
      });
    }
  }
  return errors;
}
