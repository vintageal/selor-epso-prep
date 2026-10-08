import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITS,
  REVIEW_STREAK,
  SCHEMA_VERSION,
  STORAGE_KEY,
  applyAnswer,
  createStore,
  emptyData,
  migrate,
  parseImport,
  validateData,
} from '../assets/js/progression/store.js';
import { examSeries, moduleStats, nextModuleToReview, recentExams, reviewSummary, weakestModule } from '../assets/js/progression/stats.js';

/** Stockage en mémoire, avec la même interface que localStorage. */
const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};

/** Horloge de test : avance d'une minute à chaque appel. */
const clock = (start = '2026-03-01T09:00:00.000Z') => {
  let time = Date.parse(start);
  return () => new Date((time += 60_000));
};

const newStore = (storage = memoryStorage()) => ({ storage, store: createStore({ storage, now: clock() }) });
const answer = (overrides = {}) => ({ module: 'verbal', questionId: 'q1', correct: true, durationMs: 12_000, ...overrides });
const exam = (score, overrides = {}) => ({
  score,
  total: 35,
  durationMs: 30 * 60_000,
  sections: { abstrait: { score: 8, total: 10 }, verbal: { score: 7, total: 10 }, numerique: { score: 6, total: 10 }, jugement: { score: 3.75, total: 5 } },
  ...overrides,
});

/* ----- Stockage indisponible ----- */

test('stockage absent ou bloqué : le suivi est désactivé sans erreur', () => {
  const throwing = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('SecurityError');
    },
    removeItem() {
      throw new Error('SecurityError');
    },
  };
  for (const storage of [null, throwing]) {
    const store = createStore({ storage });
    assert.equal(store.available, false);
    assert.equal(store.reason, 'unavailable');
    assert.equal(store.getData(), null);
    assert.equal(store.recordAnswer(answer()), false);
    assert.equal(store.recordExam(exam(25)), false);
    assert.deepEqual(store.reviewList('verbal'), []);
    assert.equal(store.reviewCount(), 0);
    assert.equal(store.exportJson(), null);
    assert.equal(store.importJson(JSON.stringify(emptyData())).ok, false);
    assert.equal(store.reset(), false);
  }
});

