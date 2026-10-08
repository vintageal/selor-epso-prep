/*
 * Générateur de questions du module « Raisonnement abstrait ».
 * Aucune dépendance au DOM : réutilisable par le futur mode examen et testable sous Node.
 */
import { getLocale } from '../lib/i18n.js';
import { createSeededRandom, shuffle } from '../lib/random.js';
import { figureKey, isValidFigure } from './figures.js';
import { RULES } from './rules.js';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const DISTRACTOR_COUNT = OPTION_LETTERS.length - 1;
const SEED_RANGE = 2 ** 32;

/**
 * Construit une question à partir d'une règle : la série, 4 propositions
 * distinctes mélangées (dont une seule correcte) et l'explication.
 */
export function createQuestion(rule, random = Math.random) {
  const { sequence, answer, distractors, explanation } = rule.generate(random);

  const seen = new Set([figureKey(answer)]);
  const wrongAnswers = [];
  for (const figure of distractors) {
    const key = figureKey(figure);
    if (isValidFigure(figure) && !seen.has(key)) {
      seen.add(key);
      wrongAnswers.push(figure);
    }
  }
  if (wrongAnswers.length < DISTRACTOR_COUNT) {
    throw new Error(`Règle « ${rule.id} » : pas assez de propositions distinctes.`);
  }

  const options = shuffle(random, [answer, ...shuffle(random, wrongAnswers).slice(0, DISTRACTOR_COUNT)]);

  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    difficulty: rule.difficulty,
    sequence,
    answer,
    options,
    correctIndex: options.indexOf(answer),
    explanation: typeof explanation === 'string' ? explanation : explanation[getLocale()],
  };
}

/**
 * Identifiant stable d'une question générée : la règle et la graine du tirage,
 * par exemple « rotation/1x2y3z ». Il suffit à régénérer exactement la même question
 * (série, propositions et leur ordre), ce qui permet de la reproposer en révision.
 */
export const questionId = (ruleId, seed) => `${ruleId}/${seed.toString(36)}`;

/** Question générée par une règle à partir d'une graine, avec son identifiant. */
export const createSeededQuestion = (rule, seed) => ({ id: questionId(rule.id, seed), ...createQuestion(rule, createSeededRandom(seed)) });

/** Régénère la question correspondant à un identifiant, ou renvoie null si l'identifiant est inconnu ou invalide. */
export function questionFromId(id) {
  const match = /^([a-z-]+)\/([0-9a-z]{1,7})$/.exec(String(id));
  const rule = match && RULES.find((candidate) => candidate.id === match[1]);
  const seed = match ? parseInt(match[2], 36) : NaN;
  if (!rule || !Number.isSafeInteger(seed) || seed >= SEED_RANGE) return null;
  return createSeededQuestion(rule, seed);
}

/**
 * Renvoie une fonction qui fournit une nouvelle question à chaque appel.
 * Les règles sont tirées « comme dans un sac » : toutes apparaissent avant
 * qu'une règle ne revienne, et jamais deux fois de suite. Chaque question reçoit
 * sa propre graine, d'où un identifiant stable (voir questionId).
 */
export function createQuestionStream(random = Math.random) {
  let bag = [];
  let previous = null;

  return () => {
    if (bag.length === 0) {
      bag = shuffle(random, RULES);
      if (bag[0] === previous) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    previous = bag.shift();
    return createSeededQuestion(previous, Math.floor(random() * SEED_RANGE));
  };
}
