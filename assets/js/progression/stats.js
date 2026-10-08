/*
 * Suivi de progression : calculs affichés sur la page « Ma progression » (sans DOM, testés sous Node).
 * Les données sont celles de store.js.
 */
import { MODULE_IDS, reviewEntries } from './store.js';

/** Modules suivis : libellé et page (chemin relatif depuis la racine du site). */
export const MODULES = {
  abstrait: { label: 'Raisonnement abstrait', path: 'modules/abstrait/index.html' },
  verbal: { label: 'Raisonnement verbal', path: 'modules/verbal/index.html' },
  numerique: { label: 'Raisonnement numérique', path: 'modules/numerique/index.html' },
  jugement: { label: 'Jugement situationnel', path: 'modules/jugement/index.html' },
};

/** Nombre minimal de réponses pour qu'un module puisse être désigné comme point faible. */
export const WEAK_POINT_MIN_ANSWERS = 5;

/** Valeur d'une réponse entre 0 et 1 : score partiel (jugement situationnel) ou juste / faux. */
const answerValue = (answer) => answer.score ?? (answer.correct ? 1 : 0);

/**
 * Par module : nombre de questions faites (réponses données, en entraînement, en révision
 * et en examen), taux de réussite (0 à 1, null sans réponse) et nombre d'erreurs à revoir.
 */
export function moduleStats(data) {
  return Object.fromEntries(
    MODULE_IDS.map((module) => {
      const answers = (data?.answers ?? []).filter((answer) => answer.module === module);
      const total = answers.reduce((sum, answer) => sum + answerValue(answer), 0);
      return [module, { answered: answers.length, rate: answers.length ? total / answers.length : null, toReview: reviewEntries(data, module).length }];
    }),
  );
}

/** Point faible : le module le moins réussi parmi ceux qui comptent assez de réponses, ou null. */
export function weakestModule(data, { minAnswers = WEAK_POINT_MIN_ANSWERS } = {}) {
  const candidates = Object.entries(moduleStats(data))
    .filter(([, stats]) => stats.answered >= minAnswers)
    .sort(([, a], [, b]) => a.rate - b.rate || b.answered - a.answered);
  if (candidates.length === 0) return null;
  const [module, stats] = candidates[0];
  return { module, ...stats };
}

/** Pourcentage de réussite d'un examen. */
export const examPercent = (exam) => (exam.total ? (exam.score / exam.total) * 100 : 0);

/** Derniers examens, du plus récent au plus ancien. */
export const recentExams = (data, limit = 10) => [...(data?.exams ?? [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit);

/** Points du graphique d'évolution : les derniers examens dans l'ordre chronologique, en pourcentage. */
export const examSeries = (data, limit = 20) =>
  recentExams(data, limit)
    .reverse()
    .map((exam) => ({ date: exam.date, percent: examPercent(exam) }));

/** Nombre total d'erreurs à revoir et premier module concerné (dans l'ordre des modules). */
export function reviewSummary(data) {
  const counts = Object.fromEntries(MODULE_IDS.map((module) => [module, reviewEntries(data, module).length]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { total, counts, first: MODULE_IDS.find((module) => counts[module] > 0) ?? null };
}

/** Module suivant (après `module`, dans l'ordre des modules) qui a encore des erreurs à revoir, ou null. */
export function nextModuleToReview(data, module) {
  const { counts } = reviewSummary(data);
  return MODULE_IDS.slice(MODULE_IDS.indexOf(module) + 1).find((candidate) => counts[candidate] > 0) ?? null;
}

/* ----- Formatage (français de Belgique) ----- */

const NBSP = '\u00a0';

/** Pourcentage arrondi : « 72 % ». */
export const formatPercent = (value) => `${Math.round(value)}${NBSP}%`;

/** Nombre éventuellement décimal : « 27,75 ». */
export const formatNumber = (value) => value.toLocaleString('fr-BE', { maximumFractionDigits: 2 });

/** Durée : « 32 min 05 s », « 45 s ». */
export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '–';
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}${NBSP}min ${String(seconds % 60).padStart(2, '0')}${NBSP}s` : `${seconds}${NBSP}s`;
}

/** Date et heure : « 8 oct. 2026, 14:05 » ; `short` : « 8 oct. ». */
export const formatDate = (iso, { short = false } = {}) =>
  new Intl.DateTimeFormat('fr-BE', short ? { day: 'numeric', month: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Résumé textuel du graphique d'évolution des examens (alternative pour les lecteurs d'écran). */
export function describeExamSeries(points) {
  if (points.length === 0) return 'Aucun examen blanc enregistré.';
  const percents = points.map((point) => point.percent);
  if (points.length === 1) return `Un examen blanc enregistré, avec un score de ${formatPercent(percents[0])}.`;
  const [first, last] = [percents[0], percents.at(-1)];
  const trend = last > first ? 'en progression' : last < first ? 'en recul' : 'stable';
  return `Évolution de vos scores sur ${points.length} examens blancs, ${trend} : ${formatPercent(first)} au premier, ${formatPercent(last)} au dernier. Meilleur score : ${formatPercent(Math.max(...percents))} ; plus bas : ${formatPercent(Math.min(...percents))}.`;
}
