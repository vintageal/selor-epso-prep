/*
 * Suivi de progression : SEUL module qui lit et écrit dans le stockage du navigateur.
 *
 * Les données restent sur l'appareil (localStorage) : rien n'est envoyé ni partagé.
 * Chaque accès au stockage est protégé : si le stockage est indisponible (navigation
 * privée, données bloquées, quota atteint), le site fonctionne normalement et seules
 * les fonctions de suivi sont désactivées (`store.available` vaut false).
 *
 * Format des données (numéro de version de schéma SCHEMA_VERSION) :
 *   {
 *     version: 1,
 *     answers: [{ module, questionId, correct, date, durationMs, source, score? }],
 *     exams:   [{ date, durationMs, score, total, sections: { <module>: { score, total } }, endReason }],
 *     review:  { "<module>:<questionId>": { module, questionId, streak, failedAt } }
 *   }
 * - answers : une entrée par réponse (les plus anciennes sont effacées au-delà de LIMITS.answers) ;
 *   `source` vaut « entrainement », « revision » ou « examen » ; `score` (0 à 1) précise une
 *   réponse partielle au jugement situationnel.
 * - review : questions à revoir. Une erreur y place la question (streak = 0) ; elle en sort
 *   après REVIEW_STREAK bonnes réponses consécutives.
 *
 * Pour faire évoluer le format : incrémenter SCHEMA_VERSION et ajouter dans MIGRATIONS
 * la fonction qui convertit les données de la version précédente.
 */

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'selor-epso-prep:progression';
export const MODULE_IDS = ['abstrait', 'verbal', 'numerique', 'jugement'];
export const SOURCES = ['entrainement', 'revision', 'examen'];
export const REVIEW_STREAK = 2;
export const LIMITS = { answers: 5000, exams: 200, importBytes: 5 * 1024 * 1024 };

/** Migrations : MIGRATIONS[n] convertit des données de la version n en version n + 1. */
export const MIGRATIONS = {};

const BACKUP_KEY = `${STORAGE_KEY}:illisible`;
const PROBE_KEY = `${STORAGE_KEY}:test`;
const EXPORT_MARKER = 'selor-epso-prep';
const MAX_REPORTED_ERRORS = 5;

export const emptyData = () => ({ version: SCHEMA_VERSION, answers: [], exams: [], review: {} });
export const reviewKey = (module, questionId) => `${module}:${questionId}`;

/* ----- Validation ----- */

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isDate = (value) => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 120;
const isModule = (value) => MODULE_IDS.includes(value);
const isRatio = (value) => typeof value === 'number' && value >= 0 && value <= 1;
const isCount = (value) => Number.isFinite(value) && value >= 0;
const isDuration = (value) => value === null || isCount(value);

const answerErrors = (answer) => {
  if (!isObject(answer)) return ['entrée invalide'];
  const errors = [];
  if (!isModule(answer.module)) errors.push(`module « ${answer.module} » inconnu`);
  if (!isId(answer.questionId)) errors.push('identifiant de question invalide');
  if (typeof answer.correct !== 'boolean') errors.push('résultat (juste ou faux) manquant');
  if (!isDate(answer.date)) errors.push('date invalide');
  if (!isDuration(answer.durationMs)) errors.push('temps de réponse invalide');
  if (!SOURCES.includes(answer.source)) errors.push('origine de la réponse invalide');
  if (answer.score !== undefined && !isRatio(answer.score)) errors.push('score partiel invalide');
  return errors;
};

const examErrors = (exam) => {
  if (!isObject(exam)) return ['entrée invalide'];
  const errors = [];
  if (!isDate(exam.date)) errors.push('date invalide');
  if (!isDuration(exam.durationMs)) errors.push('durée invalide');
  if (!isCount(exam.total) || exam.total === 0 || !isCount(exam.score) || exam.score > exam.total) errors.push('score invalide');
  if (!isObject(exam.sections)) errors.push('scores par catégorie manquants');
  else {
    for (const [module, section] of Object.entries(exam.sections)) {
      if (!isModule(module) || !isObject(section) || !isCount(section.total) || !isCount(section.score) || section.score > section.total) {
        errors.push(`score de la catégorie « ${module} » invalide`);
      }
    }
  }
  return errors;
};

const reviewErrors = (key, entry) => {
  if (!isObject(entry) || !isModule(entry.module) || !isId(entry.questionId) || key !== reviewKey(entry.module, entry.questionId)) return ['entrée invalide'];
  const errors = [];
  if (!Number.isInteger(entry.streak) || entry.streak < 0 || entry.streak >= REVIEW_STREAK) errors.push('compteur de réussites invalide');
  if (!isDate(entry.failedAt)) errors.push('date invalide');
  return errors;
};

