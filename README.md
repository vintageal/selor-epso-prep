# Prépa SELOR & EPSO

Application web gratuite pour s'entraîner aux tests de logique et de raisonnement des sélections **SELOR / Travaillerpour.be** (fonction publique belge) et **EPSO** (institutions européennes).

## Modules

| Module | Contenu | Statut |
| --- | --- | --- |
| Raisonnement abstrait | Séries de formes : trouver la figure qui complète la série | Disponible |
| Raisonnement verbal | Textes et affirmations : vrai, faux ou on ne peut pas savoir | Disponible |
| Raisonnement numérique | Tableaux et graphiques : variations, ratios, moyennes pondérées, extrapolations | Disponible |
| Jugement situationnel | Situations professionnelles : action la plus et la moins adéquate, correction par compétence | Disponible |
| Mode examen | Examen blanc chronométré mélangeant les quatre épreuves | Disponible |

### Raisonnement abstrait

Les questions sont générées à la volée (quantité illimitée) et dessinées en SVG, sans aucune image externe. Cinq règles logiques sont proposées, de difficulté croissante :

| Règle | Principe | Difficulté |
| --- | --- | --- |
| Alternance de couleurs | La couleur suit un cycle (noir/blanc ou noir/gris/blanc) | Facile |
| Compteur de points | Le nombre de points augmente ou diminue d'un pas constant | Facile |
| Rotation | Une flèche ou un triangle tourne de 45° ou 90° à chaque étape | Moyen |
| Déplacement | Un disque fait le tour de la forme, case par case ou de coin en coin | Moyen |
| Double règle | Rotation et alternance de couleur en même temps | Difficile |

Après chaque réponse, l'application indique si elle est correcte, révèle la bonne figure et explique la règle. Les propositions ont une description textuelle pour les lecteurs d'écran, et le module se pilote au clavier (touches `1`–`4` ou `A`–`D`, puis `Entrée`).

