/*
 * Règles logiques du module « Raisonnement abstrait ».
 *
 * Chaque règle produit, à partir d'une source d'aléa :
 *   - sequence    : les SEQUENCE_LENGTH figures affichées ;
 *   - answer      : la figure qui complète la série ;
 *   - distractors : des figures fausses mais plausibles (le générateur écarte
 *                   les doublons et les figures invalides, puis en garde 3) ;
 *   - explanation : l'explication de la règle, affichée après la réponse.
 * `difficulty` : 1 (facile), 2 (moyen) ou 3 (difficile), trois règles par niveau.
 *
 * Identifiants stables : une question est identifiée par « règle/graine ». Ne jamais modifier
 * la génération d'une règle existante (un test vérifie l'empreinte des questions produites) :
 * pour une variante, créer une nouvelle règle.
 */
import { pick, randInt, shuffle } from '../lib/random.js';
import {
  FILLS,
  MARKER_POSITIONS,
  SHAPES,
  createFigure,
  definiteShape,
  describeFigure,
  indefiniteArticle,
  indefiniteShape,
  orientationLabel,
  pointsLabel,
  withPreposition,
} from './figures.js';

export const SEQUENCE_LENGTH = 4;

const ORIENTED_SHAPES = ['arrow', 'triangle'];
const SYMMETRIC_SHAPES = ['circle', 'square', 'diamond', 'hexagon', 'star'];
const CLOCKWISE = 1;
const COUNTERCLOCKWISE = -1;

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const mod = (value, modulo) => ((value % modulo) + modulo) % modulo;
const otherShape = (random, shape) => pick(random, SYMMETRIC_SHAPES.filter((candidate) => candidate !== shape));
const otherFill = (fill) => (fill === 'black' ? 'white' : 'black');
const buildSequence = (at) => Array.from({ length: SEQUENCE_LENGTH }, (_, i) => at(i));
const directionLabel = (direction) =>
  direction === CLOCKWISE ? "dans le sens des aiguilles d'une montre" : "dans le sens inverse des aiguilles d'une montre";

/** 1. Une forme orientée tourne d'un angle constant à chaque étape. */
const rotation = {
  id: 'rotation',
  title: 'Rotation',
  difficulty: 2,
  generate(random) {
    const shape = pick(random, ORIENTED_SHAPES);
    const fill = pick(random, ['black', 'white']);
    const step = pick(random, [45, 90]);
    const direction = pick(random, [CLOCKWISE, COUNTERCLOCKWISE]);
    const start = randInt(random, 0, 7) * 45;
    const at = (i, overrides = {}) =>
      createFigure({ shape, fill, rotation: start + direction * step * i, ...overrides });

    const last = at(SEQUENCE_LENGTH - 1);
    const answer = at(SEQUENCE_LENGTH);

    return {
      sequence: buildSequence(at),
      answer,
      distractors: [
        at(SEQUENCE_LENGTH + 1), // une rotation de trop
        last, // la série ne progresse plus
        at(SEQUENCE_LENGTH, { rotation: answer.rotation + 180 }),
        at(SEQUENCE_LENGTH, { rotation: answer.rotation + 90 }),
        at(SEQUENCE_LENGTH, { fill: otherFill(fill) }), // bonne orientation, mauvaise couleur
      ],
      explanation: [
        `${capitalize(definiteShape(shape))} tourne de ${step}° ${directionLabel(direction)} à chaque étape.`,
        `La 4e figure pointe vers ${orientationLabel(last.rotation)} : une rotation supplémentaire de ${step}° la fait pointer vers ${orientationLabel(answer.rotation)}.`,
        step * SEQUENCE_LENGTH === 360 ? 'Après quatre quarts de tour, la figure est revenue à sa position de départ.' : '',
        'Sa couleur ne change pas.',
      ].filter(Boolean).join(' '),
    };
  },
};

/** 2. La couleur suit un cycle (noir/blanc, ou noir/gris/blanc). */
const colourCycle = {
  id: 'couleur',
  title: 'Alternance de couleurs',
  difficulty: 1,
  generate(random) {
    const shape = pick(random, SYMMETRIC_SHAPES);
    const cycle = shuffle(random, random() < 0.5 ? ['black', 'white'] : ['black', 'grey', 'white']);
    const at = (i) => createFigure({ shape, fill: cycle[i % cycle.length] });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    const wrongFills = cycle.filter((fill) => fill !== answer.fill);
    const decoyShape = otherShape(random, shape);
    const names = cycle.map((fill) => FILLS[fill].m);
    const rule =
      cycle.length === 2
        ? `La couleur alterne entre ${names[0]} et ${names[1]} à chaque étape : ${sequence.map((f) => FILLS[f.fill].m).join(', ')}. La 5e figure est donc ${FILLS[answer.fill].f}.`
        : `Les couleurs suivent toujours le même cycle de trois : ${names.join(', ')}. La 4e figure recommence le cycle (${names[0]}) ; la 5e figure est donc ${FILLS[answer.fill].f}, comme la 2e.`;

    return {
      sequence,
      answer,
      distractors: [
        ...wrongFills.map((fill) => createFigure({ shape, fill })), // mauvaise couleur
        createFigure({ shape: decoyShape, fill: answer.fill }), // bonne couleur, mauvaise forme
        createFigure({ shape: decoyShape, fill: wrongFills[0] }),
      ],
      explanation: `${rule} La forme, ${indefiniteShape(shape)}, ne change pas.`,
    };
  },
};