/** Vérifie des données au format actuel ; renvoie la liste des erreurs (vide si tout va bien). */
export function validateData(data) {
  if (!isObject(data)) return ['Le contenu n\'est pas un objet de données de progression.'];
  if (data.version !== SCHEMA_VERSION) return [`Version de schéma ${data.version} inattendue (version actuelle : ${SCHEMA_VERSION}).`];
  if (!Array.isArray(data.answers) || !Array.isArray(data.exams) || !isObject(data.review)) {
    return ['Les rubriques « answers », « exams » et « review » sont obligatoires.'];
  }
  const errors = [
    ...data.answers.flatMap((answer, index) => answerErrors(answer).map((error) => `Réponse n° ${index + 1} : ${error}.`)),
    ...data.exams.flatMap((exam, index) => examErrors(exam).map((error) => `Examen n° ${index + 1} : ${error}.`)),
    ...Object.entries(data.review).flatMap(([key, entry]) => reviewErrors(key, entry).map((error) => `Question à revoir « ${key} » : ${error}.`)),
  ];
  if (data.answers.length > LIMITS.answers) errors.push(`Trop de réponses (${data.answers.length}, maximum ${LIMITS.answers}).`);
  if (data.exams.length > LIMITS.exams) errors.push(`Trop d'examens (${data.exams.length}, maximum ${LIMITS.exams}).`);
  return errors;
}

/**
 * Met des données d'une version antérieure au format actuel, migration par migration.
 * Renvoie { data } ou { error, newer } (newer : données d'une version plus récente du site).
 */
export function migrate(raw, { migrations = MIGRATIONS, version = SCHEMA_VERSION } = {}) {
  if (!isObject(raw) || !Number.isInteger(raw.version) || raw.version < 1) {
    return { error: 'Format non reconnu : numéro de version de schéma absent ou invalide.' };
  }
  if (raw.version > version) {
    return { error: `Ces données viennent d'une version plus récente du site (schéma ${raw.version}, version prise en charge : ${version}).`, newer: true };
  }
  let data = raw;
  while (data.version < version) {
    const step = migrations[data.version];
    if (typeof step !== 'function') return { error: `Aucune migration disponible depuis la version ${data.version}.` };
    data = { ...step(data), version: data.version + 1 };
  }
  return { data };
}

/* ----- Mises à jour (fonctions pures : elles renvoient de nouvelles données) ----- */

/**
 * Ajoute une réponse et met à jour la liste des questions à revoir :
 * une erreur y place la question, REVIEW_STREAK bonnes réponses consécutives l'en retirent.
 */
export function applyAnswer(data, answer) {
  const key = reviewKey(answer.module, answer.questionId);
  const review = { ...data.review };
  const pending = review[key];
  if (!answer.correct) {
    review[key] = { module: answer.module, questionId: answer.questionId, streak: 0, failedAt: answer.date };
  } else if (pending) {
    const streak = pending.streak + 1;
    if (streak >= REVIEW_STREAK) delete review[key];
    else review[key] = { ...pending, streak };
  }
  return { ...data, answers: [...data.answers, answer].slice(-LIMITS.answers), review };
}

export const applyExam = (data, exam) => ({ ...data, exams: [...data.exams, exam].slice(-LIMITS.exams) });

/** Questions à revoir, de la plus ancienne erreur à la plus récente (éventuellement pour un seul module). */
export const reviewEntries = (data, module) =>
  Object.values(data?.review ?? {})
    .filter((entry) => !module || entry.module === module)
    .sort((a, b) => Date.parse(a.failedAt) - Date.parse(b.failedAt));

/**
 * Lit un fichier exporté : JSON, taille, version (avec migration) et contenu sont contrôlés.
 * Renvoie { data } ou { errors }.
 */
export function parseImport(text) {
  if (typeof text !== 'string' || text.trim() === '') return { errors: ['Le fichier est vide.'] };
  if (text.length > LIMITS.importBytes) return { errors: ['Le fichier est trop volumineux pour être un export de progression.'] };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { errors: ['Le fichier n\'est pas un fichier JSON valide.'] };
  }
  if (isObject(raw) && raw.application !== undefined && raw.application !== EXPORT_MARKER) {
    return { errors: ['Ce fichier ne provient pas de Prépa SELOR & EPSO.'] };
  }
  const { data, error } = migrate(raw);
  if (error) return { errors: [error] };
  const content = { version: data.version, answers: data.answers, exams: data.exams, review: data.review };
  const errors = validateData(content);
  if (errors.length > 0) {
    const extra = errors.length > MAX_REPORTED_ERRORS ? [`… et ${errors.length - MAX_REPORTED_ERRORS} autre(s) erreur(s).`] : [];
    return { errors: [...errors.slice(0, MAX_REPORTED_ERRORS), ...extra] };
  }
  return { data: content };
}

/* ----- Accès au stockage ----- */

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (données bloquées)
  }
};