**Ajouter une règle :** ajouter un objet dans `assets/js/abstrait/rules.js` (voir les règles existantes : `generate()` renvoie la série, la réponse, des distracteurs et l'explication), puis son invariant dans `tests/abstrait.test.js`.

### Raisonnement verbal

Le candidat lit un texte dense (à gauche sur ordinateur, en haut sur mobile) et évalue une affirmation (à droite, ou en bas) : **Vrai**, **Faux** ou **On ne peut pas savoir**. La banque contient 5 textes originaux (administration publique, économie, environnement et santé, droit et institutions, sciences), avec 4 affirmations chacun.

À chaque réponse, la correction :

- **cite mot pour mot la ou les phrases du texte** qui prouvent la réponse, et les surligne dans le texte ;
- détaille le raisonnement et le piège tendu par l'affirmation ;
- rappelle la règle de méthode du type de réponse attendu.

Un bilan de fin de série détaille les résultats par type de réponse, pour repérer ses points faibles (souvent « On ne peut pas savoir »).

**Ajouter un texte :** compléter `data/verbal.json` (format décrit en tête de `assets/js/verbal/quiz.js`), puis lancer `npm test`. Les tests refusent notamment toute citation qui ne figure pas mot pour mot dans le texte ou qui ne correspond pas à une phrase complète.

### Raisonnement numérique

Le candidat analyse des données administratives fictives (à gauche sur ordinateur, en haut sur mobile) et choisit la bonne réponse parmi quatre propositions chiffrées (à droite, ou en bas). La banque `data/numerique.json` contient 5 jeux de données : budget d'un SPF, effectifs par direction, demandes de permis, résultats d'une sélection et achats de fournitures. Ils totalisent 17 questions réparties entre les quatre compétences clés :

| Compétence | Exemples |
| --- | --- |
| Taux de variation | hausse d'un budget, variation d'une dépense (avec son signe) |
| Ratio et proportion | part d'un poste dans un total, « combien de A pour un B » |
| Moyenne pondérée | note moyenne de centres de tailles différentes, prix moyen pondéré par les quantités |
| Extrapolation de tendance | projection linéaire (hausse constante) ou composée (taux constant) |

Les données s'affichent en **tableau**, en **barres horizontales** ou en **courbes**, dessinés en HTML et SVG légers. Les couleurs sont validées pour les contrastes et le daltonisme, avec une infobulle au survol et au clavier. Chaque graphique dispose aussi d'une **vue « Tableau »** équivalente.

À chaque réponse, la correction affiche :

- les **données utilisées** ;
- la **formule** mathématique ;
- le **calcul étape par étape**, avec les vraies valeurs ;
- le résultat arrondi.

Si la réponse est fausse, elle explique aussi **l'erreur de logique** correspondant à la proposition choisie : mauvaise année, division par la valeur d'arrivée, moyenne non pondérée, croissance simple au lieu de composée…

**Ajouter un jeu de données :** compléter `data/numerique.json` (format décrit en tête de `assets/js/numerique/quiz.js`), puis lancer `npm test`.
- Les calculs s'écrivent sous forme d'expressions, par exemple `({total.2024} - {total.2023}) / {total.2023} * 100`, qui sont évaluées et jamais exécutées.
- Les tests vérifient que la bonne réponse correspond au résultat du calcul, et que chaque proposition fautive correspond au calcul de l'erreur décrite.
- Ils vérifient aussi que les lignes « total » sont bien la somme des autres lignes.

### Jugement situationnel

Le candidat lit une situation professionnelle réaliste dans une administration (gestion de conflit, priorités contradictoires, relation avec la hiérarchie, déontologie…), puis évalue quatre actions possibles. Comme aux tests SJT des sélections EPSO et fédérales, il désigne **l'action la plus adéquate** et **l'action la moins adéquate**. Ce format se pilote au clic, au toucher ou au clavier (`Tab` puis flèches). Une même action ne peut pas être à la fois la plus et la moins adéquate. L'ordre des actions est mélangé à chaque série.

La banque `data/jugement.json` contient 6 situations : deux demandes urgentes et contradictoires, un collègue qui ne tient plus ses délais, une erreur découverte dans un dossier déjà envoyé, un usager excédé au guichet, une demande d'information confidentielle et un nouvel outil qui ralentit le travail. Chaque situation classe ses quatre actions de 1 (la plus adéquate) à 4 (la moins adéquate).

**Notation par proximité** (4 points par situation) :

| Choix | Action classée 1re | 2e | 3e | 4e |
| --- | --- | --- | --- | --- |
| « Plus adéquate » | 2 points | 1 point | 0 | 0 |
| « Moins adéquate » | 0 | 0 | 1 point | 2 points |

Après validation, la correction affiche la place de chaque action dans la grille et une **explication psychologique et managériale** pour chacune. Elle relie chaque action aux compétences évaluées : résolution de problèmes, travail en équipe, orientation résultats, communication, organisation et priorités, orientation service, intégrité. Une synthèse « À retenir » conclut chaque situation. Le bilan de fin de série détaille les points par compétence et signale la compétence à travailler.

La grille de référence a été élaborée pour l'entraînement, à partir des compétences génériques évaluées lors des sélections. Elle ne reproduit pas une grille officielle de l'EPSO ou du SPF BOSA.

**Ajouter une situation :** compléter `data/jugement.json` (format décrit en tête de `assets/js/jugement/quiz.js`), puis lancer `npm test`. Les tests vérifient notamment que les rangs forment exactement 1, 2, 3 et 4, que les compétences citées existent et que chaque action a une explication détaillée.

### Mode examen

Un examen blanc dans les conditions de l'épreuve :

- **35 questions** : 10 de raisonnement abstrait (générées, 2 par règle), 10 affirmations verbales (réparties entre les textes), 10 questions numériques (réparties entre les jeux de données) et 5 situations de jugement, mélangées dans un ordre aléatoire ;
- **chronomètre global strict de 40 minutes**, toujours visible en haut de l'écran. Il passe à l'orange à 5 minutes et au rouge à 1 minute, avec des annonces pour les lecteurs d'écran. À zéro, l'examen s'arrête immédiatement et les réponses sont notées en l'état ;
- **navigation libre** : boutons « Précédent » / « Suivant », accès direct par la grille des questions, réponses modifiables ou effaçables, questions marquées « à revoir ». Une situation de jugement avec un seul de ses deux choix apparaît comme « incomplète » ;
- **notation** : chaque question vaut 1 point. Une situation de jugement rapporte une fraction de point selon la même grille de proximité que le module (par exemple 3 points sur 4 = 0,75 point). Le score peut donc être décimal, par exemple 27,75 / 35 ;
- **aucune correction pendant l'épreuve** : après confirmation de « Terminer l'examen » (ou à la fin du temps), le bilan affiche :
  - le score, le temps utilisé et le résultat par section ;
  - la correction détaillée de chaque question : série complétée et règle pour l'abstrait, citation exacte et explication pour le verbal, calcul étape par étape pour le numérique, place de chaque action dans la grille et explications pour le jugement situationnel.

Le nombre de questions et la durée se règlent dans `EXAM_CONFIG` (`assets/js/examen/exam.js`).

## Stack

- **HTML5** statique
- **Tailwind CSS v4**, compilé par Tailwind CLI en une seule feuille minifiée (`assets/css/app.css`, environ 8 Ko compressée) ; thème et composants dans `src/css/`
- **JavaScript ES6+** natif, sans framework ni dépendance d'exécution (modules ES)
- **Tests** avec le lanceur intégré à Node.js (`node --test`)
- **Déploiement** automatique sur GitHub Pages via GitHub Actions

Seules deux dépendances de développement sont utilisées : `@tailwindcss/cli` (compilation du CSS) et `http-server` (serveur local).

## Arborescence

```
.
├── index.html                  # Page d'accueil
├── modules/
│   ├── abstrait/index.html     # Module « Raisonnement abstrait »
│   ├── verbal/index.html       # Module « Raisonnement verbal »
│   ├── numerique/index.html    # Module « Raisonnement numérique »
│   ├── jugement/index.html     # Module « Jugement situationnel »
│   └── examen/index.html       # Mode examen chronométré
├── src/css/
│   ├── main.css                # Point d'entrée Tailwind : thème, fichiers analysés
│   └── components.css          # Composants propres au site
├── assets/
│   ├── css/app.css             # Feuille générée par `npm run build:css` (non versionnée)
│   ├── img/favicon.svg         # Logo / favicon
│   └── js/
│       ├── main.js             # Page d'accueil : menu mobile, notifications
│       ├── lib/
│       │   ├── random.js       # Tirages aléatoires (graine reproductible pour les tests)
│       │   └── dom.js          # Petits utilitaires DOM partagés
│       ├── abstrait/
│       │   ├── figures.js      # Formes, description textuelle, rendu SVG
│       │   ├── rules.js        # Règles logiques
│       │   ├── generator.js    # Assemblage des questions (sans DOM)
│       │   ├── view.js         # Série et propositions (partagé avec le mode examen)
│       │   └── app.js          # Interface du module
│       ├── verbal/
│       │   ├── quiz.js         # Logique de l'exercice et validation de la banque (sans DOM)
│       │   ├── view.js         # Texte, boutons de réponse, citations (partagé avec le mode examen)
│       │   └── app.js          # Interface du module
│       ├── numerique/
│       │   ├── quiz.js         # Moteur de calcul, formatage, validation de la banque (sans DOM)
│       │   ├── view.js         # Tableau, graphiques, propositions, correction détaillée (partagé avec le mode examen)
│       │   └── app.js          # Interface du module
│       ├── jugement/
│       │   ├── quiz.js         # Compétences, notation par proximité, validation de la banque (sans DOM)
│       │   ├── view.js         # Situation, choix « plus / moins adéquate », correction (partagé avec le mode examen)
│       │   └── app.js          # Interface du module
│       └── examen/
│           ├── exam.js         # Composition, session chronométrée, notation (sans DOM)
│           └── app.js          # Interface de l'examen et bilan
├── data/
│   ├── verbal.json             # Banque de textes et d'affirmations
│   ├── numerique.json          # Banque de jeux de données et de questions chiffrées
│   └── jugement.json           # Banque de situations professionnelles et grilles de correction
├── tests/                      # Tests automatisés (node --test)
├── scripts/build-site.js       # Assemble le site publiable dans dist/
├── .github/workflows/          # Déploiement GitHub Pages et vérification des pull requests
└── package.json                # Scripts npm (build, start, test…)
```

## Lancer en local

Prérequis : Node.js 20 ou plus. Les modules ES ne se chargent pas depuis `file://` : l'application doit être servie par un serveur web local.

```bash
npm install          # une seule fois
npm start            # compile le CSS puis sert le site sur http://localhost:8000
```

Pendant le développement, lancez `npm run watch:css` dans un second terminal : le CSS est recompilé à chaque modification des pages, des scripts ou de `src/css/`. Les classes Tailwind utilisées dans le JavaScript (`assets/js/`) sont détectées automatiquement.

| Commande | Rôle |
| --- | --- |
| `npm run build:css` | Compile `src/css/main.css` en `assets/css/app.css` (minifié) |
| `npm run build` | Compile le CSS et assemble le site publiable dans `dist/` |
| `npm run preview` | Construit `dist/` et le sert localement, comme en production |
| `npm test` | Lance tous les tests |

## Tests

```bash
npm test
```

Les tests (Node.js 20 ou plus) couvrent les cinq modules et le site :

- **Raisonnement abstrait** : des centaines de questions générées par règle. Chacune doit avoir 4 propositions distinctes, une seule bonne réponse qui prolonge réellement la série, des descriptions accessibles distinctes et une explication complète.
- **Raisonnement verbal** : validation de la banque de questions :
  - identifiants uniques et réponses valides ;
  - au moins 4 textes de 3 à 4 affirmations ;
  - chaque citation est une phrase complète reprise mot pour mot du texte ;
  - équilibre entre les trois réponses et explications détaillées.

  S'y ajoutent les tests de l'enchaînement des questions, du surlignage, de la typographie et du bilan.
- **Raisonnement numérique** : validation de la banque :
  - chaque bonne réponse est recalculée à partir des données ;
  - chaque piège correspond au calcul de l'erreur qu'il décrit ;
  - les totaux sont cohérents ;
  - au moins 4 jeux de données de 3 à 4 questions, et les quatre compétences toutes présentes.

  S'y ajoutent les tests du moteur de calcul (priorités, puissances, refus des expressions invalides), du formatage à la française, de l'enchaînement et du bilan.
- **Jugement situationnel** :
  - validation de la banque : rangs 1 à 4, compétences connues, identifiants uniques, explications détaillées ;
  - au moins 4 situations, thèmes demandés couverts (conflit, priorités, hiérarchie) ;
  - notation par proximité, testée sur toutes les combinaisons de choix : le maximum n'est atteint qu'avec la grille ;
  - ordre aléatoire des actions et bilan par compétence.
- **Mode examen** :
  - composition : 10 + 10 + 10 questions et 5 situations de jugement, mélangées et réparties entre les textes et les jeux de données, tirage reproductible ;
  - navigation libre : réponses modifiées ou effacées, questions marquées, situation de jugement complète seulement avec ses deux choix ;
  - chronomètre : décompte, arrêt strict à zéro avec refus des réponses tardives, temps figé à la remise ;
  - notation (bonnes réponses, réponses partielles du jugement situationnel, erreurs, questions vides, par section) et affichage du temps.
- **Site** : chaque page charge la feuille CSS compilée (plus aucun CDN) ; tous les liens et ressources locaux existent et sont en chemins relatifs, compatibles avec l'adresse en sous-dossier de GitHub Pages.

## Hébergement

L'application est publiée sur **GitHub Pages** par le workflow `.github/workflows/deploy.yml`. À chaque mise à jour de `main`, il lance les tests, compile le CSS, assemble `dist/` et met le site en ligne. Si un test échoue, rien n'est publié.

- **Activation (une seule fois)** : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
- **Adresse** : `https://<compte>.github.io/selor-epso-prep/`, affichée dans *Settings → Pages* et dans chaque exécution du workflow.
- **Redéployer sans nouveau commit** : onglet *Actions* → « Déploiement GitHub Pages » → *Run workflow*.
- **Dépôt privé** : GitHub Pages n'est disponible sur un dépôt privé qu'avec une offre payante (Pro, Team ou Enterprise). Avec un compte gratuit, le dépôt doit être public. Dans tous les cas, le site publié est public.

Chaque pull request est aussi vérifiée (tests et construction) par `.github/workflows/ci.yml`.

Le dossier `dist/` étant un site statique autonome, il peut aussi être déployé sur Netlify, Cloudflare Pages, etc. (commande de build : `npm run build`, dossier publié : `dist`).

## Publier un module

Les quatre modules sont en ligne. Pour en ajouter un nouveau, créer sa carte sur la page d'accueil avec un lien vers `modules/<nom>/index.html`. Tant que le module n'est pas prêt, ce lien porte l'attribut `data-coming-soon` (il affiche alors un message « bientôt disponible », géré par `assets/js/main.js`), et la carte porte un badge « Bientôt disponible ». Une fois le module publié, retirer l'attribut et le badge.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO). Les textes du module verbal sont des créations originales à visée pédagogique : les organismes et les chiffres cités sont fictifs.
