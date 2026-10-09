/*
 * Banques de questions traduites (data/nl/) : chaque question existe dans les deux langues, avec le même
 * identifiant et la même bonne réponse. Seuls les textes changent ; la structure (identifiants, réponses,
 * rangs, compétences, difficulté) est identique à la banque française.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { validateBank as validateJudgementBank } from '../assets/js/jugement/quiz.js';
import { validateBank as validateNumericBank } from '../assets/js/numerique/quiz.js';
import { validateBank as validateVerbalBank } from '../assets/js/verbal/quiz.js';
import { TRANSLATED_BANKS } from '../assets/js/lib/i18n.js';
import { calculationDifferences, computeBank, serialize } from '../scripts/calculer-numerique.js';
import { NL_PUBLIC } from '../scripts/site/config.js';

const readBank = (path) => JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8'));
const ids = (list) => list.map((item) => item.id);

/** Mots français courants qui n'ont rien à faire dans un texte néerlandais. */
const FRENCH_WORDS = /\b(vous|votre|vos|avec|pour|dans|est|une|qui|que|aux|sur|cette|sont)\b/i;

/** Vérifie qu'un texte néerlandais est rempli, traduit (différent du français) et sans mot français. */
function assertTranslated(french, dutch, where) {
  assert.equal(typeof dutch, 'string', `${where} : texte manquant`);
  assert.ok(dutch.trim().length > 0, `${where} : texte vide`);
  if (french.length > 12) assert.notEqual(dutch, french, `${where} : texte non traduit`);
  assert.doesNotMatch(dutch, FRENCH_WORDS, `${where} : mot français dans « ${dutch} »`);
  assert.doesNotMatch(dutch, /[«»]| [:;?!]| [:;?!](?:\s|$)/, `${where} : typographie française dans « ${dutch} »`);
}

/**
 * Comparaison d'une banque française et de sa traduction : échoue si une question manque dans une
 * langue, si son identifiant ou sa bonne réponse diffère, ou si un texte n'est pas traduit.
 */
