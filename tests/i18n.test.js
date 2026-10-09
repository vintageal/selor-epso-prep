/*
 * Site bilingue : dictionnaires de textes (pages : src/i18n/, interface JavaScript : assets/js/i18n/),
 * terminologie belge de la version néerlandaise et rendu de l'interface dans chaque langue.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RULES } from '../assets/js/abstrait/rules.js';
import { createQuestion } from '../assets/js/abstrait/generator.js';
import { describeFigure } from '../assets/js/abstrait/figures.js';
import { MESSAGES, TRANSLATED_BANKS, bankUrl, setLocale, t } from '../assets/js/lib/i18n.js';
import { createSeededRandom } from '../assets/js/lib/random.js';
import { formatAnswer, formatNumber } from '../assets/js/numerique/quiz.js';
import { ANSWERS } from '../assets/js/verbal/quiz.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageDictionaries = Object.fromEntries(['fr', 'nl'].map((lang) => [lang, JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8'))]));

after(() => setLocale('fr'));

/** Entrées « a.b.c » → valeur (chaînes et fonctions) d'un dictionnaire. */
const flatten = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
const entries = (dictionary) => new Map(flatten(dictionary));
const placeholders = (text, pattern) => [...text.matchAll(pattern)].map(([, name]) => name).sort();
const tags = (text) => [...text.matchAll(/<(\/?[a-z]+)/g)].map(([, name]) => name).sort();

/** Textes volontairement identiques dans les deux langues. */
const SAME_IN_BOTH = new Set([
  'site.modules', // « Modules »
  'common.score', // « Score »
  'progression.history.score',
  'progression.chart.tooltip', // « Examen 3 · 12/10 »
  'difficulty.badge', // « Niveau 2 · … »
  'numerique.formula', // « Formule »
  'verbal.keys.impossible', // touche « ? »
  'examen.minutes', // « 40 min »
]);

/* ----- Dictionnaires des pages (src/i18n/) ----- */

test('les dictionnaires des pages ont exactement les mêmes clés en français et en néerlandais', () => {
  const [fr, nl] = [entries(pageDictionaries.fr), entries(pageDictionaries.nl)];
  assert.deepEqual([...nl.keys()].sort(), [...fr.keys()].sort());
  for (const [key, value] of [...fr, ...nl]) assert.ok(typeof value === 'string' && value.trim() !== '', `« ${key} » vide ou invalide`);
});

test('chaque texte des pages est traduit, avec les mêmes variables et les mêmes balises HTML', () => {
  const nl = entries(pageDictionaries.nl);
  for (const [key, french] of entries(pageDictionaries.fr)) {
    const dutch = nl.get(key);
    if (!SAME_IN_BOTH.has(key)) assert.notEqual(dutch, french, `« ${key} » n'est pas traduit`);
    assert.deepEqual(placeholders(dutch, /\{\{(\w+)\}\}/g), placeholders(french, /\{\{(\w+)\}\}/g), `« ${key} » : variables`);
    assert.deepEqual(tags(dutch), tags(french), `« ${key} » : balises HTML`);
  }
});

/* ----- Dictionnaires de l'interface (assets/js/i18n/) ----- */

const SAMPLE_PARAMS = { count: 3, correct: 2, total: 5, rate: '40 %', streak: 2, answers: 4, exams: 1, review: 0, points: 1, max: 4, letter: 'B', rank: 'x', value: '5,2', unit: '%' };

test('les dictionnaires de l’interface ont exactement les mêmes clés en français et en néerlandais', () => {
  const [fr, nl] = [entries(MESSAGES.fr), entries(MESSAGES.nl)];
  assert.deepEqual([...nl.keys()].sort(), [...fr.keys()].sort());
  for (const [key, french] of fr) {
    const dutch = nl.get(key);
    if (typeof french === 'string' && typeof dutch === 'string') {
      if (!SAME_IN_BOTH.has(key)) assert.notEqual(dutch, french, `« ${key} » n'est pas traduit`);
      assert.deepEqual(placeholders(dutch, /\{(\w+)\}/g), placeholders(french, /\{(\w+)\}/g), `« ${key} » : paramètres`);
    } else {
      // Pluriels et accords : une fonction dans au moins une langue, qui renvoie un texte complet.
      for (const [lang, value] of [['fr', french], ['nl', dutch]]) {
        const text = typeof value === 'function' ? value(SAMPLE_PARAMS) : value.replace(/\{(\w+)\}/g, (_, name) => SAMPLE_PARAMS[name]);
        assert.equal(typeof text, 'string', `« ${key} » (${lang})`);
        assert.doesNotMatch(text, /undefined|NaN|\{\w+\}/, `« ${key} » (${lang}) : ${text}`);
      }
    }
  }
});

