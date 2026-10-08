# Reprise : version néerlandaise (nl-BE)

Point d'arrêt du 8 octobre 2026. Ce fichier n'est pas publié : `scripts/build-site.js` ne copie dans `dist/` que les pages générées, `assets/` et `data/`.

## Branches

| Branche | État |
| --- | --- |
| `main` | Contient l'étape NL 1, fusionnée par la PR #14. Le déploiement « Déploiement GitHub Pages » du commit `047dcae` a réussi. |
| **`claude/nl-jugement`** (branche en cours) | Étape NL 2, poussée, sans PR. Contient ce fichier. |
| `claude/nl-verbal-brouillon` | Brouillon de l'étape NL 3 (traduction du verbal), basé sur `claude/nl-jugement`. Sauvegarde seulement, à ne pas fusionner telle quelle. |

## Ce qui est fait

### NL 1 : infrastructure et interface (fusionnée)

- **Génération des pages** : `scripts/build-site.js` génère les deux langues à partir de gabarits communs (`src/pages/`, `src/partials/`) et des dictionnaires `src/i18n/fr.json` et `nl.json`.
  - Le français occupe la racine, le néerlandais `/nl/`, avec la même arborescence.
  - La page 404, `sitemap.xml` et `robots.txt` sont générés.
  - Les pages écrites à la main ont été supprimées du dépôt.
- **Interface JavaScript** : `assets/js/lib/i18n.js` et les dictionnaires `assets/js/i18n/fr.js` et `nl.js`.
  - Typographie et nombres au format `fr-BE` / `nl-BE`.
  - Abstrait : explications et descriptions des figures en néerlandais ; les empreintes des questions sont inchangées.
- **Mise en ligne progressive** : drapeau `NL_PUBLIC = false` dans `scripts/site/config.js`.
  - Pages `/nl/` en `noindex`, hors sitemap, sans sélecteur ni `hreflang`.
  - Page 404 en français seulement.
  - L'état activé (`renderSite({ nlPublic: true })`) est déjà rendu et testé.
- **Image de partage NL** : `assets/img/og-image-nl.png`, générée par `NODE_PATH="$(npm root -g)" node scripts/og-image.js` à partir de `src/og-image.html`.
- **Tests** : `tests/site.test.js` (pages générées, deux langues, deux états) et `tests/i18n.test.js` (parité des dictionnaires, terminologie, rendu NL).
- **Relecture de l'interface** par un sous-agent : les corrections et la plupart des suggestions ont été appliquées (voir la PR #14).

### NL 2 : jugement situationnel (en cours, branche `claude/nl-jugement`)

- `data/nl/jugement.json` : 30 situations et 120 actions traduites.
  - Mêmes identifiants, rangs, compétences et difficulté. Seuls les textes changent.
  - La structure JSON est identique à la banque française.
- `assets/js/lib/i18n.js` : `TRANSLATED_BANKS.nl = ['jugement']`. La version NL charge cette banque.
- `tests/traductions.test.js` : échoue si une question manque dans une langue, si un identifiant, un rang ou une réponse diffère, si un texte n'est pas traduit (mot français, typographie française, longueur suspecte), ou si un même thème est traduit de deux façons. Deux mutations ont été vérifiées : un rang inversé et une situation supprimée font bien échouer le test.
- Vérifications faites :
  - `npm test` : 173 tests verts ;
  - lint OK ;
  - module NL vérifié dans le navigateur, examen NL chargé sans erreur.
- **Non fait** : la relecture par un sous-agent a été interrompue par la pause, sans résultat. Elle est à relancer.

### NL 3 : brouillon du verbal (branche `claude/nl-verbal-brouillon`)

- `traductions/nl-verbal/v1.json` à `v5.json` : 15 textes et 60 affirmations traduits, non relus.
  - Les textes sont découpés en phrases alignées sur le français.
  - `assembler.cjs` produit la banque NL : structure, réponses et difficulté sont reprises du français, et les citations sont recalculées à partir de la position des phrases citées.
