# Prépa SELOR & EPSO

Application web **gratuite**, sans inscription, pour s'entraîner aux tests de sélection de la fonction publique belge (**SELOR / Travaillerpour.be**, SPF BOSA) et des institutions européennes (**EPSO**). Elle propose des exercices originaux corrigés et expliqués, et un examen blanc chronométré :

- raisonnement abstrait ;
- raisonnement verbal ;
- raisonnement numérique ;
- jugement situationnel ;
- mode examen ;
- page « Ma progression » : suivi sans inscription et révision des erreurs, avec des données stockées uniquement dans le navigateur.

Le site est **bilingue** : français à la racine, néerlandais de Belgique (`nl-BE`) sous `/nl/`, avec la même arborescence. Les pages des deux langues sont générées à partir de gabarits communs et de dictionnaires de textes (voir « Site bilingue » ci-dessous).

Le README détaille chaque module, les commandes et les tests.

## Domaine et hébergement

- **Adresse publique : https://selor-epso-prep.eu**. Le DNS est chez Infomaniak et le domaine est renseigné dans *Settings → Pages → Custom domain*. L'ancienne adresse GitHub Pages du dépôt redirige vers ce domaine.
- Le site est publié par **GitHub Actions** (`.github/workflows/deploy.yml`) à chaque push sur `main` :
  - le workflow lance `npm ci`, `npm test`, puis `npm run build` ;
  - il publie le dossier `dist/` produit par `scripts/build-site.js`.
- Avec ce mode de publication, le domaine est stocké dans les réglages de Pages : le dépôt n'a pas de fichier `CNAME`.
- `dist/` contient les pages générées (`index.html`, `modules/…`, `progression/…`, `nl/…`), `404.html`, `sitemap.xml` et `robots.txt`, tous générés, plus une copie des dossiers listés dans `STATIC_ENTRIES` (`scripts/site/config.js` : `assets`, `data`). Un nouveau dossier publié tel quel doit y figurer.
- Les pull requests sont vérifiées par `.github/workflows/ci.yml` (tests et construction).

## Structure

```
src/pages/              Gabarits des pages, communs aux deux langues : index.html, 404.html (bilingue),
                        modules/<nom>.html (abstrait, verbal, numerique, jugement, examen), progression.html
src/partials/           Fragments partagés : head, header, lang-switch (sélecteur FR | NL), footer…
src/i18n/fr.json, nl.json  Textes des pages (mêmes clés dans les deux langues)
scripts/site/config.js  Langues, liste des pages (PAGES), drapeau NL_PUBLIC, STATIC_ENTRIES
scripts/site/templates.js  Moteur de gabarits minimal ({{> fragment}}, {{t:cle}}, {{#if}}, {{variable}})
scripts/build-site.js   Génère dist/ : pages FR (racine) et NL (/nl/), 404, sitemap.xml, robots.txt
assets/js/<module>/     quiz.js ou generator.js (logique sans DOM, testée sous Node),
                        view.js (rendu partagé avec le mode examen), app.js (interface)
assets/js/i18n/fr.js, nl.js  Textes produits par le JavaScript (mêmes clés dans les deux langues)
assets/js/lib/          Utilitaires partagés : i18n.js (langue de la page, t(), typographie, banque de la langue),
                        typography.js, random.js (tirages avec graine), dom.js, viz.js (SVG, infobulle)
assets/js/progression/  Suivi de progression : store.js (SEUL accès à localStorage), stats.js,
                        review.js (« Revoir mes erreurs » dans les modules), chart.js, app.js (page)
assets/img/             favicon.svg, og-image.png et og-image-nl.png (images de partage 1200 × 630)
assets/css/app.css      Généré par Tailwind (npm run build:css), non versionné
src/css/                main.css (thème Tailwind, fichiers analysés), components.css
src/og-image.html       Gabarit des images de partage (non publié ; node scripts/og-image.js)
data/*.json             Banques d'exercices en français : verbal, numerique, jugement (validées par les tests)
data/nl/*.json          Banques traduites en néerlandais : mêmes identifiants, mêmes réponses
tests/                  Tests node --test (un fichier par module + site.test.js + i18n.test.js)
scripts/calculer-numerique.js  Calcule les propositions de data/numerique.json et data/nl/numerique.json,
                        et vérifie que les deux langues ont les mêmes calculs (npm run calculer:numerique)
```

