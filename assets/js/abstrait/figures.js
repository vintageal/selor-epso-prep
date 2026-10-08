/*
 * Figures du module « Raisonnement abstrait » : modèle, description textuelle
 * et rendu SVG (aucune image externe).
 *
 * Une figure est un objet simple :
 *   { shape, rotation, fill, dots, marker }
 *   - shape    : clé de SHAPES
 *   - rotation : angle en degrés, sens horaire (multiple de 45, formes orientées uniquement)
 *   - fill     : clé de FILLS ('black', 'grey' ou 'white')
 *   - dots     : nombre de points sous la forme (0 à MAX_DOTS)
 *   - marker   : position du disque sur le pourtour (index de MARKER_POSITIONS) ou null
 *
 * Toutes les formes sont dessinées dans un carré de 100 × 100 centré en (50, 50).
 */

export const MAX_DOTS = 8;

const polygonPoints = (radii, count) =>
  Array.from({ length: count }, (_, i) => {
    const radius = radii[i % radii.length];
    const angle = ((-90 + (360 / count) * i) * Math.PI) / 180;
    const x = Math.round((50 + radius * Math.cos(angle)) * 10) / 10;
    const y = Math.round((50 + radius * Math.sin(angle)) * 10) / 10;
    return `${x},${y}`;
  }).join(' ');

/**
 * Formes disponibles. Les formes « orientées » n'ont aucune symétrie de rotation.
 * `sides` : nombre de côtés des polygones réguliers (règle « Nombre de côtés »).
 */
export const SHAPES = {
  arrow: { name: 'flèche', feminine: true, oriented: true, svg: '<path d="M50 22 71 47H58V78H42V47H29Z"/>' },
  triangle: { name: 'triangle', feminine: false, oriented: true, svg: '<path d="M50 20 63 80H37Z"/>' },
  circle: { name: 'cercle', feminine: false, oriented: false, svg: '<circle cx="50" cy="50" r="26"/>' },
  square: { name: 'carré', feminine: false, oriented: false, sides: 4, svg: '<rect x="27" y="27" width="46" height="46"/>' },
  diamond: { name: 'losange', feminine: false, oriented: false, svg: '<path d="M50 22 76 50 50 78 24 50Z"/>' },
  hexagon: { name: 'hexagone', feminine: false, oriented: false, sides: 6, svg: `<polygon points="${polygonPoints([27], 6)}"/>` },
  star: { name: 'étoile', feminine: true, oriented: false, svg: `<polygon points="${polygonPoints([29, 12], 10)}"/>` },
  trigon: { name: 'triangle équilatéral', feminine: false, oriented: false, sides: 3, svg: `<polygon points="${polygonPoints([31], 3)}" transform="translate(0 5)"/>` },
  pentagon: { name: 'pentagone', feminine: false, oriented: false, sides: 5, svg: `<polygon points="${polygonPoints([28], 5)}" transform="translate(0 2)"/>` },
  heptagon: { name: 'heptagone', feminine: false, oriented: false, sides: 7, svg: `<polygon points="${polygonPoints([28], 7)}" transform="translate(0 1)"/>` },
  octagon: { name: 'octogone', feminine: false, oriented: false, sides: 8, svg: `<polygon points="${polygonPoints([28], 8)}"/>` },
};

const INK = '#0f172a';

/** Couleurs de remplissage, avec leurs accords au masculin et au féminin. */
export const FILLS = {
  black: { color: INK, m: 'noir', f: 'noire' },
  grey: { color: '#94a3b8', m: 'gris', f: 'grise' },
  white: { color: '#ffffff', m: 'blanc', f: 'blanche' },
};

/** Orientation d'une forme orientée, par pas de 45° (0° = pointe vers le haut). */
const ORIENTATIONS = [
  'le haut', 'le haut à droite', 'la droite', 'le bas à droite',
  'le bas', 'le bas à gauche', 'la gauche', 'le haut à gauche',
];

/** Positions du disque, dans le sens des aiguilles d'une montre. */
export const MARKER_POSITIONS = [
  { x: 13, y: 13, label: 'le coin supérieur gauche' },
  { x: 50, y: 13, label: 'le milieu du bord supérieur' },
  { x: 87, y: 13, label: 'le coin supérieur droit' },
  { x: 87, y: 50, label: 'le milieu du bord droit' },
  { x: 87, y: 87, label: 'le coin inférieur droit' },
  { x: 50, y: 87, label: 'le milieu du bord inférieur' },
  { x: 13, y: 87, label: 'le coin inférieur gauche' },
  { x: 13, y: 50, label: 'le milieu du bord gauche' },
];

