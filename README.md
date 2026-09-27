# Prépa SELOR & EPSO

Application web gratuite pour s'entraîner aux tests de logique et de raisonnement des sélections **SELOR / Travaillerpour.be** (fonction publique belge) et **EPSO** (institutions européennes).

## Modules

| Module | Contenu | Statut |
| --- | --- | --- |
| Raisonnement abstrait | Séries de formes : trouver la figure qui complète la série | Disponible |
| Raisonnement verbal | Textes et affirmations : vrai, faux ou on ne peut pas savoir | Disponible |
| Mode examen | Examen blanc chronométré mélangeant questions abstraites et verbales | Disponible |

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

### Mode examen

Un examen blanc dans les conditions de l'épreuve :

- **20 questions** : 10 de raisonnement abstrait (générées, 2 par règle) et 10 affirmations verbales (réparties entre les textes), mélangées dans un ordre aléatoire ;
- **chronomètre global strict de 20 minutes**, toujours visible en haut de l'écran. Il passe à l'orange à 5 minutes et au rouge à 1 minute, avec des annonces pour les lecteurs d'écran. À zéro, l'examen s'arrête immédiatement et les réponses sont notées en l'état ;
- **navigation libre** : boutons « Précédent » / « Suivant », accès direct par la grille des questions, réponses modifiables ou effaçables, questions marquées « à revoir » ;
- **aucune correction pendant l'épreuve** : après confirmation de « Terminer l'examen » (ou à la fin du temps), le bilan affiche :
  - le score, le temps utilisé et le résultat par section ;
  - la correction détaillée de chaque question : série complétée et règle pour l'abstrait, citation exacte et explication pour le verbal.

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
│       └── examen/
│           ├── exam.js         # Composition, session chronométrée, notation (sans DOM)
│           └── app.js          # Interface de l'examen et bilan
├── data/verbal.json            # Banque de textes et d'affirmations
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

Les tests (Node.js 20 ou plus) couvrent les trois modules et le site :

- **Raisonnement abstrait** : des centaines de questions générées par règle. Chacune doit avoir 4 propositions distinctes, une seule bonne réponse qui prolonge réellement la série, des descriptions accessibles distinctes et une explication complète.
- **Raisonnement verbal** : validation de la banque de questions :
  - identifiants uniques et réponses valides ;
  - au moins 4 textes de 3 à 4 affirmations ;
  - chaque citation est une phrase complète reprise mot pour mot du texte ;
  - équilibre entre les trois réponses et explications détaillées.

  S'y ajoutent les tests de l'enchaînement des questions, du surlignage, de la typographie et du bilan.
- **Mode examen** :
  - composition : 10 + 10 questions mélangées, affirmations distinctes et réparties entre les textes, tirage reproductible ;
  - navigation libre : réponses modifiées ou effacées, questions marquées ;
  - chronomètre : décompte, arrêt strict à zéro avec refus des réponses tardives, temps figé à la remise ;
  - notation (bonnes réponses, erreurs, questions vides, par section) et affichage du temps.
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

Les trois modules sont en ligne. Pour en ajouter un nouveau, créer sa carte sur la page d'accueil avec un lien vers `modules/<nom>/index.html`. Tant que le module n'est pas prêt, ce lien porte l'attribut `data-coming-soon` (il affiche alors un message « bientôt disponible », géré par `assets/js/main.js`), et la carte porte un badge « Bientôt disponible ». Une fois le module publié, retirer l'attribut et le badge.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO). Les textes du module verbal sont des créations originales à visée pédagogique : les organismes et les chiffres cités sont fictifs.
