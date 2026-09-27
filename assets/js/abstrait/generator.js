/*
 * Générateur de questions du module « Raisonnement abstrait ».
 * Aucune dépendance au DOM : réutilisable par le futur mode examen et testable sous Node.
 */
import { shuffle } from '../lib/random.js';
import { figureKey, isValidFigure } from './figures.js';
import { RULES } from './rules.js';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const DISTRACTOR_COUNT = OPTION_LETTERS.length - 1;

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
    explanation,
  };
}

/**
 * Renvoie une fonction qui fournit une nouvelle question à chaque appel.
 * Les règles sont tirées « comme dans un sac » : toutes apparaissent avant
 * qu'une règle ne revienne, et jamais deux fois de suite.
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
    return createQuestion(previous, random);
  };
}