export const normalizeAngle = (degrees) => ((degrees % 360) + 360) % 360;

export const createFigure = ({ shape, rotation = 0, fill = 'white', dots = 0, marker = null }) => ({
  shape,
  rotation: SHAPES[shape]?.oriented ? normalizeAngle(rotation) : 0,
  fill,
  dots,
  marker,
});

export const isValidFigure = (figure) =>
  figure.shape in SHAPES &&
  figure.fill in FILLS &&
  figure.rotation % 45 === 0 &&
  Number.isInteger(figure.dots) && figure.dots >= 0 && figure.dots <= MAX_DOTS &&
  (figure.marker === null || (Number.isInteger(figure.marker) && figure.marker in MARKER_POSITIONS));

/** Identifiant unique de l'apparence d'une figure (deux figures identiques ont la même clé). */
export const figureKey = ({ shape, rotation, fill, dots, marker }) =>
  [shape, rotation, fill, dots, marker].join('|');

/* ----- Textes ----- */

export const orientationLabel = (rotation) => ORIENTATIONS[normalizeAngle(rotation) / 45];

/** « la flèche », « le carré », « l'étoile »… */
export function definiteShape(shapeKey) {
  const { name, feminine } = SHAPES[shapeKey];
  if (/^[aeiouhé]/i.test(name)) return `l'${name}`;
  return `${feminine ? 'la' : 'le'} ${name}`;
}

export const indefiniteArticle = (shapeKey) => (SHAPES[shapeKey].feminine ? 'une' : 'un');

/** « une flèche », « un carré »… */
export const indefiniteShape = (shapeKey) => `${indefiniteArticle(shapeKey)} ${SHAPES[shapeKey].name}`;

/** « 1 point », « 3 points »… */
export const pointsLabel = (count) => `${count} point${count > 1 ? 's' : ''}`;

/** Remplace l'article initial « le » d'un libellé de position (« le coin… » → « au coin… »). */
export const withPreposition = (label, preposition) =>
  label.replace(/^le /, preposition === 'de' ? 'du ' : 'au ');

/**
 * Description textuelle d'une figure, par exemple
 * « flèche noire orientée vers le bas » ou « cercle blanc à 3 points ».
 * Elle sert aux lecteurs d'écran et aux explications.
 */
export function describeFigure(figure) {
  const shape = SHAPES[figure.shape];
  const gender = shape.feminine ? 'f' : 'm';
  const parts = [`${shape.name} ${FILLS[figure.fill][gender]}`];
  if (shape.oriented) parts.push(`${shape.feminine ? 'orientée' : 'orienté'} vers ${orientationLabel(figure.rotation)}`);
  if (figure.dots > 0) parts.push(`à ${pointsLabel(figure.dots)}`);
  if (figure.marker !== null) parts.push(`avec un disque ${withPreposition(MARKER_POSITIONS[figure.marker].label, 'à')}`);
  return parts.join(' ');
}

/* ----- Rendu SVG ----- */

const DOT_SPACING = 10;
const DOT_Y = 90;

/**
 * Code SVG d'une figure. Les données viennent exclusivement du générateur
 * (jamais de l'utilisateur) : la chaîne peut être insérée telle quelle.
 */
export function renderFigure(figure) {
  const shape = SHAPES[figure.shape];
  const transform = figure.rotation ? ` transform="rotate(${figure.rotation} 50 50)"` : '';
  const parts = [
    `<g fill="${FILLS[figure.fill].color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"${transform}>${shape.svg}</g>`,
  ];

  for (let i = 0; i < figure.dots; i += 1) {
    const x = 50 + (i - (figure.dots - 1) / 2) * DOT_SPACING;
    parts.push(`<circle cx="${x}" cy="${DOT_Y}" r="3.5" fill="${INK}"/>`);
  }

  if (figure.marker !== null) {
    const { x, y } = MARKER_POSITIONS[figure.marker];
    parts.push(`<circle cx="${x}" cy="${y}" r="6.5" fill="${INK}"/>`);
  }

  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}
