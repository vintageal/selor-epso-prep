/*
 * Éléments d'interface du raisonnement numérique, partagés par le module
 * d'entraînement et le mode examen : tableau, graphiques, propositions et
 * correction détaillée (données, formule, calcul étape par étape).
 *
 * Graphiques (barres, courbes, secteurs) : traits fins, extrémités arrondies, étiquettes
 * de valeur sobres, infobulle au survol et au clavier, et toujours une vue « Tableau » équivalente.
 */
import { createElement, hiddenFromScreenReaders } from '../lib/dom.js';
import { t, typography } from '../lib/i18n.js';
import { createTooltip, svgElement } from '../lib/viz.js';
import {
  OPTION_LETTERS,
  SKILLS,
  computeSteps,
  formatAnswer,
  formatData,
  formatNumber,
  usedData,
} from './quiz.js';

/** Graduations « rondes » couvrant [min, max] (pas de 1, 2, 2,5 ou 5 × 10ⁿ). */
const niceTicks = (min, max, target = 5) => {
  const raw = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, i) => start + i * step);
};

/** Légende : une entrée par série (colonnes pour les barres, lignes pour les courbes). */
const legend = (entries, keyType) => {
  const list = createElement('ul', 'viz-legend');
  entries.forEach(({ label }, index) => {
    const item = createElement('li');
    const key = hiddenFromScreenReaders(createElement('span', `viz-key viz-key--${keyType}`));
    key.dataset.series = String(index + 1);
    item.append(key, label);
    list.append(item);
  });
  return list;
};

/* ----- Tableau ----- */

