/*
 * Règles logiques du module « Raisonnement abstrait ».
 *
 * Chaque règle produit, à partir d'une source d'aléa :
 *   - sequence    : les SEQUENCE_LENGTH figures affichées ;
 *   - answer      : la figure qui complète la série ;
 *   - distractors : des figures fausses mais plausibles (le générateur écarte
 *                   les doublons et les figures invalides, puis en garde 3) ;
 *   - explanation : l'explication de la règle, affichée après la réponse, en français et en
 *                   néerlandais ({ fr, nl }) ; le générateur garde celle de la langue de la page.
 * `difficulty` : 1 (facile), 2 (moyen) ou 3 (difficile), trois règles par niveau.
 *
 * Identifiants stables : une question est identifiée par « règle/graine ». Ne jamais modifier
 * la génération d'une règle existante (un test vérifie l'empreinte des questions produites) :
 * pour une variante, créer une nouvelle règle.
 */
import { t } from '../lib/i18n.js';
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
  nl,
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
const nlDirection = (direction) => (direction === CLOCKWISE ? 'met de klok mee' : 'tegen de klok in');
/** Titre de la règle dans la langue de la page. */
const titled = (rule) => Object.defineProperty(rule, 'title', { enumerable: true, get: () => t(`abstrait.rules.${rule.id}`) });

/** 1. Une forme orientée tourne d'un angle constant à chaque étape. */
const rotation = {
  id: 'rotation',
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
      explanation: {
        fr: [
          `${capitalize(definiteShape(shape))} tourne de ${step}° ${directionLabel(direction)} à chaque étape.`,
          `La 4e figure pointe vers ${orientationLabel(last.rotation)} : une rotation supplémentaire de ${step}° la fait pointer vers ${orientationLabel(answer.rotation)}.`,
          step * SEQUENCE_LENGTH === 360 ? 'Après quatre quarts de tour, la figure est revenue à sa position de départ.' : '',
          'Sa couleur ne change pas.',
        ].filter(Boolean).join(' '),
        nl: [
          `${capitalize(nl.definite(shape))} draait bij elke stap ${step}° ${nlDirection(direction)}.`,
          `De 4e figuur wijst naar ${nl.orientation(last.rotation)}; na nog een draaiing van ${step}° wijst ze naar ${nl.orientation(answer.rotation)}.`,
          step * SEQUENCE_LENGTH === 360 ? 'Na vier kwartslagen staat de figuur weer in haar beginpositie.' : '',
          'De kleur verandert niet.',
        ].filter(Boolean).join(' '),
      },
    };
  },
};

/** 2. La couleur suit un cycle (noir/blanc, ou noir/gris/blanc). */
const colourCycle = {
  id: 'couleur',
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
    const nlNames = cycle.map(nl.color);
    const nlRule =
      cycle.length === 2
        ? `De kleur wisselt bij elke stap af tussen ${nlNames[0]} en ${nlNames[1]}: ${sequence.map((f) => nl.color(f.fill)).join(', ')}. De 5e figuur is dus ${nl.color(answer.fill)}.`
        : `De kleuren volgen altijd dezelfde cyclus van drie: ${nlNames.join(', ')}. De 4e figuur begint de cyclus opnieuw (${nlNames[0]}); de 5e figuur is dus ${nl.color(answer.fill)}, net als de 2e.`;

    return {
      sequence,
      answer,
      distractors: [
        ...wrongFills.map((fill) => createFigure({ shape, fill })), // mauvaise couleur
        createFigure({ shape: decoyShape, fill: answer.fill }), // bonne couleur, mauvaise forme
        createFigure({ shape: decoyShape, fill: wrongFills[0] }),
      ],
      explanation: {
        fr: `${rule} La forme, ${indefiniteShape(shape)}, ne change pas.`,
        nl: `${nlRule} De vorm, ${nl.indefinite(shape)}, verandert niet.`,
      },
    };
  },
};