## Commandes

- `npm start` : construit le site (CSS + pages des deux langues) et sert `dist/` sur http://localhost:8000 (néerlandais : `/nl/`).
- `npm run watch:css` et `npm run watch:site` : recompilent le CSS et reconstruisent `dist/` en continu pendant le développement.
- `npm test` : lance tous les tests ; ils doivent passer avant chaque commit.
- `npm run build` : produit `dist/`, comme en production.
- Lint, sans dépendance ajoutée au projet :

  ```bash
  npx --yes eslint@9 --no-config-lookup --rule '{"no-unused-vars":"error","no-undef":"off"}' --parser-options=ecmaVersion:latest,sourceType:module assets/js tests scripts
  ```

## Règles du projet

1. **Ne jamais supprimer ni modifier le fichier `CNAME`.** Aujourd'hui, la publication par GitHub Actions n'en utilise pas. Si un tel fichier existe un jour, il ne doit pas être touché.
2. **Toujours utiliser des chemins relatifs** pour les liens, les ressources et les `fetch` (`../../assets/…`, `new URL('../../../data/x.json', import.meta.url)`). Aucun chemin commençant par `/`. Aucune référence à l'ancienne adresse `github.io`. Seules deux exceptions utilisent l'adresse absolue `https://selor-epso-prep.eu` :
   - les balises de référencement : `canonical`, `og:url`, `og:image`, `hreflang`, `sitemap.xml` et `robots.txt` ;
   - la page `404.html`, car GitHub Pages la sert à n'importe quelle profondeur.
3. **Site bilingue : français de Belgique (`fr_BE`) et néerlandais de Belgique (`nl_BE`)** :
   - **toute nouvelle chaîne ou question doit exister dans les deux langues, avec le même identifiant** :
     - textes des pages dans `src/i18n/fr.json` et `nl.json`, textes du JavaScript dans `assets/js/i18n/fr.js` et `nl.js`, avec les mêmes clés ; aucun texte d'interface écrit en dur dans un gabarit ou un script ;
     - questions dans `data/<banque>.json` et `data/nl/<banque>.json` : mêmes identifiants et mêmes bonnes réponses (des tests le vérifient) ;
   - pages générées par `scripts/build-site.js` à partir des gabarits de `src/pages/` : ne jamais écrire une page à la main dans une langue ;
   - `lang="fr"` / `og:locale` `fr_BE` en français, `lang="nl"` / `og:locale` `nl_BE` en néerlandais ;
   - typographie française : espaces insécables avant `: ; ? !` et guillemets « » (voir `frenchTypography`) ; en néerlandais, pas d'espace avant la ponctuation, guillemets “ ” et `72%` sans espace ;
   - nombres au format `fr-BE` ou `nl-BE` (`intlLocale()`) ;
   - néerlandais de Belgique, registre de l'administration flamande et fédérale, avec les noms officiels : FOD BOSA, Werkenvoor.be (vroeger Selor), EPSO (Europees Bureau voor personeelsselectie, eu-careers.europa.eu/nl) ;
   - pas de redirection automatique selon la langue du navigateur ; la progression est commune aux deux langues ;
   - tant que `NL_PUBLIC` vaut `false` (`scripts/site/config.js`), les pages `/nl/` ne sont pas découvrables (`noindex`, hors sitemap, sans sélecteur de langue ni `hreflang`).
