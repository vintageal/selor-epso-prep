# Prépa SELOR & EPSO

Application web gratuite pour s'entraîner aux tests de logique et de raisonnement des sélections **SELOR / Travaillerpour.be** (fonction publique belge) et **EPSO** (institutions européennes).

**En ligne : https://selor-epso-prep.eu**

## Modules

| Module | Contenu | Statut |
| --- | --- | --- |
| Raisonnement abstrait | Séries de formes : trouver la figure qui complète la série | Disponible |
| Raisonnement verbal | Textes et affirmations : vrai, faux ou on ne peut pas savoir | Disponible |
| Raisonnement numérique | Tableaux et graphiques : variations, ratios, moyennes pondérées, extrapolations | Disponible |
| Jugement situationnel | Situations professionnelles : action la plus et la moins adéquate, correction par compétence | Disponible |
| Mode examen | Examen blanc chronométré mélangeant les quatre épreuves | Disponible |
| Ma progression | Suivi sans inscription : réussite par module, examens, point faible, révision des erreurs | Disponible |

### Raisonnement abstrait

Les questions sont générées à la volée (quantité illimitée) et dessinées en SVG, sans aucune image externe. Neuf règles logiques sont proposées, trois par niveau de difficulté :

| Règle | Principe | Niveau |
| --- | --- | --- |
| Alternance de couleurs | La couleur suit un cycle (noir/blanc ou noir/gris/blanc) | 1 · Facile |
| Compteur de points | Le nombre de points augmente ou diminue d'un pas constant | 1 · Facile |
| Cycle de formes | La forme suit un cycle de deux ou trois formes, la couleur ne change pas | 1 · Facile |
| Rotation | Une flèche ou un triangle tourne de 45° ou 90° à chaque étape | 2 · Moyen |
| Déplacement | Un disque fait le tour de la forme, case par case ou de coin en coin | 2 · Moyen |
| Nombre de côtés | Le polygone gagne ou perd un côté à chaque étape (du triangle à l'octogone) | 2 · Moyen |
| Double règle : rotation et couleur | Rotation et alternance de couleur en même temps | 3 · Difficile |
| Rotation à pas croissant | L'angle de rotation augmente de 45° à chaque étape (45°, 90°, 135°…) | 3 · Difficile |
| Double règle : points et couleur | Compteur de points et alternance de deux couleurs en même temps | 3 · Difficile |

Le niveau s'affiche au-dessus de la série. Chaque question est identifiée par sa règle et la graine de son tirage (« règle/graine ») : la génération d'une règle existante ne doit jamais changer, sinon les questions déjà enregistrées dans la progression ne seraient plus les mêmes. Un test vérifie l'empreinte des questions produites par chaque règle d'origine.

Après chaque réponse, l'application indique si elle est correcte, révèle la bonne figure et explique la règle. Les propositions ont une description textuelle pour les lecteurs d'écran, et le module se pilote au clavier (touches `1`–`4` ou `A`–`D`, puis `Entrée`).

**Ajouter une règle :** ajouter un objet à la fin de `RULES` dans `assets/js/abstrait/rules.js` (voir les règles existantes : `generate()` renvoie la série, la réponse, des distracteurs et l'explication ; `difficulty` vaut 1, 2 ou 3), puis son invariant dans `tests/abstrait.test.js`. Pour modifier une règle existante, créer plutôt une nouvelle règle.

### Raisonnement verbal

Le candidat lit un texte dense (à gauche sur ordinateur, en haut sur mobile) et évalue une affirmation (à droite, ou en bas) : **Vrai**, **Faux** ou **On ne peut pas savoir**. La banque contient **15 textes originaux et 60 affirmations** (4 par texte) : notes de service, règlements, rapports, études et enquêtes d'administrations belges et européennes fictives (administration publique, droit et institutions, institutions européennes, ressources humaines, économie, environnement, sciences). Les trois réponses sont équilibrées (20 affirmations chacune).

Chaque affirmation a un **niveau de difficulté** (1, 2 ou 3, avec 20 affirmations par niveau), affiché au-dessus de l'affirmation. Au niveau 1, la réponse se lit dans une phrase du texte. Au niveau 3, il faut croiser plusieurs informations ou déjouer un piège : durée minimale prise pour une date, proportion confondue avec un nombre, corrélation présentée comme une cause… Aucune réponse ne domine un niveau : le niveau affiché ne trahit pas la réponse.

À chaque réponse, la correction :

- **cite mot pour mot la ou les phrases du texte** qui prouvent la réponse, et les surligne dans le texte ;
- détaille le raisonnement et le piège tendu par l'affirmation ;
- rappelle la règle de méthode du type de réponse attendu.

Un bilan de fin de série détaille les résultats par type de réponse, pour repérer ses points faibles (souvent « On ne peut pas savoir »).

**Ajouter un texte :** compléter `data/verbal.json` (format décrit en tête de `assets/js/verbal/quiz.js`), puis lancer `npm test`. Les tests refusent notamment toute citation qui ne figure pas mot pour mot dans le texte ou qui ne correspond pas à une phrase complète, une difficulté manquante et les quasi-doublons. Ne jamais modifier l'identifiant d'une affirmation existante : la progression enregistrée des candidats y fait référence.

### Raisonnement numérique

Le candidat analyse des données administratives fictives (à gauche sur ordinateur, en haut sur mobile) et choisit la bonne réponse parmi quatre propositions chiffrées (à droite, ou en bas). La banque `data/numerique.json` contient **14 jeux de données et 53 questions** : budgets d'un SPF et d'une commune, effectifs, permis, sélection, achats, centre de contact, énergie d'un bâtiment, contrôles d'une inspection, antennes régionales, canaux de demande, absentéisme, subsides sportifs et restaurant administratif. Les questions sont réparties entre les quatre compétences clés :

| Compétence | Exemples |
| --- | --- |
| Taux de variation | hausse d'un budget, variation d'une dépense (avec son signe) |
| Ratio et proportion | part d'un poste dans un total, « combien de A pour un B » |
| Moyenne pondérée | note moyenne de centres de tailles différentes, prix moyen pondéré par les quantités |
| Extrapolation de tendance | projection linéaire (hausse constante) ou composée (taux constant) |

Les données s'affichent en **tableau**, en **barres horizontales**, en **courbes** ou en **secteurs** (anneau), dessinés en HTML et SVG légers. Les couleurs sont validées pour les contrastes et le daltonisme, avec une infobulle au survol et au clavier (flèches pour parcourir les parts d'un graphique en secteurs). La légende des secteurs donne les valeurs, jamais les pourcentages, pour ne pas souffler la réponse. Chaque graphique dispose aussi d'une **vue « Tableau »** équivalente.

Chaque question a un **niveau de difficulté** (1, 2 ou 3 ; 17, 18 et 18 questions), affiché au-dessus de l'énoncé.

**Réponses calculées, jamais écrites à la main.** Le script `scripts/calculer-numerique.js` (`npm run calculer:numerique`) recalcule chaque proposition à partir des données :

- la bonne réponse est le résultat du calcul détaillé (`steps`) ;
- chaque piège est le résultat de son `expression`, qui reproduit une erreur typique : mauvaise base de pourcentage, ligne oubliée, ratio inversé, mauvaise année, taux additionnés au lieu d'être composés… ;
- les propositions sont arrondies au format de la question, puis triées par ordre croissant, et `answer` désigne la bonne.

Le script refuse deux propositions identiques, toute valeur à mi-chemin entre deux arrondis, que la correction afficherait autrement que la proposition, et tout calcul détaillé qui, refait avec les résultats intermédiaires arrondis tels qu'ils sont affichés, ne mènerait pas à la bonne réponse. Un test échoue si le fichier n'est pas exactement celui que produit le script.

À chaque réponse, la correction affiche :

- les **données utilisées** ;
- la **formule** mathématique ;
- le **calcul étape par étape**, avec les vraies valeurs ;
- le résultat arrondi.

Si la réponse est fausse, elle explique aussi **l'erreur de logique** correspondant à la proposition choisie : mauvaise année, division par la valeur d'arrivée, moyenne non pondérée, croissance simple au lieu de composée…

**Ajouter un jeu de données :** compléter `data/numerique.json` (format décrit en tête de `assets/js/numerique/quiz.js`) avec les expressions de calcul, sans les valeurs des propositions, puis lancer `npm run calculer:numerique` et `npm test`. Ne jamais modifier l'identifiant d'une question existante.
- Les calculs s'écrivent sous forme d'expressions, par exemple `({total.2024} - {total.2023}) / {total.2023} * 100`, qui sont évaluées et jamais exécutées.
- Les tests vérifient que la bonne réponse correspond au résultat du calcul, et que chaque proposition fautive correspond au calcul de l'erreur décrite.
- Ils vérifient aussi que les lignes « total » sont bien la somme des autres lignes.

### Jugement situationnel

Le candidat lit une situation professionnelle réaliste dans une administration (gestion de conflit, priorités contradictoires, relation avec la hiérarchie, déontologie…), puis évalue quatre actions possibles. Comme aux tests SJT des sélections EPSO et fédérales, il désigne **l'action la plus adéquate** et **l'action la moins adéquate**. Ce format se pilote au clic, au toucher ou au clavier (`Tab` puis flèches). Une même action ne peut pas être à la fois la plus et la moins adéquate. L'ordre des actions est mélangé à chaque série.

La banque `data/jugement.json` contient **30 situations** originales, dans des administrations belges (communes, CPAS, régions, Communautés, SPF) et européennes. Chaque situation classe ses quatre actions de 1 (la plus adéquate) à 4 (la moins adéquate). Elle indique aussi :

- sa **compétence principale** : travail en équipe, résilience, intégrité, orientation service au citoyen et leadership (4 situations chacune), organisation et priorités, communication (3 chacune), résolution de problèmes et orientation résultats (2 chacune) ;
- son **niveau de difficulté** : 1, 2 ou 3, avec 10 situations par niveau. Le niveau s'affiche au-dessus de la situation. Au niveau 3, les actions sont plus proches les unes des autres et les valeurs en jeu entrent en tension.

**Notation par proximité** (4 points par situation) :

| Choix | Action classée 1re | 2e | 3e | 4e |
| --- | --- | --- | --- | --- |
| « Plus adéquate » | 2 points | 1 point | 0 | 0 |
| « Moins adéquate » | 0 | 0 | 1 point | 2 points |

Après validation, la correction affiche la place de chaque action dans la grille et une **explication psychologique et managériale** pour chacune. Elle relie chaque action aux compétences évaluées : résolution de problèmes, travail en équipe, orientation résultats, communication, organisation et priorités, orientation service, intégrité, résilience et leadership. La compétence principale de la situation est indiquée en premier. Une synthèse « À retenir » conclut chaque situation. Le bilan de fin de série détaille les points par compétence et signale la compétence à travailler.

La grille de référence a été élaborée pour l'entraînement, à partir des compétences génériques évaluées lors des sélections. Elle ne reproduit pas une grille officielle de l'EPSO ou du SPF BOSA.

**Ajouter une situation :** compléter `data/jugement.json` (format décrit en tête de `assets/js/jugement/quiz.js`), puis lancer `npm test`. Les tests vérifient notamment :

- que les rangs forment exactement 1, 2, 3 et 4 ;
- que les compétences citées existent ;
- que la difficulté vaut 1, 2 ou 3, avec environ un tiers par niveau ;
- que chaque action a une explication détaillée qui annonce clairement son rang ;
- que l'action la plus adéquate n'est pas systématiquement la plus longue (au plus 60 % des situations), pour que la longueur ne trahisse pas la réponse ;
- qu'il n'y a pas de quasi-doublon entre situations ni entre actions de situations différentes.

Ne jamais modifier l'identifiant d'une situation existante : la progression enregistrée des candidats y fait référence.

### Ma progression (sans inscription)

La page **Ma progression** (`progression/index.html`) suit les résultats **sans compte ni inscription**. Les données restent dans le navigateur de l'appareil (`localStorage`) : **rien n'est envoyé ni partagé**. Une phrase le rappelle sur la page et dans le pied de page de chaque page.

- **Enregistrement** :
  - pour chaque réponse : module, identifiant de la question, juste ou faux, date et temps de réponse. Le temps est mesuré depuis l'affichage de la question ; en examen, c'est le temps passé sur la question ;
  - pour chaque examen blanc : score global, score par catégorie, durée et date. Les réponses de l'examen sont aussi enregistrées.
- **Page Ma progression** :
  - par module : nombre de questions faites et taux de réussite ;
  - évolution des scores d'examen dans un graphique SVG sans bibliothèque. Il offre une infobulle au survol et au clavier, un résumé textuel pour les lecteurs d'écran et un tableau ;
  - historique des 10 derniers examens ;
  - **point faible** : le module le moins réussi (au moins 5 réponses), avec un lien vers ce module.
- **Revoir mes erreurs** :
  - dans chaque module, un bouton « Revoir mes erreurs (n) » apparaît dès qu'il y a des erreurs ;
  - il repropose les questions ratées, en entraînement comme en examen, avec la correction habituelle ;
  - une question sort de la liste après **2 bonnes réponses consécutives**, et une nouvelle erreur remet le compteur à zéro ;
  - au jugement situationnel, seule une situation au maximum des points compte comme réussie ;
  - les séries abstraites ratées sont régénérées à l'identique grâce à leur identifiant (règle + graine du tirage) ;
  - « Revoir toutes mes erreurs », sur la page Ma progression, enchaîne les modules qui ont des erreurs.
- **Mes données** :
  - export de la progression dans un fichier JSON ;
  - import d'un fichier pour passer d'un appareil à l'autre. Le fichier est contrôlé : format, version, contenu de chaque entrée. Un fichier invalide est refusé, avec la raison, sans toucher aux données ;
  - réinitialisation, après confirmation.
- **Robustesse** :
  - un seul module accède au stockage : `assets/js/progression/store.js`. Chaque lecture et écriture y est protégée ;
  - si le stockage est indisponible (navigation privée, données bloquées), le site fonctionne normalement : seules les fonctions de suivi sont désactivées, avec un message sur la page Ma progression ;
  - les données portent un **numéro de version de schéma**. Pour faire évoluer le format, on ajoute une migration dans `MIGRATIONS`. Des données venant d'une version plus récente du site ne sont jamais écrasées.

### Mode examen

Un examen blanc dans les conditions de l'épreuve :

- **35 questions** : 10 de raisonnement abstrait (générées, chaque règle au moins une fois), 10 affirmations verbales (réparties entre les textes), 10 questions numériques (réparties entre les jeux de données) et 5 situations de jugement, mélangées dans un ordre aléatoire. Le tirage équilibre les niveaux de difficulté, avec environ un tiers par niveau, dès qu'une banque les indique : c'est le cas de tous les modules (pour l'abstrait, les règles sont réparties à parts égales entre les trois niveaux) ;
- **chronomètre global strict de 40 minutes**, toujours visible en haut de l'écran. Il passe à l'orange à 5 minutes et au rouge à 1 minute, avec des annonces pour les lecteurs d'écran. À zéro, l'examen s'arrête immédiatement et les réponses sont notées en l'état ;
- **navigation libre** : boutons « Précédent » / « Suivant », accès direct par la grille des questions, réponses modifiables ou effaçables, questions marquées « à revoir ». Une situation de jugement avec un seul de ses deux choix apparaît comme « incomplète » ;
- **notation** : chaque question vaut 1 point. Une situation de jugement rapporte une fraction de point selon la même grille de proximité que le module (par exemple 3 points sur 4 = 0,75 point). Le score peut donc être décimal, par exemple 27,75 / 35 ;
- **aucune correction pendant l'épreuve** : après confirmation de « Terminer l'examen » (ou à la fin du temps), le bilan affiche :
  - le score, le temps utilisé et le résultat par section ;
  - la correction détaillée de chaque question : série complétée et règle pour l'abstrait, citation exacte et explication pour le verbal, calcul étape par étape pour le numérique, place de chaque action dans la grille et explications pour le jugement situationnel.

Le nombre de questions et la durée se règlent dans `EXAM_CONFIG` (`assets/js/examen/exam.js`). Chaque examen terminé est enregistré dans Ma progression, sur l'appareil.

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
├── 404.html                    # Page « introuvable » servie par GitHub Pages
├── robots.txt                  # Consignes aux moteurs de recherche, renvoi vers le sitemap
├── sitemap.xml                 # Plan du site : accueil, 5 modules et Ma progression
├── CLAUDE.md                   # Présentation et règles du projet pour Claude Code
├── modules/
│   ├── abstrait/index.html     # Module « Raisonnement abstrait »
│   ├── verbal/index.html       # Module « Raisonnement verbal »
│   ├── numerique/index.html    # Module « Raisonnement numérique »
│   ├── jugement/index.html     # Module « Jugement situationnel »
│   └── examen/index.html       # Mode examen chronométré
├── progression/index.html      # Page « Ma progression »
├── src/
│   ├── css/main.css            # Point d'entrée Tailwind : thème, fichiers analysés
│   ├── css/components.css      # Composants propres au site
│   └── og-image.html           # Source de l'image de partage (non publiée)
├── assets/
│   ├── css/app.css             # Feuille générée par `npm run build:css` (non versionnée)
│   ├── img/favicon.svg         # Logo / favicon
│   ├── img/og-image.png        # Image de partage (réseaux sociaux), 1200 × 630
│   └── js/
│       ├── main.js             # Page d'accueil : menu mobile, notifications
│       ├── lib/
│       │   ├── random.js       # Tirages aléatoires (graine reproductible pour les tests)
│       │   ├── dom.js          # Petits utilitaires DOM partagés
│       │   └── viz.js          # Graphiques SVG : éléments et infobulle
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
│       ├── examen/
│       │   ├── exam.js         # Composition, session chronométrée, notation (sans DOM)
│       │   └── app.js          # Interface de l'examen et bilan
│       └── progression/
│           ├── store.js        # Seul accès au stockage du navigateur : format versionné, import, export
│           ├── stats.js        # Statistiques, point faible, formatage (sans DOM)
│           ├── review.js       # « Revoir mes erreurs » : bouton, bandeau et bilan dans les modules
│           ├── chart.js        # Graphique d'évolution des examens (SVG)
│           └── app.js          # Page « Ma progression »
├── data/
│   ├── verbal.json             # Banque de textes et d'affirmations
│   ├── numerique.json          # Banque de jeux de données et de questions chiffrées
│   └── jugement.json           # Banque de situations professionnelles et grilles de correction
├── tests/                      # Tests automatisés (node --test)
├── scripts/
│   ├── build-site.js           # Assemble le site publiable dans dist/
│   └── calculer-numerique.js   # Calcule les propositions du raisonnement numérique
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
| `npm run calculer:numerique` | Recalcule les propositions du raisonnement numérique à partir des données |
| `npm test` | Lance tous les tests |

## Tests

```bash
npm test
```

Les tests (Node.js 20 ou plus) couvrent les cinq modules, le suivi de progression et le site :

- **Raisonnement abstrait** : des centaines de questions générées par règle. Chacune doit avoir 4 propositions distinctes, une seule bonne réponse qui prolonge réellement la série (invariant propre à chaque règle), des descriptions accessibles distinctes et une explication complète. S'y ajoutent l'empreinte des règles d'origine (identifiants stables), la répartition de trois règles par niveau et le nombre de sommets des polygones.
- **Raisonnement verbal** : validation de la banque de questions :
  - identifiants uniques et réponses valides ;
  - au moins 60 affirmations, 3 à 4 par texte, et identifiants de la banque initiale conservés ;
  - chaque citation est une phrase complète reprise mot pour mot du texte ;
  - environ un tiers par réponse et par niveau de difficulté, sans réponse dominante dans un niveau, explications détaillées ;
  - chaque « On ne peut pas savoir » est justifié comme tel dans l'explication ;
  - aucun quasi-doublon entre textes ni entre affirmations, usage belge des nombres.

  S'y ajoutent les tests de l'enchaînement des questions, du surlignage, de la typographie et du bilan.
- **Raisonnement numérique** : validation de la banque :
  - chaque bonne réponse et chaque piège sont recalculés par `scripts/calculer-numerique.js` : aucun écart toléré avec le fichier ;
  - chaque piège correspond au calcul de l'erreur qu'il décrit, et les erreurs typiques (mauvaise base, ligne oubliée, ratio inversé) sont bien représentées ;
  - les totaux sont cohérents ;
  - au moins 51 questions, identifiants initiaux conservés, les quatre compétences et les quatre formats (tableau, barres, courbes, secteurs) présents ;
  - environ un tiers par niveau de difficulté, aucun quasi-doublon, usage belge des nombres.

  S'y ajoutent les tests du moteur de calcul (priorités, puissances, refus des expressions invalides), du formatage à la française, de l'enchaînement et du bilan.
- **Jugement situationnel** :
  - validation de la banque : rangs 1 à 4, compétences connues, identifiants uniques, explications détaillées ;
  - au moins 30 situations, compétence principale bien couverte, environ un tiers par niveau de difficulté, thèmes demandés couverts (conflit, priorités, hiérarchie) ;
  - aucun quasi-doublon, longueur des actions sans biais, usage belge des nombres ;
  - notation par proximité, testée sur toutes les combinaisons de choix : le maximum n'est atteint qu'avec la grille ;
  - ordre aléatoire des actions et bilan par compétence.
- **Mode examen** :
  - composition : 10 + 10 + 10 questions et 5 situations de jugement, mélangées et réparties entre les textes et les jeux de données, tirage reproductible ;
  - équilibre des niveaux de difficulté, sans renoncer à la répartition entre les groupes ;
  - navigation libre : réponses modifiées ou effacées, questions marquées, situation de jugement complète seulement avec ses deux choix ;
  - chronomètre : décompte, arrêt strict à zéro avec refus des réponses tardives, temps figé à la remise ;
  - notation (bonnes réponses, réponses partielles du jugement situationnel, erreurs, questions vides, par section) et affichage du temps ;
  - temps passé sur chaque question, pour le suivi de progression.
- **Ma progression** :
  - stockage indisponible ou bloqué : le suivi est désactivé, sans erreur ;
  - quota atteint ;
  - enregistrement des réponses et des examens ;
  - règle des 2 réussites consécutives et remise à zéro après une erreur ;
  - export puis import ;
  - fichiers d'import invalides (JSON, version, contenu), avec les données conservées ;
  - migration de version et refus d'écraser des données plus récentes ;
  - données illisibles mises de côté ;
  - statistiques, point faible, résumé du graphique et formatage à la française.
- **Identifiants** :
  - chaque question a un identifiant unique et stable : aucun doublon, dans un module comme entre modules ;
  - les séries abstraites sont régénérées à l'identique à partir de leur identifiant ;
  - les questions d'examen gardent l'identifiant de leur question d'origine.
- **Site** :
  - chaque page charge la feuille CSS compilée (plus aucun CDN) ;
  - tous les liens et ressources locaux existent et sont en chemins relatifs ;
  - chaque page déclare son adresse canonique, `og:url` et `og:image` sur https://selor-epso-prep.eu ;
  - le sitemap liste exactement les pages, et robots.txt y renvoie ;
  - la page 404 n'est pas indexée et ses liens visent des fichiers existants ;
  - plus aucune référence à l'ancienne adresse github.io ;
  - la mention de non-affiliation et la phrase « Vos résultats restent sur cet appareil » figurent sur chaque page ;
  - Ma progression est accessible depuis le menu principal et chaque module ;
  - un seul module accède au stockage du navigateur.

## Hébergement

L'application est publiée sur **GitHub Pages** par le workflow `.github/workflows/deploy.yml`. À chaque mise à jour de `main`, il lance les tests, compile le CSS, assemble `dist/` et met le site en ligne. Si un test échoue, rien n'est publié.

- **Activation (une seule fois)** : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
- **Adresse** : **https://selor-epso-prep.eu**, domaine personnalisé configuré :
  - DNS chez Infomaniak ;
  - domaine renseigné dans *Settings → Pages → Custom domain*.

  L'ancienne adresse GitHub Pages du dépôt redirige automatiquement vers ce domaine (comportement standard de GitHub Pages).
- **Pas de fichier `CNAME`** : avec une publication par GitHub Actions, le domaine est enregistré dans les réglages de Pages, et un fichier `CNAME` dans le dépôt serait ignoré.
- **Référencement** :
  - chaque page déclare son adresse canonique et ses balises Open Graph, dont l'image `assets/img/og-image.png` ;
  - `sitemap.xml` et `robots.txt` sont publiés à la racine.
- **Page 404** : `404.html` est servie pour toute adresse inexistante, à n'importe quelle profondeur. C'est pourquoi ses liens utilisent l'adresse absolue du site, seule exception à la règle des chemins relatifs.
- **Redéployer sans nouveau commit** : onglet *Actions* → « Déploiement GitHub Pages » → *Run workflow*.
- **Dépôt privé** : GitHub Pages n'est disponible sur un dépôt privé qu'avec une offre payante (Pro, Team ou Enterprise). Avec un compte gratuit, le dépôt doit être public. Dans tous les cas, le site publié est public.

Chaque pull request est aussi vérifiée (tests et construction) par `.github/workflows/ci.yml`.

Le dossier `dist/` étant un site statique autonome, il peut aussi être déployé sur Netlify, Cloudflare Pages, etc. (commande de build : `npm run build`, dossier publié : `dist`).

## Publier un module

Les cinq modules sont en ligne. Pour en ajouter un nouveau :

- créer sa carte sur la page d'accueil, avec un lien vers `modules/<nom>/index.html` ;
- ajouter son adresse à `sitemap.xml` ;
- ajouter dans son `<head>` la balise `canonical` et les balises Open Graph, sur le modèle des autres modules ;
- pour le suivi de progression :
  - ajouter le module à `MODULE_IDS` (`assets/js/progression/store.js`) et à `MODULES` (`stats.js`) ;
  - enregistrer chaque réponse avec `recordAnswer` et un identifiant de question stable ;
  - installer le bouton de révision avec `createReviewControls`, comme dans les modules existants.

Les tests vérifient les trois premiers points. Tant que le module n'est pas prêt, ce lien porte l'attribut `data-coming-soon` (il affiche alors un message « bientôt disponible », géré par `assets/js/main.js`), et la carte porte un badge « Bientôt disponible ». Une fois le module publié, retirer l'attribut et le badge.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO). Les textes du module verbal sont des créations originales à visée pédagogique : les organismes et les chiffres cités sont fictifs.