/** 3. Le nombre de points augmente ou diminue d'une valeur constante. */
const dotCounter = {
  id: 'points',
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
      explanation: {
        fr:
          `Le nombre de points ${step > 0 ? 'augmente' : 'diminue'} de ${Math.abs(step)} à chaque étape : ` +
          `${sequence.map((f) => f.dots).join(', ')}. La 5e figure porte donc ${pointsLabel(answer.dots)}. ` +
          'La forme et sa couleur ne changent pas.',
        nl:
          `Het aantal stippen neemt bij elke stap met ${Math.abs(step)} ${step > 0 ? 'toe' : 'af'}: ` +
          `${sequence.map((f) => f.dots).join(', ')}. De 5e figuur heeft dus ${nl.points(answer.dots)}. ` +
          'De vorm en de kleur veranderen niet.',
      },
    };
  },
};

/** 4. Un disque se déplace autour de la forme, d'un pas constant. */
const markerMove = {
  id: 'deplacement',
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
      explanation: {
        fr: [
          step === 1
            ? `Le disque noir avance d'une position (coins et milieux des côtés) ${directionLabel(direction)} à chaque étape.`
            : `Le disque noir saute d'un coin au suivant ${directionLabel(direction)} à chaque étape.`,
          `Il passe donc ${from} ${to}.`,
          answer.marker === start ? 'Il a fait un tour complet et retrouve sa position de départ.' : '',
          'La forme centrale ne change pas.',
        ].filter(Boolean).join(' '),
        nl: [
          step === 1
            ? `Het zwarte schijfje schuift bij elke stap één positie op (hoeken en middens van de zijden), ${nlDirection(direction)}.`
            : `Het zwarte schijfje springt bij elke stap ${nlDirection(direction)} van een hoek naar de volgende.`,
          `Het gaat dus van ${nl.position(position(SEQUENCE_LENGTH - 1))} naar ${nl.position(answer.marker)}.`,
          answer.marker === start ? 'Het heeft een volledige ronde gemaakt en staat weer op zijn beginpositie.' : '',
          'De vorm in het midden verandert niet.',
        ].filter(Boolean).join(' '),
      },
    };
  },
};

/** 5. Deux règles simultanées : rotation et alternance noir/blanc. */
const rotationAndColour = {
  id: 'rotation-couleur',
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
      explanation: {
        fr:
          `Deux règles s'appliquent en même temps. D'une part, ${definiteShape(shape)} tourne de ${step}° ` +
          `${directionLabel(direction)} à chaque étape ; d'autre part, sa couleur alterne entre ` +
          `${FILLS[fills[0]].m} et ${FILLS[fills[1]].m}. La 5e figure est donc ` +
          `${indefiniteArticle(shape)} ${describeFigure(answer, 'fr')}.`,
        nl:
          `Er gelden twee regels tegelijk. Enerzijds draait ${nl.definite(shape)} bij elke stap ${step}° ` +
          `${nlDirection(direction)}; anderzijds wisselt de kleur af tussen ${nl.color(fills[0])} en ${nl.color(fills[1])}. ` +
          `De 5e figuur is dus een ${describeFigure(answer, 'nl')}.`,
      },
    };
  },
};

/** 6. La forme suit un cycle de deux ou trois formes ; la couleur ne change pas. */
const shapeCycle = {
  id: 'cycle-formes',
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
        // Avec un cycle de deux formes seulement, un troisième leurre est nécessaire : bonne forme, mauvaise couleur.
        ...(cycle.length === 2 ? [at(SEQUENCE_LENGTH, { fill: fill === 'black' ? 'white' : 'black' })] : []),
      ],
      explanation: {
        fr: `${rule} La 5e figure est donc ${indefiniteShape(answer.shape)}. Sa couleur ne change pas.`,
        nl: `${
          cycle.length === 2
            ? `De vorm wisselt bij elke stap af tussen ${nl.indefinite(cycle[0])} en ${nl.indefinite(cycle[1])}.`
            : `De vormen volgen altijd dezelfde cyclus van drie: ${cycle.map(nl.name).join(', ')}. De 4e figuur begint de cyclus opnieuw.`
        } De 5e figuur is dus ${nl.indefinite(answer.shape)}. De kleur verandert niet.`,
      },
    };
  },
};

/**
 * 7. Le nombre de côtés augmente ou diminue d'un à chaque étape (de 3 à 8), quelle que soit la forme :
 * un triangle peut être équilatéral ou isocèle, un quadrilatère un carré ou un losange, et la flèche compte 7 côtés.
 */