const probe = (storage) => {
  if (!storage) return false;
  try {
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
};

const round = (value) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : null);

/**
 * Crée l'accès au suivi de progression. `storage` (interface de localStorage) et `now`
 * peuvent être injectés pour les tests ; par défaut : localStorage et l'heure courante.
 */
export function createStore({ storage = browserStorage(), now = () => new Date() } = {}) {
  let available = probe(storage);
  let reason = available ? null : 'unavailable';

  /** Données actuelles, ou null si le suivi est indisponible. */
  const read = () => {
    if (!available) return null;
    let text;
    try {
      text = storage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
    if (text === null) return emptyData();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
    const { data, error, newer } = raw === null ? { error: 'JSON illisible' } : migrate(raw);
    if (newer) {
      // Données d'une version plus récente du site : on ne les écrase surtout pas.
      available = false;
      reason = 'newer';
      return null;
    }
    if (error || validateData(data).length > 0) {
      // Données illisibles : on les met de côté une fois, puis on repart de zéro.
      try {
        if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, text);
      } catch {
        /* sauvegarde impossible : sans conséquence */
      }
      return emptyData();
    }
    return data;
  };

  const write = (data) => {
    if (!available) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      // Quota atteint : on garde la moitié la plus récente de l'historique des réponses.
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, answers: data.answers.slice(-Math.floor(data.answers.length / 2)) }));
        return true;
      } catch {
        return false;
      }
    }
  };

  /** Lit, transforme et réécrit les données (relues à chaque fois : plusieurs onglets peuvent écrire). */
  const update = (transform) => {
    const data = read();
    return data ? write(transform(data)) : false;
  };

  return {
    get available() {
      return available;
    },
    /** null si disponible ; « unavailable » (stockage bloqué) ou « newer » (données d'une version plus récente). */
    get reason() {
      return reason;
    },

    getData: read,

    /** Enregistre une réponse : module, identifiant de la question, juste ou faux, temps de réponse. */
    recordAnswer({ module, questionId, correct, durationMs = null, source = 'entrainement', score }) {
      const answer = { module, questionId, correct: Boolean(correct), date: now().toISOString(), durationMs: round(durationMs), source };
      if (score !== undefined) answer.score = Math.min(1, Math.max(0, score));
      if (answerErrors(answer).length > 0) return false;
      return update((data) => applyAnswer(data, answer));
    },

    /**
     * Enregistre un examen : score global, score par catégorie, durée. Les réponses de l'examen
     * (`answers` : mêmes champs que recordAnswer, plus leur `date`) sont enregistrées en même temps,
     * en une seule écriture ; une réponse incohérente est ignorée.
     */
    recordExam({ score, total, sections, durationMs, endReason = 'submitted', answers = [] }) {
      const date = now().toISOString();
      const exam = { date, durationMs: round(durationMs), score, total, sections, endReason };
      if (examErrors(exam).length > 0) return false;
      const entries = answers
        .map(({ module, questionId, correct, durationMs: time = null, score: partial, date: answeredAt }) => {
          const entry = { module, questionId, correct: Boolean(correct), date: isDate(answeredAt) ? answeredAt : date, durationMs: round(time), source: 'examen' };
          if (partial !== undefined) entry.score = Math.min(1, Math.max(0, partial));
          return entry;
        })
        .filter((entry) => answerErrors(entry).length === 0);
      return update((data) => entries.reduce(applyAnswer, applyExam(data, exam)));
    },

    reviewList: (module) => reviewEntries(read(), module),
    reviewCount: (module) => reviewEntries(read(), module).length,

    /** Retire une question de la liste à revoir (par exemple si elle n'existe plus dans la banque). */
    dropReview(module, questionId) {
      return update((data) => {
        const review = { ...data.review };
        delete review[reviewKey(module, questionId)];
        return { ...data, review };
      });
    },

    /** Contenu du fichier d'export (JSON lisible), ou null si le suivi est indisponible. */
    exportJson() {
      const data = read();
      return data ? JSON.stringify({ application: EXPORT_MARKER, exportedAt: now().toISOString(), ...data }, null, 2) : null;
    },

    /** Remplace les données par celles d'un fichier exporté, après contrôle. Renvoie { ok, data?, errors? }. */
    importJson(text) {
      if (!available) return { ok: false, errors: ['Le stockage de ce navigateur est indisponible.'] };
      const { data, errors } = parseImport(text);
      if (errors) return { ok: false, errors };
      return write(data) ? { ok: true, data } : { ok: false, errors: ['L\'enregistrement dans ce navigateur a échoué (espace insuffisant ?).'] };
    },

    /** Efface toute la progression enregistrée sur cet appareil. */
    reset() {
      if (!available) return false;
      try {
        storage.removeItem(STORAGE_KEY);
        storage.removeItem(BACKUP_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