/** 3. Le nombre de points augmente ou diminue d'une valeur constante. */
const dotCounter = {
  id: 'points',
  title: 'Compteur de points',
  difficulty: 1,
  generate(random) {
    const shape = pick(random, SYMMETRIC_SHAPES);
    const fill = pick(random, ['black', 'grey', 'white']);
    const { step, min, max } = pick(random, [
      { step: 1, min: 1, max: 3 },
      { step: -1, min: 5, max: 7 },
      { step: 2, min: 0, max: 0 },
    ]);
    const start = randInt(random, min, max);
    const at = (i, overrides = {}) => createFigure({ shape, fill, dots: start + step * i, ...overrides });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);

    return {
      sequence,
      answer,
      distractors: [
        at(SEQUENCE_LENGTH + 1), // une étape de trop
        at(SEQUENCE_LENGTH - 1), // la série ne progresse plus
        at(SEQUENCE_LENGTH, { dots: answer.dots + 1 }),
        at(SEQUENCE_LENGTH, { dots: answer.dots - 1 }),
        at(SEQUENCE_LENGTH, { shape: otherShape(random, shape) }), // bon compte, mauvaise forme
      ],
      explanation:
        `Le nombre de points ${step > 0 ? 'augmente' : 'diminue'} de ${Math.abs(step)} à chaque étape : ` +
        `${sequence.map((f) => f.dots).join(', ')}. La 5e figure porte donc ${pointsLabel(answer.dots)}. ` +
        'La forme et sa couleur ne changent pas.',
    };
  },
};

/** 4. Un disque se déplace autour de la forme, d'un pas constant. */
const markerMove = {
  id: 'deplacement',
  title: 'Déplacement',
  difficulty: 2,
  generate(random) {
    const shape = pick(random, SYMMETRIC_SHAPES);
    const fill = pick(random, ['grey', 'white']);
    const step = pick(random, [1, 2]); // 1 : position voisine ; 2 : coin suivant
    const direction = pick(random, [CLOCKWISE, COUNTERCLOCKWISE]);
    const positionCount = MARKER_POSITIONS.length;
    const start = step === 2 ? randInt(random, 0, 3) * 2 : randInt(random, 0, positionCount - 1);
    const position = (i) => mod(start + direction * step * i, positionCount);
    const at = (i, overrides = {}) => createFigure({ shape, fill, marker: position(i), ...overrides });

    const answer = at(SEQUENCE_LENGTH);
    const from = withPreposition(MARKER_POSITIONS[position(SEQUENCE_LENGTH - 1)].label, 'de');
    const to = withPreposition(MARKER_POSITIONS[answer.marker].label, 'à');

    return {
      sequence: buildSequence(at),
      answer,
      distractors: [
        at(SEQUENCE_LENGTH + 1), // un pas de trop
        at(SEQUENCE_LENGTH - 1), // le disque ne bouge plus
        at(SEQUENCE_LENGTH, { marker: mod(answer.marker + positionCount / 2, positionCount) }), // position opposée
        at(SEQUENCE_LENGTH, { shape: otherShape(random, shape) }), // bonne position, mauvaise forme
      ],
      explanation: [
        step === 1
          ? `Le disque noir avance d'une position (coins et milieux des côtés) ${directionLabel(direction)} à chaque étape.`
          : `Le disque noir saute d'un coin au suivant ${directionLabel(direction)} à chaque étape.`,
        `Il passe donc ${from} ${to}.`,
        answer.marker === start ? 'Il a fait un tour complet et retrouve sa position de départ.' : '',
        'La forme centrale ne change pas.',
      ].filter(Boolean).join(' '),
    };
  },
};