const SHAPES_BY_SIDES = {
  3: ['trigon', 'triangle'],
  4: ['square', 'diamond'],
  5: ['pentagon'],
  6: ['hexagon'],
  7: ['heptagon', 'arrow'],
  8: ['octagon'],
};

const sideCount = {
  id: 'cotes',
  difficulty: 2,
  generate(random) {
    const fill = pick(random, ['black', 'grey', 'white']);
    const step = pick(random, [1, -1]);
    const first = step === 1 ? randInt(random, 3, 4) : randInt(random, 7, 8);
    const sidesAt = (i) => first + step * i;
    const shapes = Array.from({ length: SEQUENCE_LENGTH + 1 }, (_, i) => pick(random, SHAPES_BY_SIDES[sidesAt(i)]));
    const at = (i) => createFigure({ shape: shapes[i], fill });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    // Nombre de côtés absent de la série (entre 3 et 8) : l'étape suivante si elle existe, sinon l'autre extrémité.
    const absentSides = SHAPES_BY_SIDES[sidesAt(SEQUENCE_LENGTH + 1)] ? sidesAt(SEQUENCE_LENGTH + 1) : step === 1 ? 3 : 8;
    const absent = createFigure({ shape: pick(random, SHAPES_BY_SIDES[absentSides]), fill });
    const sides = (figure) => SHAPES[figure.shape].sides;

    return {
      sequence,
      answer,
      distractors: [
        absent, // nombre de côtés absent de la série
        at(SEQUENCE_LENGTH - 1), // la série ne progresse plus
        at(SEQUENCE_LENGTH - 2), // retour en arrière
      ],
      explanation: {
        fr:
          `Le nombre de côtés ${step === 1 ? 'augmente' : 'diminue'} d'un à chaque étape, quelle que soit la forme : ` +
          `${sequence.map((figure) => `${sides(figure)} (${SHAPES[figure.shape].name})`).join(', ')}. ` +
          `La 5e figure a donc ${sides(answer)} côtés : c'est ${indefiniteShape(answer.shape)}. Sa couleur ne change pas.`,
        nl:
          `Het aantal zijden neemt bij elke stap met één ${step === 1 ? 'toe' : 'af'}, ongeacht de vorm: ` +
          `${sequence.map((figure) => `${sides(figure)} (${nl.name(figure.shape)})`).join(', ')}. ` +
          `De 5e figuur heeft dus ${sides(answer)} zijden: het is ${nl.indefinite(answer.shape)}. De kleur verandert niet.`,
      },
    };
  },
};

/** 8. Rotation à pas progressif : l'angle ajouté augmente (45°, 90°, 135°…) ou diminue (180°, 135°, 90°…) de 45° à chaque étape. */
const progressiveRotation = {
  id: 'rotation-acceleree',
  difficulty: 3,
  generate(random) {
    const shape = pick(random, ORIENTED_SHAPES);
    const fill = pick(random, ['black', 'white']);
    const direction = pick(random, [CLOCKWISE, COUNTERCLOCKWISE]);
    const start = randInt(random, 0, 7) * 45;
    const increments = random() < 0.5 ? [45, 90, 135, 180] : [180, 135, 90, 45];
    const turned = (i) => increments.slice(0, i).reduce((sum, angle) => sum + angle, 0);
    const at = (i, overrides = {}) => createFigure({ shape, fill, rotation: start + direction * turned(i), ...overrides });

    const last = at(SEQUENCE_LENGTH - 1);
    const answer = at(SEQUENCE_LENGTH);
    const turnedFromLast = (angle) => at(SEQUENCE_LENGTH - 1, { rotation: last.rotation + direction * angle });
    const growing = increments[0] < increments[1];

    return {
      sequence: buildSequence(at),
      answer,
      // Leurres choisis pour qu'une seule copie d'une figure de la série figure parmi les propositions.
      distractors: growing
        ? [
            turnedFromLast(135), // pas constant : le dernier angle répété
            turnedFromLast(45), // le pas repart de 45°
            turnedFromLast(270), // un quart de tour de trop
          ]
        : [
            turnedFromLast(90), // pas constant : le dernier angle répété
            turnedFromLast(135), // le pas augmente au lieu de diminuer
            turnedFromLast(225), // orientation opposée à la bonne réponse
          ],
      explanation: {
        fr:
          `${capitalize(definiteShape(shape))} tourne ${directionLabel(direction)}, d'un angle qui ${growing ? 'augmente' : 'diminue'} de 45° à chaque étape : ` +
          `${increments.slice(0, SEQUENCE_LENGTH - 1).map((angle) => `${angle}°`).join(', puis ')}. La rotation suivante est donc de ${increments[SEQUENCE_LENGTH - 1]}° : ` +
          `${definiteShape(shape)}, qui pointait vers ${orientationLabel(last.rotation)}, pointe maintenant vers ${orientationLabel(answer.rotation)}. ` +
          'Sa couleur ne change pas.',
        nl:
          `${capitalize(nl.definite(shape))} draait ${nlDirection(direction)}, over een hoek die bij elke stap 45° ${growing ? 'groter' : 'kleiner'} wordt: ` +
          `${increments.slice(0, SEQUENCE_LENGTH - 1).map((angle) => `${angle}°`).join(', dan ')}. De volgende draaiing bedraagt dus ${increments[SEQUENCE_LENGTH - 1]}°: ` +
          `${nl.definite(shape)}, die naar ${nl.orientation(last.rotation)} wees, wijst nu naar ${nl.orientation(answer.rotation)}. ` +
          'De kleur verandert niet.',
      },
    };
  },
};