4. **Exercices originaux uniquement**, jamais copiés ni adaptés de tests officiels (EPSO, SPF BOSA / Travaillerpour.be) ou d'ouvrages protégés. Les organismes, chiffres et situations cités sont fictifs. La grille du jugement situationnel est une grille d'entraînement, présentée comme telle, et non une grille officielle.
5. **Conserver la mention « non affiliée au SPF BOSA ni à l'EPSO »** dans le pied de page de chaque page, et sa traduction « niet verbonden aan de FOD BOSA … en evenmin aan het Europees Bureau voor personeelsselectie (EPSO) » sur les pages néerlandaises. Elle figure aussi dans le README et sur les images de partage (« Plateforme indépendante » / « Onafhankelijk platform »). Un test vérifie sa présence.
6. **Pas de dépendance externe sans nécessité** :
   - pas de CDN, pas de framework, pas de bibliothèque d'exécution : HTML, Tailwind compilé et JavaScript natif en modules ES ;
   - les seules dépendances de développement sont `@tailwindcss/cli` et `http-server` ;
   - toute nouvelle dépendance doit être justifiée.

7. **Données de progression : sur l'appareil uniquement.**
   - Aucune donnée n'est envoyée ni partagée, et la phrase « Vos résultats restent sur cet appareil : rien n'est envoyé ni partagé. » (en néerlandais : « Je resultaten blijven op dit toestel: er wordt niets verzonden of gedeeld. ») doit rester vraie. Elle figure sur la page Ma progression et dans le pied de page de chaque page.
   - Pas de mesure d'audience, de cookie ni d'appel réseau vers un tiers sans décision explicite et mise à jour de ce texte.
   - Seul `assets/js/progression/store.js` accède à `localStorage`. Chaque accès y est protégé par try/catch, et un test le vérifie.
   - Le site doit fonctionner normalement si le stockage est indisponible.
8. **Identifiants de questions stables.** Les progressions enregistrées y font référence.
   - Ne jamais changer ni réutiliser l'identifiant d'une question existante.
   - Pour le raisonnement abstrait, l'identifiant est « règle/graine » (`questionFromId`) : modifier la génération d'une règle change les questions associées aux identifiants déjà enregistrés. Un test d'empreinte (`tests/abstrait.test.js`) le détecte ; pour une variante, créer une nouvelle règle.
   - Toute évolution du format des données passe par `SCHEMA_VERSION` et une migration dans `MIGRATIONS` (`store.js`), avec un test.

## Conventions de travail

- **Une branche et une pull request par fonctionnalité**, vers `main`. La fusion déclenche la mise en ligne.
- **À la fin de chaque tâche : ouvrir une PR vers main et la fusionner si les tests, le build et le lint passent, puis vérifier que le déploiement réussit.**
  - Tests : `npm test`. Build : `npm run build`. Lint : la commande ci-dessus.
  - La vérification « Tests et construction » de la PR (`.github/workflows/ci.yml`) doit aussi être verte avant la fusion.
  - Après la fusion, l'exécution du workflow « Déploiement GitHub Pages » sur `main` doit se terminer en succès. Sinon, corriger dans une nouvelle PR.
- **Nouvelle page** :
  - créer son gabarit dans `src/pages/` (avec `{{> head}}`, qui fournit `canonical`, `og:url`, `og:image`, `hreflang`) et l'ajouter à `PAGES` dans `scripts/site/config.js` : elle est générée dans les deux langues et ajoutée au sitemap ;
  - ajouter ses textes (dont `meta.<page>.title`, `description`, `ogTitle`, `ogDescription`) dans les deux dictionnaires ;
  - les tests de `tests/site.test.js` et `tests/i18n.test.js` le vérifient.
- **Nouvelles classes Tailwind** : elles sont détectées dans les fichiers listés par `@source` dans `src/css/main.css` (gabarits, fragments, dictionnaires, JavaScript). Si un dossier n'y figure pas, l'ajouter.
- **Traductions** : chaque traduction néerlandaise d'un module est relue par un second relecteur (contresens, tournures des Pays-Bas plutôt que de Belgique, et pour le verbal, affirmations dont la réponse ne tiendrait plus au regard du texte néerlandais).
- **Banques d'exercices** :
  - leur format est décrit en tête du `quiz.js` du module ;
  - `validateBank` et les tests vérifient les identifiants, les réponses, les citations exactes et les calculs.
- **Accessibilité** :
  - les modules se pilotent au clavier ;
  - les éléments graphiques ont une description textuelle ;
  - le focus est déplacé après chaque action.
- **Contenu et design** : ne pas modifier le contenu des exercices ni le design sans demande explicite.