/** 5. Deux règles simultanées : rotation et alternance noir/blanc. */
const rotationAndColour = {
  id: 'rotation-couleur',
  title: 'Double règle : rotation et couleur',
  difficulty: 3,
  generate(random) {
    const shape = pick(random, ORIENTED_SHAPES);
    const fills = shuffle(random, ['black', 'white']);
    const step = pick(random, [45, 90]);
    const direction = pick(random, [CLOCKWISE, COUNTERCLOCKWISE]);
    const start = randInt(random, 0, 7) * 45;
    const at = (i, overrides = {}) =>
      createFigure({ shape, rotation: start + direction * step * i, fill: fills[i % 2], ...overrides });

    const answer = at(SEQUENCE_LENGTH);
    const wrongFill = otherFill(answer.fill);

    return {
      sequence: buildSequence(at),
      answer,
      distractors: [
        at(SEQUENCE_LENGTH, { fill: wrongFill }), // bonne orientation, mauvaise couleur
        at(SEQUENCE_LENGTH + 1, { fill: answer.fill }), // bonne couleur, une rotation de trop
        at(SEQUENCE_LENGTH - 1, { fill: answer.fill }), // bonne couleur, rotation oubliée
        at(SEQUENCE_LENGTH - 1), // la série ne progresse plus
        at(SEQUENCE_LENGTH, { rotation: answer.rotation + 180 }),
      ],
      explanation:
        `Deux règles s'appliquent en même temps. D'une part, ${definiteShape(shape)} tourne de ${step}° ` +
        `${directionLabel(direction)} à chaque étape ; d'autre part, sa couleur alterne entre ` +
        `${FILLS[fills[0]].m} et ${FILLS[fills[1]].m}. La 5e figure est donc ` +
        `${indefiniteArticle(shape)} ${describeFigure(answer)}.`,
    };
  },
};

/** 6. La forme suit un cycle de deux ou trois formes ; la couleur ne change pas. */
const shapeCycle = {
  id: 'cycle-formes',
  title: 'Cycle de formes',
  difficulty: 1,
  generate(random) {
    const cycle = shuffle(random, SYMMETRIC_SHAPES).slice(0, random() < 0.5 ? 2 : 3);
    const fill = pick(random, ['black', 'grey', 'white']);
    const at = (i, overrides = {}) => createFigure({ shape: cycle[i % cycle.length], fill, ...overrides });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    const wrongShapes = cycle.filter((shape) => shape !== answer.shape);
    const outsider = pick(random, SYMMETRIC_SHAPES.filter((shape) => !cycle.includes(shape)));
    const names = cycle.map((shape) => SHAPES[shape].name);
    const rule =
      cycle.length === 2
        ? `La forme alterne entre ${indefiniteShape(cycle[0])} et ${indefiniteShape(cycle[1])} à chaque étape.`
        : `Les formes suivent toujours le même cycle de trois : ${names.join(', ')}. La 4e figure recommence le cycle.`;

    return {
      sequence,
      answer,
      distractors: [
        ...wrongShapes.map((shape) => createFigure({ shape, fill })), // mauvaise étape du cycle
        createFigure({ shape: outsider, fill }), // forme absente de la série
        at(SEQUENCE_LENGTH, { fill: fill === 'black' ? 'white' : 'black' }), // bonne forme, mauvaise couleur
      ],
      explanation: `${rule} La 5e figure est donc ${indefiniteShape(answer.shape)}. Sa couleur ne change pas.`,
    };
  },
};

