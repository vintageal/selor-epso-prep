# Prépa SELOR & EPSO

Application web gratuite pour s'entraîner aux tests de logique et de raisonnement des sélections **SELOR / Travaillerpour.be** (fonction publique belge) et **EPSO** (institutions européennes).

## Modules

| Module | Contenu | Statut |
| --- | --- | --- |
| Raisonnement abstrait | Séries de formes : trouver la figure qui complète la série | Disponible |
| Raisonnement verbal | Textes et affirmations : vrai, faux ou on ne peut pas savoir | Disponible |
| Mode examen | Test chronométré mélangeant questions abstraites et verbales | À venir |

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
│   └── examen/                 # (à venir)
├── assets/
│   ├── css/styles.css          # Styles complémentaires à Tailwind
│   ├── img/favicon.svg         # Logo / favicon
│   └── js/
│       ├── main.js             # Page d'accueil : menu mobile, notifications
│       ├── lib/random.js       # Tirages aléatoires (graine reproductible pour les tests)
│       ├── abstrait/
│       │   ├── figures.js      # Formes, description textuelle, rendu SVG
│       │   ├── rules.js        # Règles logiques
│       │   ├── generator.js    # Assemblage des questions (sans DOM)
│       │   └── app.js          # Interface du module
│       └── verbal/
│           ├── quiz.js         # Logique de l'exercice et validation de la banque (sans DOM)
│           └── app.js          # Interface du module
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

Les tests (Node.js 20 ou plus, sans dépendance) couvrent les deux modules :

- **Raisonnement abstrait** : des centaines de questions générées par règle. Chacune doit avoir 4 propositions distinctes, une seule bonne réponse qui prolonge réellement la série, des descriptions accessibles distinctes et une explication complète.
- **Raisonnement verbal** : validation de la banque de questions :
  - identifiants uniques et réponses valides ;
  - au moins 4 textes de 3 à 4 affirmations ;
  - chaque citation est une phrase complète reprise mot pour mot du texte ;
  - équilibre entre les trois réponses et explications détaillées.

  S'y ajoutent les tests de l'enchaînement des questions, du surlignage, de la typographie et du bilan.

## Hébergement

Site 100 % statique : déployable tel quel sur GitHub Pages, Netlify, Cloudflare Pages, etc.

> Avant la mise en production, remplacer le CDN Tailwind par une feuille CSS générée (Tailwind CLI) : le CDN navigateur est prévu pour le développement.

## Publier un module

Les cartes de la page d'accueil pointent vers `modules/<nom>/index.html`. Tant qu'un module n'est pas prêt, son lien porte l'attribut `data-coming-soon` et affiche un message « bientôt disponible ». Une fois la page du module créée, retirer cet attribut et le badge « Bientôt disponible » de la carte.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO). Les textes du module verbal sont des créations originales à visée pédagogique : les organismes et les chiffres cités sont fictifs.