/** 9. Deux règles simultanées : compteur de points et cycle de trois couleurs. */
const dotsAndColour = {
  id: 'points-couleur',
  difficulty: 3,
  generate(random) {
    const shape = pick(random, SYMMETRIC_SHAPES);
    const fills = shuffle(random, ['black', 'grey', 'white']);
    const { step, min, max } = pick(random, [
      { step: 1, min: 1, max: 3 },
      { step: -1, min: 5, max: 7 },
      { step: 2, min: 0, max: 0 },
    ]);
    const start = randInt(random, min, max);
    const at = (i, overrides = {}) => createFigure({ shape, fill: fills[i % 3], dots: start + step * i, ...overrides });

    const sequence = buildSequence(at);
    const answer = at(SEQUENCE_LENGTH);
    const [wrongFillA, wrongFillB] = fills.filter((fill) => fill !== answer.fill);

    return {
      sequence,
      answer,
      distractors: [
        at(SEQUENCE_LENGTH, { fill: wrongFillA }), // bon nombre de points, mauvaise couleur
        at(SEQUENCE_LENGTH, { fill: wrongFillB }),
        at(SEQUENCE_LENGTH + 1, { fill: answer.fill }), // bonne couleur, une étape de trop
        at(SEQUENCE_LENGTH - 1, { fill: answer.fill }), // bonne couleur, points inchangés
        at(SEQUENCE_LENGTH, { dots: answer.dots + (step > 0 ? -1 : 1), fill: wrongFillA }),
      ],
      explanation: {
        fr:
          `Deux règles s'appliquent en même temps. D'une part, le nombre de points ${step > 0 ? 'augmente' : 'diminue'} de ${Math.abs(step)} ` +
          `à chaque étape : ${sequence.map((figure) => figure.dots).join(', ')}. D'autre part, la couleur suit toujours le même cycle de trois : ` +
          `${fills.map((fill) => FILLS[fill].m).join(', ')} ; la 4e figure recommence le cycle. ` +
          `La 5e figure est donc ${indefiniteArticle(shape)} ${describeFigure(answer, 'fr')}.`,
        nl:
          `Er gelden twee regels tegelijk. Enerzijds neemt het aantal stippen bij elke stap met ${Math.abs(step)} ${step > 0 ? 'toe' : 'af'}: ` +
          `${sequence.map((figure) => figure.dots).join(', ')}. Anderzijds volgt de kleur altijd dezelfde cyclus van drie: ` +
          `${fills.map(nl.color).join(', ')}; de 4e figuur begint de cyclus opnieuw. ` +
          `De 5e figuur is dus een ${describeFigure(answer, 'nl')}.`,
      },
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
  progressiveRotation,
  dotsAndColour,
].map(titled);