- Contrôles déjà passés sur le résultat :
  - `validateBank` sans erreur (citations exactes) ;
  - chaque explication « Kan niet worden bepaald » contient cette formule ;
  - chaque explication cite le texte entre “ ”.
- Écart cosmétique : la mise en forme JSON diffère un peu de `data/verbal.json`. Les tableaux d'une seule citation sont tantôt sur une ligne, tantôt non dans la banque française.

## Ce qui reste à faire

### NL 2 (branche `claude/nl-jugement`)

1. **Relancer la relecture par un sous-agent** qui n'a pas écrit la traduction.
   - Il doit chercher :
     - les contresens ;
     - tout ce qui rendrait une action plus ou moins adéquate qu'en français ;
     - les tournures des Pays-Bas plutôt que de Belgique ;
     - les fautes ;
     - la cohérence terminologique.
   - Fichier de relecture à générer à partir de `data/jugement.json` et `data/nl/jugement.json` : un Markdown avec une paire FR/NL par champ. Les champs sont le titre, le thème, le contexte, chaque paragraphe de la situation, la synthèse, et pour chaque action son rang, son texte et son explication.
2. Appliquer les corrections, puis relancer `npm test`, `npm run build` et le lint.
3. Retirer `REPRISE.md` de la branche avant la PR, sauf avis contraire.
4. Ouvrir la PR « Version néerlandaise (2/5) : jugement situationnel ».
5. Attendre que la vérification « Tests et construction » soit verte, fusionner, puis vérifier le workflow « Déploiement GitHub Pages ».

### NL 3 : raisonnement verbal

1. Après la fusion de NL 2, créer `claude/nl-verbal` depuis `main` et y reprendre le brouillon : `git checkout origin/claude/nl-verbal-brouillon -- traductions/nl-verbal`.
2. Générer la banque : `node traductions/nl-verbal/assembler.cjs data/nl/verbal.json`. Ne pas versionner `traductions/` à la fin.
3. Ajouter `'verbal'` à `TRANSLATED_BANKS.nl`.
4. Ajouter la vérification `verbal` à `BANK_CHECKS` dans `tests/traductions.test.js` :
   - mêmes identifiants de textes et d'affirmations ;
   - même réponse et même difficulté ;
   - même nombre de citations ;
   - citations exactes et phrases complètes ;
   - formule « kan niet worden bepaald » pour les réponses « impossible » ;
   - citation “…” dans chaque explication.
5. Faire relire par un sous-agent, en priorité chaque affirmation : la réponse tient-elle au regard du texte NL ? Une nuance perdue ou ajoutée peut faire passer « Kan niet worden bepaald » à « Niet waar ».
6. Faire la vérification dans le navigateur, puis la PR, la fusion et le contrôle du déploiement.

### NL 4 : raisonnement numérique

1. Créer `data/nl/numerique.json`.
   - Garder identiques les données, les valeurs, les expressions de calcul, les valeurs des propositions et `answer`.
   - Traduire seulement : titre, thème, note, libellés des lignes et des colonnes, unités, énoncés, formules, libellés des étapes, `why` des propositions et explications.
2. Traduire les unités : `ETP` → `VTE`, `sur 20` → `op 20`, `agents` → `personeelsleden`, `demandes` → `aanvragen`, etc.
3. Trancher la notation de l'euro (« 12,5 € » ou « € 12,5 », et `M€`, `k€`), puis adapter `numerique.withUnit` dans `assets/js/i18n/nl.js` si nécessaire.
4. `scripts/calculer-numerique.js` doit valider les deux langues : `--check` aussi sur `data/nl/numerique.json`. Un test vérifie la même structure et les mêmes résultats calculés en FR et en NL.
5. Ajouter `'numerique'` à `TRANSLATED_BANKS.nl` et la vérification `numerique` à `BANK_CHECKS`.
6. Faire relire par un sous-agent, puis la PR, la fusion et le contrôle du déploiement.

### NL 5 : activation