/** Tableau de données : la vue de référence (et l'équivalent accessible de chaque graphique). */
export function dataTable(scenario) {
  const wrapper = createElement('div', 'data-table-wrap');
  const table = createElement('table', 'data-table');
  table.append(createElement('caption', 'sr-only', scenario.title));

  const head = createElement('thead');
  const headRow = createElement('tr');
  headRow.append(createElement('th', '', scenario.rowHeader ?? ''));
  for (const column of scenario.columns) headRow.append(createElement('th', '', column.label));
  headRow.querySelectorAll('th').forEach((cell) => cell.setAttribute('scope', 'col'));
  head.append(headRow);

  const body = createElement('tbody');
  for (const row of scenario.rows) {
    const line = createElement('tr', row.total ? 'is-total' : '');
    const header = createElement('th', '', row.label);
    header.setAttribute('scope', 'row');
    line.append(header, ...scenario.columns.map(({ key }) => createElement('td', '', formatData(scenario, key, row.values[key], { withUnits: false }))));
    body.append(line);
  }
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

/* ----- Graphique en barres horizontales (catégories × séries) ----- */

export function barChart(scenario) {
  const chart = createElement('div', 'bar-chart');
  const series = scenario.columns;
  const max = Math.max(...scenario.rows.flatMap((row) => series.map(({ key }) => row.values[key])));
  const tooltip = createTooltip(chart);
  if (series.length > 1) chart.append(legend(series, 'bar'));

  const plot = createElement('div', 'bar-chart__plot');
  for (const row of scenario.rows) {
    const group = createElement('div', 'bar-group');
    group.tabIndex = 0;
    group.setAttribute(
      'aria-label',
      t('numerique.barGroup', {
        label: row.label,
        values: series.map(({ key, label }) => `${label}, ${formatData(scenario, key, row.values[key])}`).join(t('common.listSeparator')),
      }),
    );
    const bars = hiddenFromScreenReaders(createElement('div', 'bar-group__bars'));
    series.forEach(({ key }, index) => {
      const line = createElement('div', 'bar-line');
      const bar = createElement('span', 'bar');
      bar.dataset.series = String(index + 1);
      bar.style.width = `${(row.values[key] / max) * 100}%`;
      line.append(bar, createElement('span', 'bar__value', formatData(scenario, key, row.values[key], { withUnits: false })));
      bars.append(line);
    });
    group.append(hiddenFromScreenReaders(createElement('span', 'bar-group__label', row.label)), bars);

    const showTooltip = (x, y) =>
      tooltip.show(
        row.label,
        series.map(({ key, label }, index) => ({ label, value: formatData(scenario, key, row.values[key]), key: 'bar', series: index + 1 })),
        x,
        y,
      );
    group.addEventListener('pointermove', (event) => {
      const box = chart.getBoundingClientRect();
      showTooltip(event.clientX - box.left, event.clientY - box.top);
    });
    group.addEventListener('pointerleave', () => tooltip.hide());
    group.addEventListener('focus', () => showTooltip(group.offsetLeft + group.offsetWidth / 2, group.offsetTop));
    group.addEventListener('blur', () => tooltip.hide());
    plot.append(group);
  }
  chart.append(plot);
  return chart;
}

/* ----- Graphique en courbes (séries × années), dessiné à la largeur réelle ----- */

export function lineChart(scenario) {
  const chart = createElement('div', 'line-chart');
  chart.append(legend(scenario.rows, 'line'));
  const stage = createElement('div', 'line-chart__stage');
  chart.append(stage);
  const tooltip = createTooltip(stage);

  const columns = scenario.columns;
  const values = scenario.rows.flatMap((row) => columns.map(({ key }) => row.values[key]));
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
  let activeIndex = columns.length - 1;
  let geometry = null;

  const svg = svgElement('svg', { class: 'line-chart__svg', role: 'img', tabindex: 0 });
  svg.setAttribute(
    'aria-label',
    typography(t('numerique.lineChart', { title: scenario.title })),
  );
  stage.append(svg);

  const showAt = (index) => {
    if (!geometry) return;
    activeIndex = Math.max(0, Math.min(index, columns.length - 1));
    const { x, crosshair, markers } = geometry;
    crosshair.setAttribute('x1', x(activeIndex));
    crosshair.setAttribute('x2', x(activeIndex));
    crosshair.style.visibility = 'visible';
    markers.forEach((group) => group.forEach((marker, i) => marker.classList.toggle('is-active', i === activeIndex)));
    const { key, label } = columns[activeIndex];
    tooltip.show(
      label,
      scenario.rows.map((row, index) => ({ label: row.label, value: formatData(scenario, key, row.values[key]), key: 'line', series: index + 1 })),
      x(activeIndex),
      geometry.top + 12,
    );
  };
  const hide = () => {
    if (!geometry) return;
    geometry.crosshair.style.visibility = 'hidden';
    geometry.markers.forEach((group) => group.forEach((marker) => marker.classList.remove('is-active')));
    tooltip.hide();
  };

  const draw = () => {
    const width = Math.max(280, stage.clientWidth);
    const height = width < 480 ? 220 : 260;
    const margin = { top: 14, right: 58, bottom: 28, left: 46 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const [low, high] = [ticks[0], ticks.at(-1)];
    const x = (i) => margin.left + (columns.length === 1 ? plotWidth / 2 : (i * plotWidth) / (columns.length - 1));
    const y = (value) => margin.top + plotHeight - ((value - low) / (high - low)) * plotHeight;

    tooltip.hide();
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    for (const tick of ticks) {
      svg.append(svgElement('line', { class: 'line-chart__grid', x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }));
      const label = svgElement('text', { class: 'line-chart__tick', x: margin.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      label.textContent = formatNumber(tick);
      svg.append(label);
    }
    columns.forEach(({ label }, i) => {
      const text = svgElement('text', { class: 'line-chart__tick', x: x(i), y: height - 8, 'text-anchor': 'middle' });
      text.textContent = label;
      svg.append(text);
    });

    const crosshair = svgElement('line', { class: 'line-chart__crosshair', y1: margin.top, y2: margin.top + plotHeight });
    crosshair.style.visibility = 'hidden';
    svg.append(crosshair);

    const ends = [];
    const markers = scenario.rows.map((row, index) => {
      const points = columns.map(({ key }, i) => [x(i), y(row.values[key])]);
      svg.append(svgElement('polyline', { class: 'line-chart__line', 'data-series': index + 1, points: points.map((point) => point.join(',')).join(' ') }));
      ends.push({ y: points.at(-1)[1], text: formatData(scenario, columns.at(-1).key, row.values[columns.at(-1).key], { withUnits: false }) });
      return points.map(([cx, cy]) => {
        const marker = svgElement('circle', { class: 'line-chart__marker', 'data-series': index + 1, cx, cy, r: 4 });
        svg.append(marker);
        return marker;
      });
    });

    // Étiquettes de fin de courbe, seulement si elles ne se chevauchent pas (sinon légende + infobulle).
    const separated = ends.every((end, i) => ends.every((other, j) => i === j || Math.abs(end.y - other.y) >= 16));
    if (separated) {
      for (const end of ends) {
        const label = svgElement('text', { class: 'line-chart__end', x: x(columns.length - 1) + 10, y: end.y, 'dominant-baseline': 'middle' });
        label.textContent = end.text;
        svg.append(label);
      }
    }

    const hit = svgElement('rect', { class: 'line-chart__hit', x: margin.left - 12, y: margin.top, width: plotWidth + 24, height: plotHeight });
    hit.addEventListener('pointermove', (event) => {
      const box = svg.getBoundingClientRect();
      const position = ((event.clientX - box.left - margin.left) / plotWidth) * (columns.length - 1);
      showAt(Math.round(position));
    });
    hit.addEventListener('pointerleave', hide);
    svg.append(hit);
    geometry = { x, top: margin.top, crosshair, markers };
  };

  svg.addEventListener('focus', () => showAt(activeIndex));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation(); // les flèches servent ici à lire le graphique, pas à changer de question
    showAt(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  // Redessine à la largeur réelle ; s'arrête quand le graphique quitte la page (changement de question).
  const observer = new ResizeObserver(() => {
    if (stage.isConnected) draw();
    else observer.disconnect();
  });
  observer.observe(stage);
  return chart;
}

/* ----- Graphique en secteurs (anneau) : une colonne, une part par ligne ----- */

/** Chemin SVG d'un secteur d'anneau entre deux angles (en radians, 0 = midi, sens horaire). */
const ringSlice = (cx, cy, outer, inner, start, end) => {
  const point = (radius, angle) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)].map((v) => v.toFixed(2)).join(' ');
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(outer, start)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)}`,
    'Z',
  ].join(' ');
};

export function pieChart(scenario) {
  const key = scenario.pieColumn;
  const column = scenario.columns.find((candidate) => candidate.key === key);
  const rows = scenario.rows.filter((row) => !row.total);
  const total = rows.reduce((sum, row) => sum + row.values[key], 0);

  const chart = createElement('div', 'pie-chart');
  const tooltip = createTooltip(chart);
  const size = 220;
  const [cx, cy, outer, inner] = [size / 2, size / 2, size / 2 - 4, size / 2 - 50];
  const svg = svgElement('svg', { class: 'pie-chart__svg', viewBox: `0 0 ${size} ${size}`, role: 'img', tabindex: 0 });
  svg.setAttribute(
    'aria-label',
    typography(t('numerique.pieChart', { title: scenario.title, column: column.label })),
  );

  let angle = 0;
  const slices = rows.map((row, index) => {
    const sweep = (row.values[key] / total) * 2 * Math.PI;
    const path = svgElement('path', { class: 'pie-chart__slice', 'data-series': index + 1, d: ringSlice(cx, cy, outer, inner, angle, angle + sweep) });
    const middle = angle + sweep / 2;
    angle += sweep;
    svg.append(path);
    return { row, path, middle, series: index + 1 };
  });

  const list = createElement('ul', 'pie-chart__legend');
  const items = slices.map(({ row, series }) => {
    const item = createElement('li');
    const swatch = hiddenFromScreenReaders(createElement('span', 'viz-key viz-key--bar'));
    swatch.dataset.series = String(series);
    item.append(swatch, createElement('span', 'pie-chart__label', row.label), createElement('span', 'pie-chart__value', formatData(scenario, key, row.values[key])));
    list.append(item);
    return item;
  });

  let active = -1;
  const show = (index) => {
    active = (index + slices.length) % slices.length;
    const { row, middle, series } = slices[active];
    slices.forEach((slice, i) => slice.path.classList.toggle('is-active', i === active));
    items.forEach((item, i) => item.classList.toggle('is-active', i === active));
    const box = svg.getBoundingClientRect();
    const host = chart.getBoundingClientRect();
    const scale = box.width / size;
    const radius = (outer + inner) / 2;
    tooltip.show(
      row.label,
      [{ label: column.label, value: formatData(scenario, key, row.values[key]), key: 'bar', series }],
      box.left - host.left + (cx + radius * Math.sin(middle)) * scale,
      box.top - host.top + (cy - radius * Math.cos(middle)) * scale,
    );
  };
  const hide = () => {
    active = -1;
    slices.forEach((slice) => slice.path.classList.remove('is-active'));
    items.forEach((item) => item.classList.remove('is-active'));
    tooltip.hide();
  };

  slices.forEach(({ path }, index) => {
    path.addEventListener('pointerenter', () => show(index));
    path.addEventListener('pointerleave', hide);
  });
  svg.addEventListener('focus', () => show(Math.max(active, 0)));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation(); // les flèches servent ici à lire le graphique, pas à changer de question
    show(active + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1));
  });

  const figure = createElement('div', 'pie-chart__figure');
  figure.append(svg);
  chart.append(figure, list);
  return chart;
}

/* ----- Visuel complet d'un scénario ----- */

/** Visuel d'un scénario : tableau, ou graphique avec bascule « Graphique / Tableau ». */
export function scenarioVisual(scenario) {
  const visual = createElement('div', 'viz');
  if (scenario.display === 'table') {
    visual.append(dataTable(scenario));
    return visual;
  }

  const charts = { bar: barChart, line: lineChart, pie: pieChart };
  const views = { chart: charts[scenario.display](scenario), table: dataTable(scenario) };
  const toggle = createElement('div', 'viz-toggle');
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', t('numerique.dataView'));
  const show = (name) => {
    views.chart.hidden = name !== 'chart';
    views.table.hidden = name !== 'table';
    toggle.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  };
  for (const [name, label] of [['chart', t('numerique.chart')], ['table', t('numerique.table')]]) {
    const button = createElement('button', 'viz-toggle__button', label);
    button.type = 'button';
    button.dataset.view = name;
    button.addEventListener('click', () => show(name));
    toggle.append(button);
  }
  visual.append(toggle, views.chart, views.table);
  show('chart');
  return visual;
}

/* ----- Propositions et correction ----- */

/** Bouton d'une proposition chiffrée (A à D). */
export function optionButton(question, option, index) {
  const button = createElement('button', 'choice');
  button.type = 'button';
  button.dataset.index = String(index);
  button.append(
    hiddenFromScreenReaders(createElement('span', 'choice__icon', OPTION_LETTERS[index])),
    createElement('span', 'choice__label', formatAnswer(option.value, question.format)),
    hiddenFromScreenReaders(createElement('kbd', 'kbd choice__key', OPTION_LETTERS[index])),
  );
  button.setAttribute('aria-label', typography(t('common.option', { letter: OPTION_LETTERS[index], text: formatAnswer(option.value, question.format) })));
  return button;
}

const optionText = (question, index) => `${OPTION_LETTERS[index]} (${formatAnswer(question.options[index].value, question.format)})`;

/** Phrase de verdict : réponse choisie et bonne réponse. */
export function answerSentence(question, chosen) {
  const expected = optionText(question, question.answer);
  if (chosen === null || chosen === undefined) return t('common.noAnswer', { correct: expected });
  if (chosen === question.answer) return t('common.correctChoice', { chosen: expected });
  return t('common.wrongChoice', { chosen: optionText(question, chosen), correct: expected });
}

/** Explication de l'erreur correspondant à la proposition fautive choisie. */
export function errorHint(question, chosen) {
  const why = question.options[chosen]?.why;
  if (chosen === question.answer || !why) return null;
  const hint = createElement('p', 'error-hint');
  hint.append(createElement('strong', '', typography(t('numerique.errorHint'))), typography(why));
  return hint;
}

/** Correction détaillée : compétence, données utilisées, formule, calcul étape par étape. */
export function calculationDetails(scenario, question) {
  const { steps, result } = computeSteps(scenario, question);

  const data = createElement('ul', 'calc-data');
  for (const { label, value } of usedData(scenario, question)) {
    const item = createElement('li');
    item.append(createElement('span', '', label), createElement('strong', '', value));
    data.append(item);
  }

  const list = createElement('ol', 'calc-steps');
  for (const step of steps) {
    const item = createElement('li');
    item.append(
      createElement('span', 'calc-step__label', step.label),
      createElement('span', 'calc-step__math', `${step.calculation} ${step.approximate ? '≈' : '='} ${step.result}`),
    );
    list.append(item);
  }

  const resultLine = createElement('p', 'calc-result');
  resultLine.append(typography(t('numerique.roundedResult')), createElement('strong', '', formatAnswer(result, question.format)));

  const tip = createElement('p', 'method-tip');
  tip.append(createElement('strong', '', typography(t('common.methodReminder'))), typography(SKILLS[question.skill].tip));

  return [
    createElement('p', 'feedback__rule', typography(t('numerique.skill', { label: SKILLS[question.skill].label }))),
    createElement('p', 'feedback__label', t('numerique.usedData')),
    data,
    createElement('p', 'feedback__label', t('numerique.formula')),
    createElement('p', 'calc-formula', question.formula),
    createElement('p', 'feedback__label', t('numerique.steps')),
    list,
    resultLine,
    createElement('p', 'feedback__label', t('numerique.keyPoint')),
    createElement('p', 'feedback__text', typography(question.explanation)),
    tip,
  ];
}
