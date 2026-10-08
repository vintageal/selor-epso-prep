/*
 * Page « Ma progression » : réussite par module, point faible, erreurs à revoir,
 * évolution et historique des examens blancs, export / import / réinitialisation.
 * Toutes les données viennent du stockage du navigateur (store.js) : rien n'est envoyé.
 */
import { createElement, moveFocusTo } from '../lib/dom.js';
import { frenchTypography } from '../verbal/quiz.js';
import { examChart } from './chart.js';
import { REVIEW_ALL, reviewHref } from './review.js';
import {
  MODULES,
  WEAK_POINT_MIN_ANSWERS,
  examPercent,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  moduleStats,
  recentExams,
  reviewSummary,
  weakestModule,
} from './stats.js';
import { MODULE_IDS, REVIEW_STREAK, STORAGE_KEY, createStore } from './store.js';

const ROOT = '../';
const HISTORY_SIZE = 10;
const CHART_SIZE = 20;
/** Libellé court d'un module : « Abstrait », « Verbal », « Numérique », « Jugement situationnel ». */
const shortLabel = (module) => {
  const label = MODULES[module].label.replace('Raisonnement ', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  title: $('h1'),
  unavailable: $('[data-unavailable]'),
  empty: $('[data-empty]'),
  progress: $('[data-progress]'),
  overview: $('[data-overview]'),
  weakPoint: $('[data-weak-point]'),
  reviewAll: $('[data-review-all]'),
  modules: $('[data-modules]'),
  examChart: $('[data-exam-chart]'),
  historyTitle: $('[data-history-title]'),
  history: $('[data-exam-history]'),
  dataSection: $('[data-data-section]'),
  exportButton: $('[data-export]'),
  importButton: $('[data-import-button]'),
  importInput: $('[data-import]'),
  reset: $('[data-reset]'),
  status: $('[data-data-status]'),
  confirm: $('[data-confirm]'),
  confirmTitle: $('[data-confirm-title]'),
  confirmText: $('[data-confirm-text]'),
  confirmCancel: $('[data-confirm-cancel]'),
  confirmOk: $('[data-confirm-ok]'),
};

const store = createStore();
const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`;
const link = (href, text, className = 'font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900') => {
  const anchor = createElement('a', className, text);
  anchor.href = href;
  return anchor;
};

/* ----- Rendu ----- */

const tile = (label, value) => {
  const item = createElement('div', 'summary-stat');
  item.append(createElement('dt', 'summary-stat__label', label), createElement('dd', 'summary-stat__value', value));
  return item;
};

const renderOverview = (data, stats, review) => {
  const answered = data.answers.length;
  const rated = MODULE_IDS.map((module) => stats[module]).filter((entry) => entry.answered > 0);
  const globalRate = answered ? rated.reduce((sum, entry) => sum + entry.rate * entry.answered, 0) / answered : null;
  ui.overview.replaceChildren(
    tile('Questions faites', String(answered)),
    tile('Taux de réussite', globalRate === null ? '–' : formatPercent(globalRate * 100)),
    tile('Examens blancs', String(data.exams.length)),
    tile('Erreurs à revoir', String(review.total)),
  );
};

const renderWeakPoint = (data) => {
  const weak = weakestModule(data);
  if (!weak) {
    ui.weakPoint.replaceChildren(
      createElement('p', 'text-sm text-slate-600', frenchTypography(`Répondez à au moins ${WEAK_POINT_MIN_ANSWERS} questions d'un module pour identifier votre point faible.`)),
    );
    return;
  }
  const { label, path } = MODULES[weak.module];
  ui.weakPoint.replaceChildren(
    createElement('p', 'text-lg font-semibold text-slate-900', label),
    createElement('p', 'mt-1 text-sm text-slate-600', frenchTypography(`Votre catégorie la moins réussie : ${formatPercent(weak.rate * 100)} de réussite sur ${plural(weak.answered, 'question faite', 'questions faites')}.`)),
    link(`${ROOT}${path}`, `Travailler le module « ${label} »`, 'mt-4 inline-flex items-center justify-center rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800'),
  );
};

const renderReviewAll = (review) => {
  if (review.total === 0) {
    ui.reviewAll.replaceChildren(createElement('p', 'text-sm text-slate-600', 'Aucune erreur à revoir pour le moment. Bravo !'));
    return;
  }
  const details = MODULE_IDS.filter((module) => review.counts[module] > 0)
    .map((module) => `${shortLabel(module)} : ${review.counts[module]}`)
    .join(' · ');
  ui.reviewAll.replaceChildren(
    createElement('p', 'text-lg font-semibold text-slate-900', plural(review.total, 'question ratée', 'questions ratées')),
    createElement('p', 'mt-1 text-sm text-slate-600', frenchTypography(`${details}. Une question sort de la liste après ${REVIEW_STREAK} bonnes réponses consécutives.`)),
    link(reviewHref(review.first, REVIEW_ALL, ROOT), `Revoir toutes mes erreurs (${review.total})`, 'mt-4 inline-flex items-center justify-center rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-brand-950 transition hover:bg-accent-300'),
  );
};

