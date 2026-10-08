/*
 * Graphique d'évolution des scores d'examen blanc : SVG simple, sans bibliothèque.
 * Une seule courbe (pas de légende : le titre de la section la nomme), axe de 0 à 100 %,
 * infobulle au survol et au clavier (flèches gauche et droite), dessin à la largeur réelle.
 * Alternative textuelle : résumé dans l'attribut aria-label, et tableau des données à côté.
 */
import { createElement } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { createTooltip, svgElement } from '../lib/viz.js';
import { describeExamSeries, formatDate, formatPercent } from './stats.js';

const TICKS = [0, 25, 50, 75, 100];

/** `points` : [{ date, percent, label }] dans l'ordre chronologique. */
export function examChart(points) {
  const chart = createElement('div', 'viz progress-chart');
  const stage = createElement('div', 'line-chart__stage');
  chart.append(stage);
  const tooltip = createTooltip(stage);
  let activeIndex = points.length - 1;
  let geometry = null;

  const svg = svgElement('svg', { class: 'line-chart__svg', role: 'img', tabindex: 0 });
  svg.setAttribute('aria-label', `${describeExamSeries(points)} ${t('progression.chart.keyboard')}`);
  stage.append(svg);

  const showAt = (index) => {
    if (!geometry) return;
    activeIndex = Math.max(0, Math.min(index, points.length - 1));
    const { x, y, crosshair, markers } = geometry;
    crosshair.setAttribute('x1', x(activeIndex));
    crosshair.setAttribute('x2', x(activeIndex));
    crosshair.style.visibility = 'visible';
    markers.forEach((marker, i) => marker.classList.toggle('is-active', i === activeIndex));
    const point = points[activeIndex];
    tooltip.show(
      t('progression.chart.tooltip', { index: activeIndex + 1, date: formatDate(point.date) }),
      [{ label: point.label, value: formatPercent(point.percent), key: 'line', series: 1 }],
      x(activeIndex),
      y(point.percent),
    );
  };

  const hide = () => {
    if (!geometry) return;
    geometry.crosshair.style.visibility = 'hidden';
    geometry.markers.forEach((marker) => marker.classList.remove('is-active'));
    tooltip.hide();
  };

  const draw = () => {
    const width = Math.max(280, stage.clientWidth);
    const height = width < 480 ? 200 : 240;
    const margin = { top: 14, right: 46, bottom: 28, left: 44 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = (i) => margin.left + (points.length === 1 ? plotWidth / 2 : (i * plotWidth) / (points.length - 1));
    const y = (percent) => margin.top + plotHeight - (percent / 100) * plotHeight;

    tooltip.hide();
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    for (const tick of TICKS) {
      svg.append(svgElement('line', { class: 'line-chart__grid', x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }));
      const label = svgElement('text', { class: 'line-chart__tick', x: margin.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' });
      label.textContent = formatPercent(tick);
      svg.append(label);
    }

    // Axe des dates : premier et dernier examen seulement (les autres sont dans l'infobulle et le tableau).
    const dated = points.length === 1 ? [0] : [0, points.length - 1];
    for (const i of dated) {
      const anchor = points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end';
      const text = svgElement('text', { class: 'line-chart__tick', x: x(i), y: height - 8, 'text-anchor': anchor });
      text.textContent = formatDate(points[i].date, { short: true });
      svg.append(text);
    }

    const crosshair = svgElement('line', { class: 'line-chart__crosshair', y1: margin.top, y2: margin.top + plotHeight });
    crosshair.style.visibility = 'hidden';
    svg.append(crosshair);

    const coordinates = points.map((point, i) => [x(i), y(point.percent)]);
    svg.append(svgElement('polyline', { class: 'line-chart__line', 'data-series': 1, points: coordinates.map((point) => point.join(',')).join(' ') }));
    const markers = coordinates.map(([cx, cy]) => {
      const marker = svgElement('circle', { class: 'line-chart__marker', 'data-series': 1, cx, cy, r: 4 });
      svg.append(marker);
      return marker;
    });

    // Étiquette du dernier score, au bout de la courbe.
    const [lastX, lastY] = coordinates.at(-1);
    const end = svgElement('text', { class: 'line-chart__end', x: lastX + 10, y: lastY, 'dominant-baseline': 'middle' });
    end.textContent = formatPercent(points.at(-1).percent);
    svg.append(end);

    const hit = svgElement('rect', { class: 'line-chart__hit', x: margin.left - 12, y: margin.top, width: plotWidth + 24, height: plotHeight });
    hit.addEventListener('pointermove', (event) => {
      const box = svg.getBoundingClientRect();
      const position = points.length === 1 ? 0 : ((event.clientX - box.left - margin.left) / plotWidth) * (points.length - 1);
      showAt(Math.round(position));
    });
    hit.addEventListener('pointerleave', hide);
    svg.append(hit);
    geometry = { x, y, crosshair, markers };
  };

  svg.addEventListener('focus', () => showAt(activeIndex));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    showAt(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  // Redessine à la largeur réelle ; s'arrête quand le graphique quitte la page.
  const observer = new ResizeObserver(() => {
    if (stage.isConnected) draw();
    else observer.disconnect();
  });
  observer.observe(stage);
  return chart;
}
