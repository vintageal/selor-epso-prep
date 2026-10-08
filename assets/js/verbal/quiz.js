/*
 * Module « Raisonnement verbal » : logique de l'exercice, sans dépendance au DOM
 * (réutilisable par le futur mode examen et testable sous Node).
 *
 * La banque de questions est stockée dans data/verbal.json :
 *   { passages: [{ id, title, theme, paragraphs: [...], statements: [
 *       { id, text, answer: 'vrai' | 'faux' | 'impossible', difficulty: 1 | 2 | 3, quotes: [...], explanation }
 *   ] }] }
 * Chaque citation (`quotes`) doit reprendre à l'identique une phrase du texte.
 * La difficulté (1 facile, 2 moyen, 3 difficile) s'affiche avec l'affirmation et équilibre le mode examen.
 */
import { isDifficulty } from '../lib/difficulty.js';
import { shuffle } from '../lib/random.js';

export const ANSWERS = [
  { id: 'vrai', label: 'Vrai', icon: '✓', keys: ['1', 'v'] },
  { id: 'faux', label: 'Faux', icon: '✕', keys: ['2', 'f'] },
  { id: 'impossible', label: 'On ne peut pas savoir', icon: '?', keys: ['3', '?'] },
];

export const answerLabel = (id) => ANSWERS.find((answer) => answer.id === id)?.label;

/** Rappel de méthode associé à chaque type de réponse. */
export const METHOD_TIPS = {
  vrai: "« Vrai » : l'affirmation est confirmée par le texte, soit explicitement, soit parce qu'elle en découle logiquement, sans rien y ajouter.",
  faux: "« Faux » : le texte affirme le contraire, ou contient une information incompatible avec l'affirmation.",
  impossible: "« On ne peut pas savoir » : le texte ne permet ni de confirmer ni d'infirmer l'affirmation. Vos connaissances personnelles ne comptent pas : seul le texte fait foi.",
};

/**
 * Enchaînement d'une série : textes dans un ordre aléatoire, affirmations
 * mélangées au sein de chaque texte (un texte reste affiché pour toutes ses affirmations).
 */
export function buildSteps(passages, random = Math.random) {
  return shuffle(random, passages).flatMap((passage, passageIndex) =>
    shuffle(random, passage.statements).map((statement, statementIndex) => ({
      passage,
      statement,
      passageIndex,
      passageCount: passages.length,
      statementIndex,
      statementCount: passage.statements.length,
    })),
  );
}

/**
 * Étapes d'une révision : les affirmations demandées (dans l'ordre donné), regroupées par texte.
 * Les identifiants inconnus (affirmation retirée de la banque) sont ignorés.
 */
export function buildReviewSteps(passages, statementIds) {
  const byId = new Map(passages.flatMap((passage) => passage.statements.map((statement) => [statement.id, { passage, statement }])));
  const groups = new Map();
  for (const id of statementIds) {
    const found = byId.get(id);
    if (!found) continue;
    if (!groups.has(found.passage)) groups.set(found.passage, []);
    if (!groups.get(found.passage).includes(found.statement)) groups.get(found.passage).push(found.statement);
  }
  return [...groups].flatMap(([passage, statements], passageIndex) =>
    statements.map((statement, statementIndex) => ({
      passage,
      statement,
      passageIndex,
      passageCount: groups.size,
      statementIndex,
      statementCount: statements.length,
    })),
  );
}

/**
 * Découpe un paragraphe en segments, en marquant ceux qui correspondent
 * à une citation (pour les surligner). Les citations qui se chevauchent sont fusionnées.
 */
export function highlightSegments(paragraph, quotes) {
  const ranges = quotes
    .map((quote) => [paragraph.indexOf(quote), quote.length])
    .filter(([start, length]) => start !== -1 && length > 0)
    .map(([start, length]) => [start, start + length])
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: paragraph.slice(cursor, start), highlighted: false });
    segments.push({ text: paragraph.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < paragraph.length) segments.push({ text: paragraph.slice(cursor), highlighted: false });
  return segments;
}

/**
 * Typographie française à l'affichage : espaces insécables avant « ; : ! ? % »,
 * à l'intérieur des guillemets et dans les grands nombres (« 1 000 »).
 * Les données restent en espaces simples, ce qui garde les citations faciles à écrire.
 */
export const frenchTypography = (text) =>
  text
    .replace(/ ([;:!?»%])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/(\d) (?=\d{3}\b)/g, '$1 ');

/** Bilan d'une série : score global et détail par type de réponse attendue. */
export function summarize(results) {
  const byAnswer = Object.fromEntries(ANSWERS.map(({ id }) => [id, { total: 0, correct: 0 }]));
  for (const { expected, correct } of results) {
    byAnswer[expected].total += 1;
    if (correct) byAnswer[expected].correct += 1;
  }
  return {
    total: results.length,
    correct: results.filter((result) => result.correct).length,
    byAnswer,
  };
}

/**
 * Vérifie la cohérence de la banque de questions et renvoie la liste des erreurs
 * (tableau vide si tout est correct). Contrôle essentiel : chaque citation doit
 * figurer mot pour mot, une seule fois, dans un paragraphe du texte.
 */
export function validateBank(bank) {
  if (!Array.isArray(bank?.passages) || bank.passages.length === 0) return ['La banque ne contient aucun texte.'];

  const errors = [];
  const ids = new Set();
  const registerId = (id, where) => {
    if (typeof id !== 'string' || id === '') errors.push(`${where} : identifiant manquant.`);
    else if (ids.has(id)) errors.push(`${where} : identifiant « ${id} » en double.`);
    else ids.add(id);
  };

  bank.passages.forEach((passage, passageIndex) => {
    const where = `Texte « ${passage.id ?? passageIndex + 1} »`;
    registerId(passage.id, where);
    if (!passage.title || !passage.theme) errors.push(`${where} : titre ou thème manquant.`);
    if (!Array.isArray(passage.paragraphs) || passage.paragraphs.length === 0) {
      errors.push(`${where} : aucun paragraphe.`);
      return;
    }
    if (!Array.isArray(passage.statements) || passage.statements.length === 0) {
      errors.push(`${where} : aucune affirmation.`);
      return;
    }

    passage.statements.forEach((statement, statementIndex) => {
      const at = `${where}, affirmation « ${statement.id ?? statementIndex + 1} »`;
      registerId(statement.id, at);
      if (!statement.text) errors.push(`${at} : énoncé manquant.`);
      if (!answerLabel(statement.answer)) errors.push(`${at} : réponse « ${statement.answer} » invalide.`);
      if (!isDifficulty(statement.difficulty)) errors.push(`${at} : difficulté 1, 2 ou 3 attendue.`);
      if (!statement.explanation) errors.push(`${at} : explication manquante.`);
      if (!Array.isArray(statement.quotes) || statement.quotes.length === 0) {
        errors.push(`${at} : aucune citation du texte.`);
        return;
      }
      statement.quotes.forEach((quote) => {
        if (typeof quote !== 'string' || quote.trim() === '') {
          errors.push(`${at} : citation vide.`);
          return;
        }
        const occurrences = passage.paragraphs.reduce((count, paragraph) => count + paragraph.split(quote).length - 1, 0);
        if (occurrences !== 1) {
          errors.push(`${at} : citation ${occurrences === 0 ? 'introuvable' : 'ambiguë'} dans le texte : « ${quote} »`);
        }
      });
    });
  });

  return errors;
}
