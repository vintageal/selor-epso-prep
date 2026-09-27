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

- **HTML5** statique, sans étape de build
- **Tailwind CSS v4** via le CDN navigateur (`@tailwindcss/browser`), thème défini dans chaque page
- **JavaScript ES6+** natif, sans framework ni dépendance (modules ES pour les modules d'entraînement)
- **Tests** avec le lanceur intégré à Node.js (`node --test`)

## Arborescence

```
.
├── index.html                  # Page d'accueil
├── modules/
│   ├── abstrait/index.html     # Module « Raisonnement abstrait »
│   ├── verbal/index.html       # Module « Raisonnement verbal »
│   └── examen/index.html       # Mode examen chronométré
├── assets/
│   ├── css/styles.css          # Styles complémentaires à Tailwind
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
└── package.json                # Scripts `start` et `test` (aucune dépendance)
```

## Lancer en local

Les modules d'entraînement utilisent des modules ES, que les navigateurs refusent de charger depuis `file://`. Servez donc le dossier avec un petit serveur web :

```bash
npm start                    # ou : python3 -m http.server 8000
# puis http://localhost:8000
```

## Tests

```bash
npm test
```

Les tests (Node.js 20 ou plus, sans dépendance) couvrent les trois modules :

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

## Hébergement

Site 100 % statique : déployable tel quel sur GitHub Pages, Netlify, Cloudflare Pages, etc.

> Avant la mise en production, remplacer le CDN Tailwind par une feuille CSS générée (Tailwind CLI) : le CDN navigateur est prévu pour le développement.

## Publier un module

Les trois modules sont en ligne. Pour en ajouter un nouveau, créer sa carte sur la page d'accueil avec un lien vers `modules/<nom>/index.html`. Tant que le module n'est pas prêt, ce lien porte l'attribut `data-coming-soon` (il affiche alors un message « bientôt disponible », géré par `assets/js/main.js`), et la carte porte un badge « Bientôt disponible ». Une fois le module publié, retirer l'attribut et le badge.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO). Les textes du module verbal sont des créations originales à visée pédagogique : les organismes et les chiffres cités sont fictifs.