/** Clés passées à t() dans le code : littérales, ou préfixes de clés construites (t(`modules.${id}`)). */
function usedKeys() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
      else if (entry.name.endsWith('.js') && !dir.endsWith('/i18n')) files.push(`${dir}/${entry.name}`);
    }
  };
  walk('assets/js');
  const literal = new Set();
  const prefixes = new Set();
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const [, key] of source.matchAll(/\bt\(\s*'([\w.-]+)'/g)) literal.add(key);
    for (const [, key] of source.matchAll(/\bt\(\s*isCorrect \? '([\w.-]+)' : '([\w.-]+)'/g)) literal.add(key);
    for (const [, prefix] of source.matchAll(/\bt\(\s*`([\w.-]+)\.\$\{/g)) prefixes.add(prefix);
  }
  return { literal, prefixes };
}

test('chaque texte utilisé par le code existe dans les deux langues', () => {
  const { literal, prefixes } = usedKeys();
  assert.ok(literal.size > 100, 'analyse des appels à t() incomplète');
  for (const lang of ['fr', 'nl']) {
    const keys = entries(MESSAGES[lang]);
    for (const key of literal) assert.ok(keys.has(key), `« ${key} » absent du dictionnaire ${lang}`);
    for (const prefix of prefixes) assert.ok([...keys.keys()].some((key) => key.startsWith(`${prefix}.`)), `« ${prefix}.… » absent (${lang})`);
  }
});

/* ----- Terminologie et typographie de la version néerlandaise ----- */

test('la version néerlandaise utilise les noms officiels belges et européens', () => {
  const { site, home } = pageDictionaries.nl;
  assert.match(site.independence, /niet verbonden aan de FOD BOSA \(Werkenvoor\.be, vroeger Selor\)/);
  assert.match(site.independence, /Europees Bureau voor personeelsselectie \(EPSO\)/);
  assert.equal(home.footer.officialSelectionUrl, 'https://werkenvoor.be/nl');
  assert.equal(home.footer.epsoUrl, 'https://eu-careers.europa.eu/nl');
  assert.equal(site.transparency, 'Je resultaten blijven op dit toestel: er wordt niets verzonden of gedeeld.');
  const all = JSON.stringify(pageDictionaries.nl) + flatten(MESSAGES.nl).map(([, value]) => String(value)).join('\n');
  assert.doesNotMatch(all, /Travaillerpour|SPF BOSA|Office européen/, 'nom français d’un organisme');
});

test('les textes néerlandais n’ont pas la typographie française', () => {
  const texts = [...flatten(pageDictionaries.nl), ...flatten(MESSAGES.nl).filter(([, value]) => typeof value === 'string')];
  for (const [key, text] of texts) {
    assert.doesNotMatch(text, /[«»]|&nbsp;[:;?!%]| [:;?!%]| [:;?!](?:\s|$)/, `« ${key} » : ${text}`);
  }
});

test('les réponses du raisonnement verbal ont leur libellé et leur raccourci dans chaque langue', () => {
  setLocale('nl');
  assert.deepEqual(ANSWERS.map((answer) => answer.label), ['Waar', 'Niet waar', 'Kan niet worden bepaald']);
  assert.deepEqual(ANSWERS.map((answer) => answer.keys), [['1', 'w'], ['2', 'n'], ['3', '?']]);
  setLocale('fr');
  assert.deepEqual(ANSWERS.map((answer) => answer.label), ['Vrai', 'Faux', 'On ne peut pas savoir']);
  assert.deepEqual(ANSWERS.map((answer) => answer.keys), [['1', 'v'], ['2', 'f'], ['3', '?']]);
});

test('les nombres suivent le format de la langue : fr-BE et nl-BE', () => {
  setLocale('nl');
  assert.equal(formatNumber(1010), '1.010');
  assert.equal(formatAnswer(5.2083, { decimals: 1, unit: '%' }), '5,2%');
  assert.equal(formatAnswer(1250, { decimals: 0, unit: 'mln euro' }), '1.250\u00a0mln euro');
  assert.equal(formatAnswer(7.514, { decimals: 2, unit: '€' }), '€\u00a07,51');
  assert.equal(t('format.percent', { value: 72 }), '72%');
  setLocale('fr');
  assert.equal(formatAnswer(5.2083, { decimals: 1, unit: '%' }), '5,2 %');
  assert.equal(t('format.percent', { value: 72 }), '72 %');
});

/* ----- Raisonnement abstrait : seule l'interface est traduite ----- */

test('raisonnement abstrait : explications, titres et descriptions en néerlandais, questions identiques', () => {
  for (const rule of RULES) {
    for (let seed = 1; seed <= 25; seed += 1) {
      setLocale('fr');
      const french = createQuestion(rule, createSeededRandom(seed));
      setLocale('nl');
      const dutch = createQuestion(rule, createSeededRandom(seed));
      assert.deepEqual(dutch.options, french.options, `${rule.id}/${seed} : la question ne dépend pas de la langue`);
      assert.equal(dutch.correctIndex, french.correctIndex);
      assert.notEqual(dutch.explanation, french.explanation, `${rule.id}/${seed} : explication non traduite`);
      assert.notEqual(dutch.ruleTitle, french.ruleTitle, `${rule.id} : titre non traduit`);
      for (const text of [dutch.explanation, ...dutch.options.map((figure) => describeFigure(figure))]) {
        assert.doesNotMatch(text, /undefined|NaN|\b(le|la|les|une|est|dans|avec)\b/, `${rule.id}/${seed} : ${text}`);
      }
    }
  }
  setLocale('fr');
});

/* ----- Banques de questions ----- */

test('chaque langue charge sa banque traduite, ou la banque française tant qu’elle n’est pas traduite', () => {
  for (const name of ['verbal', 'numerique', 'jugement']) {
    assert.match(bankUrl(name, 'fr').pathname, new RegExp(`/data/${name}\\.json$`));
    const translated = TRANSLATED_BANKS.nl.includes(name);
    assert.match(bankUrl(name, 'nl').pathname, new RegExp(`/data/${translated ? 'nl/' : ''}${name}\\.json$`));
    assert.equal(existsSync(join(root, `data/nl/${name}.json`)), translated, `data/nl/${name}.json et TRANSLATED_BANKS doivent concorder`);
  }
});