1. Passer `NL_PUBLIC = true` dans `scripts/site/config.js`. Le test `traductions.test.js` exige alors que les trois banques soient traduites.
2. Les tests de `tests/site.test.js` couvrent déjà l'état activé :
   - sélecteur FR | NL ;
   - `hreflang` fr-BE, nl-BE et x-default ;
   - alternances dans le sitemap ;
   - plus de `noindex` ;
   - 404 bilingue.
3. Mettre à jour le README (« néerlandais … en préparation ») et CLAUDE.md (mention de la mise en ligne progressive).
4. Faire la PR, la fusion et le contrôle du déploiement.
5. Rédiger le rapport final :
   - liste des pages NL : accueil, 5 modules, Mijn voortgang et 404 bilingue ;
   - nombre de questions traduites par module : jugement 30 situations, verbal 60 affirmations, numérique à compter ;
   - points de traduction incertains (ci-dessous).

## Décisions prises

- **Architecture** : gabarits communs et dictionnaires, rendus à la construction, sans dépendance. Les pages, `404.html`, `sitemap.xml` et `robots.txt` sont générés et non versionnés.
- **Banques** : la version NL utilise la banque FR tant que la banque NL n'existe pas (`TRANSLATED_BANKS`). Les identifiants et les réponses sont identiques dans les deux langues.
- **Progression commune aux deux langues** : même stockage, mêmes identifiants. Vérifié dans le navigateur.
- **Aucune redirection** selon la langue du navigateur.
- **Avant activation** : 404 en français seulement, et aucun lien des pages FR vers `/nl/`.
- **Terminologie NL** :
  - Marque : « SELOR & EPSO Prep ».
  - Registre : tutoiement « je » ; formes belges « je kan », « je wil », « werd » + participe.
  - Noms officiels : FOD BOSA, Werkenvoor.be (vroeger Selor), Europees Bureau voor personeelsselectie (EPSO), eu-careers.europa.eu/nl, werkenvoor.be/nl.
  - Modules : Abstract redeneren, Verbaal redeneren, Numeriek redeneren, Situationeel beoordelen, Examenmodus, Mijn voortgang.
  - Verbal : « Waar / Niet waar / Kan niet worden bepaald », touches W, N et ?.
  - Jugement :
    - « meest / minst gepast » ;
    - « antwoordsleutel » pour la grille ;
    - compétences : Problemen oplossen, Samenwerken, Resultaatgericht werken, Communicatie, Organisatie en prioriteiten, Servicegericht werken, Integriteit, Veerkracht, Leidinggeven.
  - Autres termes : « proefexamen » ; « herbekijken » pour la révision des erreurs ; « Historiek » pour l'historique ; « Na te kijken » pour les questions marquées à l'examen.
  - Typographie : pas d'espace avant « : », guillemets “ ”, « 72% », nombres `nl-BE` (« 1.010 », « 7,8 »).
  - Abstrait : « naar beneden » plutôt que « naar onder ».
- **Adaptations d'institutions** dans le jugement :
  - Fédération Wallonie-Bruxelles → Vlaamse Gemeenschap ;
  - CPAS → OCMW ;
  - ASBL → vzw ;
  - espace public numérique → openbare computerruimte.

## Points en suspens

- **Relecture NL 2** : elle a été interrompue et doit être relancée avant la PR.
- **Points de traduction incertains**, à signaler dans le rapport final :
  - la marque « SELOR & EPSO Prep » : anglicisme, et « SELOR » en capitales alors que les mentions écrivent « Selor » ;
  - « Kan niet worden bepaald », face à « Kan niet gezegd worden » ou « Niet te bepalen » ;
  - « tests » ou « testen » ;
  - « geïnspireerd op » et « openbare selectietests » dans le pied de page de l'accueil ;
  - le tutoiement « je » plutôt que « u » ;
  - les adaptations d'institutions du jugement : à confirmer.
- **Notation de l'euro** en néerlandais : à trancher à l'étape NL 4.
- **Site en ligne** : il n'est pas joignable depuis l'environnement de travail (le proxy renvoie 403). Le déploiement n'a été vérifié que par le résultat du workflow.