const meter = (rate) => {
  const track = createElement('div', 'progress-meter');
  track.setAttribute('aria-hidden', 'true');
  const fill = createElement('span');
  fill.style.width = `${Math.round((rate ?? 0) * 100)}%`;
  track.append(fill);
  return track;
};

const renderModules = (stats) => {
  ui.modules.replaceChildren(
    ...MODULE_IDS.map((module) => {
      const { answered, rate, toReview } = stats[module];
      const { label, path } = MODULES[module];
      const card = createElement('li', 'flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm');
      const head = createElement('div', 'flex items-baseline justify-between gap-3');
      head.append(createElement('h3', 'font-semibold text-slate-900', label), createElement('span', 'shrink-0 text-sm text-slate-500', plural(answered, 'question faite', 'questions faites')));
      const score = createElement('p', 'mt-3 flex items-baseline gap-2');
      score.append(
        createElement('span', 'text-2xl font-bold text-brand-900', rate === null ? '–' : formatPercent(rate * 100)),
        createElement('span', 'text-sm text-slate-500', rate === null ? 'pas encore de réponse' : 'de réussite'),
      );
      const actions = createElement('p', 'mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm');
      if (toReview > 0) actions.append(link(reviewHref(module, '1', ROOT), `Revoir mes erreurs (${toReview})`));
      actions.append(link(`${ROOT}${path}`, answered ? 'S\'entraîner' : 'Commencer'));
      card.append(head, score, meter(rate), actions);
      return card;
    }),
  );
};

const renderExams = (data) => {
  const points = recentExams(data, CHART_SIZE)
    .reverse()
    .map((exam) => ({ date: exam.date, percent: examPercent(exam), label: `${formatNumber(exam.score)} / ${exam.total} points` }));
  if (points.length === 0) {
    ui.examChart.replaceChildren(
      createElement('p', 'text-sm text-slate-600', 'Aucun examen blanc pour le moment. Votre score apparaîtra ici après chaque examen.'),
      link(`${ROOT}modules/examen/index.html`, 'Passer un examen blanc', 'mt-3 inline-flex font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900'),
    );
    ui.historyTitle.hidden = true;
    ui.history.replaceChildren();
    return;
  }
  ui.examChart.replaceChildren(examChart(points));

  const exams = recentExams(data, HISTORY_SIZE);
  ui.historyTitle.hidden = false;
  ui.historyTitle.textContent = exams.length > 1 ? `Historique des ${exams.length} derniers examens` : 'Historique';
  const wrapper = createElement('div', 'data-table-wrap');
  const table = createElement('table', 'data-table progress-table');
  table.append(createElement('caption', 'sr-only', 'Historique des derniers examens blancs, du plus récent au plus ancien'));
  const head = createElement('tr');
  for (const label of ['Date', 'Score', 'Réussite', 'Durée', ...MODULE_IDS.map(shortLabel)]) {
    const cell = createElement('th', '', label);
    cell.scope = 'col';
    head.append(cell);
  }
  const thead = createElement('thead');
  thead.append(head);
  const body = createElement('tbody');
  for (const exam of exams) {
    const row = createElement('tr');
    const date = createElement('th', '', formatDate(exam.date));
    date.scope = 'row';
    row.append(
      date,
      createElement('td', '', `${formatNumber(exam.score)} / ${exam.total}`),
      createElement('td', '', formatPercent(examPercent(exam))),
      createElement('td', '', `${formatDuration(exam.durationMs)}${exam.endReason === 'timeout' ? ' (temps écoulé)' : ''}`),
      ...MODULE_IDS.map((module) => {
        const section = exam.sections[module];
        return createElement('td', '', section ? `${formatNumber(section.score)} / ${section.total}` : '–');
      }),
    );
    body.append(row);
  }
  table.append(thead, body);
  wrapper.append(table);
  ui.history.replaceChildren(wrapper);
};