test('localStorage inaccessible (getter qui lève une exception) : createStore ne plante pas', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError: access denied');
    },
  });
  try {
    const store = createStore();
    assert.equal(store.available, false);
    assert.equal(store.recordAnswer(answer()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('quota atteint : l’historique est réduit plutôt que de perdre l’enregistrement', () => {
  const storage = memoryStorage();
  const setItem = storage.setItem;
  let failures = 0;
  storage.setItem = (key, value) => {
    if (key === STORAGE_KEY && value.length > 2_000 && failures++ === 0) throw new Error('QuotaExceededError');
    setItem(key, value);
  };
  const { store } = newStore(storage);
  for (let i = 0; i < 20; i += 1) assert.ok(store.recordAnswer(answer({ questionId: `q${i}` })));
  assert.ok(store.getData().answers.length < 20, 'la moitié la plus ancienne a été effacée');
  assert.equal(store.getData().answers.at(-1).questionId, 'q19');
});

/* ----- Enregistrement ----- */

test('chaque réponse enregistre module, identifiant, juste ou faux, date et temps de réponse', () => {
  const { store, storage } = newStore();
  assert.equal(store.available, true);
  assert.ok(store.recordAnswer(answer({ module: 'numerique', questionId: 'budget-variation-total', correct: false, durationMs: 41_234.6 })));
  assert.ok(store.recordAnswer(answer({ module: 'jugement', questionId: 'erreur-dossier', correct: false, score: 0.75, source: 'examen' })));
  const data = JSON.parse(storage.map.get(STORAGE_KEY));
  assert.equal(data.version, SCHEMA_VERSION);
  assert.deepEqual(data.answers[0], {
    module: 'numerique',
    questionId: 'budget-variation-total',
    correct: false,
    date: '2026-03-01T09:01:00.000Z',
    durationMs: 41_235,
    source: 'entrainement',
  });
  assert.equal(data.answers[1].score, 0.75);
  assert.equal(data.answers[1].source, 'examen');
});

test('les réponses incohérentes sont refusées', () => {
  const { store } = newStore();
  assert.equal(store.recordAnswer(answer({ module: 'inconnu' })), false);
  assert.equal(store.recordAnswer(answer({ questionId: '' })), false);
  assert.equal(store.recordAnswer(answer({ source: 'autre' })), false);
  assert.deepEqual(store.getData().answers, []);
});

test('chaque examen enregistre score global, score par catégorie, durée et date', () => {
  const { store } = newStore();
  assert.ok(store.recordExam(exam(27.75, { endReason: 'timeout' })));
  const [saved] = store.getData().exams;
  assert.equal(saved.score, 27.75);
  assert.equal(saved.total, 35);
  assert.equal(saved.durationMs, 30 * 60_000);
  assert.equal(saved.endReason, 'timeout');
  assert.deepEqual(saved.sections.verbal, { score: 7, total: 10 });
  assert.ok(!Number.isNaN(Date.parse(saved.date)));
  assert.equal(store.recordExam({ ...exam(40) }), false, 'score supérieur au total');
});

test('un examen enregistre aussi ses réponses en une seule écriture, erreurs comprises', () => {
  const storage = memoryStorage();
  let writes = 0;
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === STORAGE_KEY) writes += 1;
    setItem(key, value);
  };
  const { store } = newStore(storage);
  assert.ok(store.recordExam({
    ...exam(25),
    answers: [
      { module: 'abstrait', questionId: 'rotation/1a', correct: false, durationMs: 21_000, date: '2026-03-01T09:10:00.000Z' },
      { module: 'jugement', questionId: 'erreur-dossier', correct: false, score: 0.5, durationMs: 90_000 },
      { module: 'verbal', questionId: 'teletravail-accueil', correct: true, durationMs: 30_000 },
      { module: 'inconnu', questionId: 'x', correct: true },
    ],
  }));
  assert.equal(writes, 1);
  const data = store.getData();
  assert.equal(data.exams.length, 1);
  assert.equal(data.answers.length, 3, 'la réponse incohérente est ignorée');
  assert.ok(data.answers.every((item) => item.source === 'examen'));
  assert.equal(data.answers[0].date, '2026-03-01T09:10:00.000Z');
  assert.equal(data.answers[1].score, 0.5);
  assert.deepEqual(store.reviewList().map((entry) => entry.module).sort(), ['abstrait', 'jugement']);
});

test('l’historique est plafonné : les réponses les plus anciennes sont effacées', () => {
  let data = emptyData();
  for (let i = 0; i < LIMITS.answers + 3; i += 1) {
    data = applyAnswer(data, { ...answer({ questionId: `q${i}` }), date: '2026-03-01T09:00:00.000Z', source: 'entrainement' });
  }
  assert.equal(data.answers.length, LIMITS.answers);
  assert.equal(data.answers[0].questionId, 'q3');
});

/* ----- Révision des erreurs : 2 réussites consécutives ----- */

test('une erreur ajoute la question à revoir ; elle sort après 2 bonnes réponses consécutives', () => {
  assert.equal(REVIEW_STREAK, 2);
  const { store } = newStore();
  store.recordAnswer(answer({ questionId: 'a', correct: true }));
  assert.equal(store.reviewCount('verbal'), 0, 'une bonne réponse seule n’ajoute rien');

  store.recordAnswer(answer({ questionId: 'a', correct: false }));
  assert.deepEqual(store.reviewList('verbal').map(({ questionId, streak }) => [questionId, streak]), [['a', 0]]);
  store.recordAnswer(answer({ questionId: 'a', correct: true, source: 'revision' }));
  assert.equal(store.reviewList('verbal')[0].streak, 1, 'une seule réussite ne suffit pas');
  store.recordAnswer(answer({ questionId: 'a', correct: true, source: 'revision' }));
  assert.equal(store.reviewCount('verbal'), 0, 'deux réussites consécutives : la question sort de la liste');
});

test('une nouvelle erreur remet le compteur à zéro', () => {
  const { store } = newStore();
  store.recordAnswer(answer({ questionId: 'b', correct: false }));
  store.recordAnswer(answer({ questionId: 'b', correct: true }));
  store.recordAnswer(answer({ questionId: 'b', correct: false }));
  assert.equal(store.reviewList()[0].streak, 0);
  store.recordAnswer(answer({ questionId: 'b', correct: true }));
  assert.equal(store.reviewCount(), 1, 'il faut deux réussites après la dernière erreur');
  store.recordAnswer(answer({ questionId: 'b', correct: true }));
  assert.equal(store.reviewCount(), 0);
});

test('les listes à revoir sont séparées par module et triées par ancienneté', () => {
  const { store } = newStore();
  store.recordAnswer(answer({ module: 'numerique', questionId: 'n2', correct: false }));
  store.recordAnswer(answer({ module: 'verbal', questionId: 'v1', correct: false }));
  store.recordAnswer(answer({ module: 'numerique', questionId: 'n1', correct: false }));
  store.recordAnswer(answer({ module: 'abstrait', questionId: 'rotation/1a', correct: false }));
  assert.deepEqual(store.reviewList('numerique').map((entry) => entry.questionId), ['n2', 'n1']);
  assert.equal(store.reviewCount(), 4);
  assert.ok(store.dropReview('numerique', 'n2'));
  assert.deepEqual(store.reviewList('numerique').map((entry) => entry.questionId), ['n1']);
});

test('une erreur partielle au jugement situationnel est à revoir', () => {
  const { store } = newStore();
  store.recordAnswer(answer({ module: 'jugement', questionId: 'usager-mecontent', correct: false, score: 0.5 }));
  assert.equal(store.reviewCount('jugement'), 1);
});

/* ----- Export, import, réinitialisation ----- */

test('export puis import : la progression passe d’un appareil à l’autre', () => {
  const first = newStore().store;
  first.recordAnswer(answer({ questionId: 'x', correct: false }));
  first.recordExam(exam(25));
  const file = first.exportJson();
  assert.equal(JSON.parse(file).application, 'selor-epso-prep');

  const second = newStore().store;
  const result = second.importJson(file);
  assert.equal(result.ok, true);
  assert.equal(second.getData().answers.length, 1);
  assert.equal(second.getData().exams.length, 1);
  assert.equal(second.reviewCount('verbal'), 1);
  assert.equal(second.getData().exportedAt, undefined, 'seules les données utiles sont conservées');
});

test('import invalide : le fichier est refusé et les données actuelles sont conservées', () => {
  const { store } = newStore();
  store.recordAnswer(answer({ questionId: 'garde', correct: false }));
  const valid = JSON.parse(store.exportJson());
  const cases = [
    ['', /vide/],
    ['{ pas du json', /JSON valide/],
    [JSON.stringify([1, 2, 3]), /Format non reconnu/],
    [JSON.stringify({ answers: [] }), /version/],
    [JSON.stringify({ ...valid, application: 'autre-site' }), /ne provient pas/],
    [JSON.stringify({ ...valid, version: SCHEMA_VERSION + 1 }), /plus récente/],
    [JSON.stringify({ ...valid, answers: 'beaucoup' }), /obligatoires/],
    [JSON.stringify({ ...valid, answers: [{ ...valid.answers[0], module: 'chimie' }] }), /module « chimie » inconnu/],
    [JSON.stringify({ ...valid, answers: [{ ...valid.answers[0], correct: 'oui' }] }), /juste ou faux/],
    [JSON.stringify({ ...valid, answers: [{ ...valid.answers[0], date: 'hier' }] }), /date invalide/],
    [JSON.stringify({ ...valid, exams: [{ date: valid.answers[0].date, durationMs: 1, score: 9, total: 5, sections: {} }] }), /score invalide/],
    [JSON.stringify({ ...valid, review: { 'verbal:autre': { module: 'verbal', questionId: 'x', streak: 0, failedAt: valid.answers[0].date } } }), /entrée invalide/],
    ['x'.repeat(LIMITS.importBytes + 1), /trop volumineux/],
  ];
  for (const [text, expected] of cases) {
    const result = store.importJson(text);
    assert.equal(result.ok, false, `accepté à tort : ${text.slice(0, 60)}`);
    assert.match(result.errors.join(' '), expected);
  }
  assert.equal(store.getData().answers[0].questionId, 'garde', 'données intactes');
});

test('les erreurs d’import sont limitées à un résumé lisible', () => {
  const answers = Array.from({ length: 12 }, () => ({ module: 'x' }));
  const { errors } = parseImport(JSON.stringify({ version: SCHEMA_VERSION, answers, exams: [], review: {} }));
  assert.equal(errors.length, 6);
  assert.match(errors.at(-1), /autre\(s\) erreur/);
});

test('réinitialiser efface toute la progression', () => {
  const { store, storage } = newStore();
  store.recordAnswer(answer({ correct: false }));
  assert.ok(store.reset());
  assert.equal(storage.map.has(STORAGE_KEY), false);
  assert.deepEqual(store.getData(), emptyData());
});

/* ----- Versions de schéma et données illisibles ----- */

test('migration de version : les migrations s’appliquent une à une jusqu’à la version visée', () => {
  const migrations = {
    1: (data) => ({ ...data, exams: data.exams.map((item) => ({ ...item, migratedTo2: true })) }),
    2: (data) => ({ ...data, preferences: { theme: 'clair' } }),
  };
  const v1 = { version: 1, answers: [], exams: [{ score: 1 }], review: {} };
  const { data } = migrate(v1, { migrations, version: 3 });
  assert.equal(data.version, 3);
  assert.equal(data.exams[0].migratedTo2, true);
  assert.deepEqual(data.preferences, { theme: 'clair' });
  assert.match(migrate(v1, { migrations: {}, version: 2 }).error, /Aucune migration disponible depuis la version 1/);
  assert.deepEqual(migrate(v1).data, v1, 'données déjà à jour : inchangées');
  assert.equal(migrate({ ...v1, version: 9 }).newer, true);
  assert.match(migrate({ answers: [] }).error, /version/);
});

test('données d’une version plus récente du site : jamais écrasées, suivi suspendu', () => {
  const newer = JSON.stringify({ version: SCHEMA_VERSION + 1, answers: [], exams: [], review: {}, futur: true });
  const storage = memoryStorage({ [STORAGE_KEY]: newer });
  const store = createStore({ storage, now: clock() });
  assert.equal(store.getData(), null);
  assert.equal(store.available, false);
  assert.equal(store.reason, 'newer');
  assert.equal(store.recordAnswer(answer()), false);
  assert.equal(storage.map.get(STORAGE_KEY), newer);
});

test('données illisibles : mises de côté puis remplacées par une progression vide', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{ cassé' });
  const { store } = newStore(storage);
  assert.deepEqual(store.getData(), emptyData());
  assert.equal(storage.map.get(`${STORAGE_KEY}:illisible`), '{ cassé');
  assert.ok(store.recordAnswer(answer()));
  assert.equal(store.getData().answers.length, 1);
});

test('validateData accepte des données vides et signale les rubriques manquantes', () => {
  assert.deepEqual(validateData(emptyData()), []);
  assert.match(validateData({ version: SCHEMA_VERSION })[0], /obligatoires/);
  assert.match(validateData(null)[0], /objet/);
});

/* ----- Statistiques de la page « Ma progression » ----- */

const sampleData = () => {
  const { store } = newStore();
  for (const correct of [true, true, true, false]) store.recordAnswer(answer({ module: 'verbal', questionId: `v${Math.random()}`, correct }));
  for (const correct of [true, false, false, false, false]) store.recordAnswer(answer({ module: 'numerique', questionId: `n${Math.random()}`, correct }));
  for (const score of [1, 0.5, 0.75, 1, 0.25]) store.recordAnswer(answer({ module: 'jugement', questionId: `j${Math.random()}`, correct: score === 1, score }));
  [20, 24.5, 22, 30].forEach((score) => store.recordExam(exam(score)));
  return store.getData();
};

test('statistiques par module : questions faites, taux de réussite, erreurs à revoir', () => {
  const stats = moduleStats(sampleData());
  assert.deepEqual(stats.verbal, { answered: 4, rate: 0.75, toReview: 1 });
  assert.deepEqual(stats.numerique, { answered: 5, rate: 0.2, toReview: 4 });
  assert.equal(stats.jugement.rate, 0.7, 'les scores partiels comptent');
  assert.deepEqual(stats.abstrait, { answered: 0, rate: null, toReview: 0 });
});

test('point faible : module le moins réussi parmi ceux qui ont assez de réponses', () => {
  const data = sampleData();
  assert.equal(weakestModule(data).module, 'numerique');
  assert.equal(weakestModule(data, { minAnswers: 50 }), null);
  assert.equal(weakestModule(emptyData()), null);
});

test('examens : historique du plus récent au plus ancien, série chronologique en pourcentage', () => {
  const data = sampleData();
  assert.deepEqual(recentExams(data).map((item) => item.score), [30, 22, 24.5, 20]);
  assert.equal(recentExams(data, 2).length, 2);
  assert.deepEqual(examSeries(data).map((point) => Math.round(point.percent)), [57, 70, 63, 86]);
});

test('résumé des erreurs à revoir et enchaînement des modules', () => {
  const data = sampleData();
  const summary = reviewSummary(data);
  assert.equal(summary.total, 1 + 4 + 3, 'jugement : 3 situations sans le maximum');
  assert.equal(summary.first, 'verbal');
  assert.equal(nextModuleToReview(data, 'verbal'), 'numerique');
  assert.equal(nextModuleToReview(data, 'numerique'), 'jugement');
  assert.equal(nextModuleToReview(data, 'jugement'), null);
});

test('formatage à la française : pourcentages, nombres, durées, dates', async () => {
  const { formatPercent, formatNumber, formatDuration, formatDate } = await import('../assets/js/progression/stats.js');
  assert.equal(formatPercent(71.6), '72 %');
  assert.equal(formatNumber(27.75), '27,75');
  assert.equal(formatDuration(32 * 60_000 + 5_000), '32 min 05 s');
  assert.equal(formatDuration(45_400), '45 s');
  assert.equal(formatDuration(null), '–');
  assert.match(formatDate('2026-10-08T12:05:00.000Z', { short: true }), /^8 oct\.?$/);
});

test('le résumé textuel du graphique décrit l’évolution des scores', async () => {
  const { describeExamSeries } = await import('../assets/js/progression/stats.js');
  assert.equal(describeExamSeries([]), 'Aucun examen blanc enregistré.');
  assert.match(describeExamSeries([{ percent: 60 }]), /Un examen blanc enregistré, avec un score de 60/);
  const text = describeExamSeries(examSeries(sampleData()));
  assert.match(text, /sur 4 examens blancs, en progression : 57 % au premier, 86 % au dernier/);
  assert.match(text, /Meilleur score : 86 % ; plus bas : 57 %/);
});