const BANK_CHECKS = {
  numerique(fr, nl) {
    assert.deepEqual(validateNumericBank(nl), [], 'banque néerlandaise invalide');
    // Mêmes données, mêmes valeurs, mêmes expressions, mêmes réponses : seuls les textes diffèrent.
    assert.deepEqual(calculationDifferences(fr, nl), [], 'calculs différents entre les deux langues');
    assert.equal(serialize(computeBank(nl)), readFileSync(new URL('../data/nl/numerique.json', import.meta.url), 'utf8'), 'data/nl/numerique.json n’est pas à jour : lancez « node scripts/calculer-numerique.js »');
    fr.scenarios.forEach((french, index) => {
      const dutch = nl.scenarios[index];
      const at = `numérique « ${french.id} »`;
      for (const key of ['title', 'theme', 'note']) assertTranslated(french[key], dutch[key], `${at}, ${key}`);
      french.rows.forEach((row, i) => assertTranslated(row.label, dutch.rows[i].label, `${at}, ligne ${row.key}`));
      french.questions.forEach((question, i) => {
        const translated = dutch.questions[i];
        const where = `${at}/${question.id}`;
        for (const key of ['text', 'formula', 'explanation']) assertTranslated(question[key], translated[key], `${where}, ${key}`);
        question.steps.forEach((step, j) => assertTranslated(step.label, translated.steps[j].label, `${where}, étape ${j + 1}`));
        question.options.forEach((option, j) => option.why && assertTranslated(option.why, translated.options[j].why, `${where}, erreur ${j + 1}`));
      });
    });
  },
  jugement(fr, nl) {
    assert.deepEqual(validateJudgementBank(nl), [], 'banque néerlandaise invalide');
    assert.deepEqual(ids(nl.scenarios), ids(fr.scenarios), 'situations manquantes ou en trop');
    const themes = new Map();
    fr.scenarios.forEach((french, index) => {
      const dutch = nl.scenarios[index];
      const at = `jugement « ${french.id} »`;
      for (const key of ['competency', 'competencies', 'difficulty']) assert.deepEqual(dutch[key], french[key], `${at} : ${key}`);
      assert.deepEqual(ids(dutch.actions), ids(french.actions), `${at} : actions manquantes ou en trop`);
      // La plus et la moins adéquate (et tout le classement) restent identiques.
      assert.deepEqual(dutch.actions.map((action) => action.rank), french.actions.map((action) => action.rank), `${at} : rangs`);
      assert.deepEqual(dutch.actions.map((action) => action.competencies), french.actions.map((action) => action.competencies), `${at} : compétences des actions`);
      assert.equal(dutch.situation.length, french.situation.length, `${at} : paragraphes de la situation`);
      for (const key of ['title', 'theme', 'context', 'debrief']) assertTranslated(french[key], dutch[key], `${at}, ${key}`);
      french.situation.forEach((paragraph, i) => assertTranslated(paragraph, dutch.situation[i], `${at}, situation ${i + 1}`));
      french.actions.forEach((action, i) => {
        for (const key of ['text', 'explanation']) assertTranslated(action[key], dutch.actions[i][key], `${at}/${action.id}, ${key}`);
        // Une explication trop courte trahirait une traduction tronquée.
        const ratio = dutch.actions[i].explanation.length / action.explanation.length;
        assert.ok(ratio > 0.7 && ratio < 1.5, `${at}/${action.id} : explication de longueur suspecte (${ratio.toFixed(2)})`);
      });
      // Un même thème français a toujours la même traduction.
      if (!themes.has(french.theme)) themes.set(french.theme, dutch.theme);
      assert.equal(dutch.theme, themes.get(french.theme), `${at} : thème « ${french.theme} » traduit de deux façons`);
    });
  },
  verbal(fr, nl) {
    assert.deepEqual(validateVerbalBank(nl), [], 'banque néerlandaise invalide');
    assert.deepEqual(ids(nl.passages), ids(fr.passages), 'textes manquants ou en trop');
    fr.passages.forEach((french, index) => {
      const dutch = nl.passages[index];
      const at = `verbal « ${french.id} »`;
      assert.deepEqual(ids(dutch.statements), ids(french.statements), `${at} : affirmations manquantes ou en trop`);
      assert.equal(dutch.paragraphs.length, french.paragraphs.length, `${at} : paragraphes`);
      for (const key of ['title', 'theme']) assertTranslated(french[key], dutch[key], `${at}, ${key}`);
      french.paragraphs.forEach((paragraph, i) => assertTranslated(paragraph, dutch.paragraphs[i], `${at}, paragraphe ${i + 1}`));
      french.statements.forEach((statement, i) => {
        const translated = dutch.statements[i];
        const where = `${at}/${statement.id}`;
        // La bonne réponse et la difficulté restent identiques dans les deux langues.
        assert.equal(translated.answer, statement.answer, `${where} : réponse`);
        assert.equal(translated.difficulty, statement.difficulty, `${where} : difficulté`);
        assert.equal(translated.quotes.length, statement.quotes.length, `${where} : nombre de citations`);
        for (const key of ['text', 'explanation']) assertTranslated(statement[key], translated[key], `${where}, ${key}`);
        for (const quote of translated.quotes) {
          assert.match(quote, /^[A-ZÀ-Ý“]/, `${where} : la citation doit commencer une phrase`);
          assert.match(quote, /[.!?”]$/, `${where} : la citation doit finir une phrase`);
        }
        assert.match(translated.explanation, /“[^”]+”/, `${where} : l'explication doit citer le texte`);
        if (statement.answer === 'impossible') assert.match(translated.explanation, /kan (dus )?niet worden bepaald/i, `${where} : « Kan niet worden bepaald » non justifié`);
        const ratio = translated.explanation.length / statement.explanation.length;
        assert.ok(ratio > 0.7 && ratio < 1.5, `${where} : explication de longueur suspecte (${ratio.toFixed(2)})`);
      });
    });
  },
};

test('chaque banque déclarée traduite a sa vérification de traduction', () => {
  for (const name of TRANSLATED_BANKS.nl) assert.ok(BANK_CHECKS[name], `aucune vérification pour la banque « ${name} »`);
});

for (const name of TRANSLATED_BANKS.nl) {
  test(`banque « ${name} » : mêmes questions, mêmes identifiants et mêmes réponses en français et en néerlandais`, () => {
    BANK_CHECKS[name](readBank(`${name}.json`), readBank(`nl/${name}.json`));
  });
}

test('la version néerlandaise n’est activée que lorsque toutes les banques sont traduites', () => {
  if (NL_PUBLIC) assert.deepEqual([...TRANSLATED_BANKS.nl].sort(), [...TRANSLATED_BANKS.fr].sort());
});