const render = () => {
  ui.dataSection.hidden = !store.available;
  if (!store.available) {
    ui.unavailable.textContent = frenchTypography(
      store.reason === 'newer'
        ? 'Votre progression a été enregistrée par une version plus récente du site. Rechargez la page (ou videz le cache du navigateur) pour la consulter.'
        : 'Le suivi de progression est désactivé : ce navigateur bloque le stockage local (navigation privée ou données bloquées). Les exercices et l\'examen restent utilisables normalement.',
    );
    ui.unavailable.hidden = false;
    ui.empty.hidden = true;
    ui.progress.hidden = true;
    return;
  }
  const data = store.getData();
  const hasData = data.answers.length > 0 || data.exams.length > 0;
  ui.empty.hidden = hasData;
  ui.progress.hidden = !hasData;
  ui.exportButton.disabled = !hasData;
  ui.reset.disabled = !hasData && Object.keys(data.review).length === 0;
  if (!hasData) return;

  const stats = moduleStats(data);
  const review = reviewSummary(data);
  renderOverview(data, stats, review);
  renderWeakPoint(data);
  renderReviewAll(review);
  renderModules(stats);
  renderExams(data);
};

/* ----- Gestion des données ----- */

const showStatus = (kind, message, details = []) => {
  const box = createElement('div', `data-status data-status--${kind}`);
  box.append(createElement('p', 'font-semibold', frenchTypography(message)));
  if (details.length > 0) {
    const list = createElement('ul', 'mt-2 list-disc space-y-1 pl-5');
    list.append(...details.map((detail) => createElement('li', '', detail)));
    box.append(list);
  }
  ui.status.replaceChildren(box);
};

/** Fenêtre de confirmation ; renvoie une promesse résolue à true (confirmé) ou false. */
const confirmAction = ({ title, text, ok }) =>
  new Promise((resolve) => {
    ui.confirmTitle.textContent = title;
    ui.confirmText.textContent = frenchTypography(text);
    ui.confirmOk.textContent = ok;
    const close = (result) => {
      ui.confirmOk.removeEventListener('click', onOk);
      ui.confirm.removeEventListener('close', onClose);
      if (ui.confirm.open) ui.confirm.close();
      resolve(result);
    };
    const onOk = () => close(true);
    const onClose = () => close(false);
    ui.confirmOk.addEventListener('click', onOk);
    ui.confirm.addEventListener('close', onClose);
    ui.confirm.showModal();
    ui.confirmCancel.focus();
  });

ui.confirmCancel.addEventListener('click', () => ui.confirm.close());

ui.exportButton.addEventListener('click', () => {
  const json = store.exportJson();
  if (!json) return;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = createElement('a');
  anchor.href = url;
  anchor.download = `progression-selor-epso-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus('success', 'Fichier exporté. Conservez-le, puis importez-le sur un autre appareil pour y retrouver votre progression.');
});

ui.importButton.addEventListener('click', () => ui.importInput.click());

ui.importInput.addEventListener('change', async () => {
  const [file] = ui.importInput.files;
  ui.importInput.value = '';
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch {
    showStatus('error', 'Impossible de lire ce fichier.');
    return;
  }
  const current = store.getData();
  if (current && (current.answers.length > 0 || current.exams.length > 0)) {
    const confirmed = await confirmAction({
      title: 'Remplacer votre progression ?',
      text: 'La progression enregistrée sur cet appareil sera remplacée par celle du fichier. Exportez-la d\'abord si vous souhaitez la conserver.',
      ok: 'Remplacer',
    });
    if (!confirmed) {
      ui.importButton.focus();
      return;
    }
  }
  const result = store.importJson(text);
  if (result.ok) {
    render();
    showStatus('success', `Progression importée : ${plural(result.data.answers.length, 'réponse')}, ${plural(result.data.exams.length, 'examen')} et ${plural(Object.keys(result.data.review).length, 'erreur')} à revoir.`);
  } else {
    showStatus('error', 'Fichier refusé : il ne correspond pas à un export de progression valide. Votre progression actuelle n\'a pas été modifiée.', result.errors);
  }
  ui.importButton.focus();
});

ui.reset.addEventListener('click', async () => {
  const confirmed = await confirmAction({
    title: 'Réinitialiser votre progression ?',
    text: 'Toutes vos réponses, vos examens et vos erreurs à revoir seront effacés de cet appareil. Cette action est définitive.',
    ok: 'Tout effacer',
  });
  if (!confirmed) {
    ui.reset.focus();
    return;
  }
  const done = store.reset();
  render();
  showStatus(done ? 'success' : 'error', done ? 'Progression réinitialisée : toutes les données de suivi ont été effacées de cet appareil.' : 'La réinitialisation a échoué.');
  moveFocusTo(ui.title);
});

/* ----- Démarrage ----- */

render();
// Mise à jour si la progression change dans un autre onglet, ou au retour sur la page (cache du navigateur).
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) render();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) render();
});