/** 7. Le nombre de côtés augmente ou diminue d'un à chaque étape (du triangle à l'octogone). */
const POLYGONS = ['trigon', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon']; // 3 à 8 côtés

const sideCount = {
  id: 'cotes',
  title: 'Nombre de côtés',
  difficulty: 2,
  generate(random) {
    const fill = pick(random, ['black', 'grey', 'white']);
    const increasing = random() < 0.5;
    const first = increasing ? randInt(random, 0, 1) : randInt(random, 4, 5);
    const step = increasing ? 1 : -1;
    const polygon = (i) => POLYGONS[first + step * i];
    const at = (i, overrides = {}) => createFigure({ shape: polygon(i), fill, ...overrides });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    const sides = (figure) => SHAPES[figure.shape].sides;
    const [otherFillA, otherFillB] = ['black', 'grey', 'white'].filter((candidate) => candidate !== fill);

    return {
      sequence,
      answer,
      distractors: [
        at(SEQUENCE_LENGTH - 1), // la série ne progresse plus
        at(SEQUENCE_LENGTH - 2), // retour en arrière
        at(SEQUENCE_LENGTH, { fill: otherFillA }), // bon nombre de côtés, mauvaise couleur
        at(SEQUENCE_LENGTH, { fill: otherFillB }),
      ],
      explanation:
        `Le nombre de côtés ${increasing ? 'augmente' : 'diminue'} d'un à chaque étape : ` +
        `${sequence.map(sides).join(', ')} (${sequence.map((figure) => SHAPES[figure.shape].name).join(', ')}). ` +
        `La 5e figure a donc ${sides(answer)} côtés : c'est ${indefiniteShape(answer.shape)}. Sa couleur ne change pas.`,
    };
  },
};

/** 8. Rotation à pas croissant : l'angle ajouté augmente de 45° à chaque étape. */
const acceleratingRotation = {
  id: 'rotation-acceleree',
  title: 'Rotation à pas croissant',
  difficulty: 3,
  generate(random) {
    const shape = pick(random, ORIENTED_SHAPES);
    const fill = pick(random, ['black', 'white']);
    const direction = pick(random, [CLOCKWISE, COUNTERCLOCKWISE]);
    const start = randInt(random, 0, 7) * 45;
    // Angle cumulé après i étapes : 45 + 90 + … + 45 × i = 45 × i × (i + 1) / 2
    const angle = (i) => start + direction * 45 * ((i * (i + 1)) / 2);
    const at = (i, overrides = {}) => createFigure({ shape, fill, rotation: angle(i), ...overrides });

    const last = at(SEQUENCE_LENGTH - 1);
    const answer = at(SEQUENCE_LENGTH);
    const lastStep = 45 * (SEQUENCE_LENGTH - 1);
    const nextStep = 45 * SEQUENCE_LENGTH;

    return {
      sequence: buildSequence(at),
      answer,
      distractors: [
        at(SEQUENCE_LENGTH - 1, { rotation: last.rotation + direction * lastStep }), // pas constant (le dernier répété)
        last, // la série ne progresse plus
        at(SEQUENCE_LENGTH - 1, { rotation: last.rotation + direction * 45 }), // pas de 45° seulement
        at(SEQUENCE_LENGTH, { fill: otherFill(fill) }), // bonne orientation, mauvaise couleur
        at(SEQUENCE_LENGTH - 1, { rotation: last.rotation + direction * (nextStep + 45) }), // pas trop grand
      ],
      explanation:
        `${capitalize(definiteShape(shape))} tourne ${directionLabel(direction)}, d'un angle qui augmente de 45° à chaque étape : ` +
        `45°, puis 90°, puis 135°. La rotation suivante est donc de ${nextStep}° : ` +
        `${definiteShape(shape)}, qui pointait vers ${orientationLabel(last.rotation)}, pointe maintenant vers ${orientationLabel(answer.rotation)}. ` +
        'Sa couleur ne change pas.',
    };
  },
};

/** 9. Deux règles simultanées : compteur de points et alternance de deux couleurs. */
const dotsAndColour = {
  id: 'points-couleur',
  title: 'Double règle : points et couleur',
  difficulty: 3,
  generate(random) {
    const shape = pick(random, SYMMETRIC_SHAPES);
    const fills = shuffle(random, ['black', 'grey', 'white']).slice(0, 2);
    const { step, min, max } = pick(random, [
      { step: 1, min: 1, max: 3 },
      { step: -1, min: 5, max: 7 },
      { step: 2, min: 0, max: 0 },
    ]);
    const start = randInt(random, min, max);
    const at = (i, overrides = {}) => createFigure({ shape, fill: fills[i % 2], dots: start + step * i, ...overrides });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    const wrongFill = fills[(SEQUENCE_LENGTH + 1) % 2];

    return {
      sequence,
      answer,
      distractors: [
        at(SEQUENCE_LENGTH, { fill: wrongFill }), // bon nombre de points, mauvaise couleur
        at(SEQUENCE_LENGTH + 1, { fill: answer.fill }), // bonne couleur, une étape de trop
        at(SEQUENCE_LENGTH - 1, { fill: answer.fill }), // bonne couleur, points inchangés
        at(SEQUENCE_LENGTH - 1), // la série ne progresse plus
        at(SEQUENCE_LENGTH, { dots: answer.dots + (step > 0 ? -1 : 1), fill: wrongFill }),
      ],
      explanation:
        `Deux règles s'appliquent en même temps. D'une part, le nombre de points ${step > 0 ? 'augmente' : 'diminue'} de ${Math.abs(step)} ` +
        `à chaque étape : ${sequence.map((figure) => figure.dots).join(', ')}. D'autre part, la couleur alterne entre ` +
        `${FILLS[fills[0]].m} et ${FILLS[fills[1]].m}. La 5e figure est donc ${indefiniteArticle(shape)} ${describeFigure(answer)}.`,
    };
  },
};

// Nouvelles règles : toujours à la fin, pour ne pas modifier l'ordre des règles existantes.
export const RULES = [
  rotation,
  colourCycle,
  dotCounter,
  markerMove,
  rotationAndColour,
  shapeCycle,
  sideCount,
  acceleratingRotation,
  dotsAndColour,
];
