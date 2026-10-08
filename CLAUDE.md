# Prépa SELOR & EPSO

Application web **gratuite**, sans inscription, pour s'entraîner aux tests de sélection de la fonction publique belge (**SELOR / Travaillerpour.be**, SPF BOSA) et des institutions européennes (**EPSO**). Elle propose des exercices originaux corrigés et expliqués, et un examen blanc chronométré :

- raisonnement abstrait ;
- raisonnement verbal ;
- raisonnement numérique ;
- jugement situationnel ;
- mode examen ;
- page « Ma progression » : suivi sans inscription et révision des erreurs, avec des données stockées uniquement dans le navigateur.

Le README détaille chaque module, les commandes et les tests.

## Domaine et hébergement

- **Adresse publique : https://selor-epso-prep.eu**. Le DNS est chez Infomaniak et le domaine est renseigné dans *Settings → Pages → Custom domain*. L'ancienne adresse GitHub Pages du dépôt redirige vers ce domaine.
- Le site est publié par **GitHub Actions** (`.github/workflows/deploy.yml`) à chaque push sur `main` :
  - le workflow lance `npm ci`, `npm test`, puis `npm run build` ;
  - il publie le dossier `dist/` assemblé par `scripts/build-site.js`.
- Avec ce mode de publication, le domaine est stocké dans les réglages de Pages : le dépôt n'a pas de fichier `CNAME`.
- Un fichier publié à la racine (comme `404.html`, `robots.txt` ou `sitemap.xml`) doit figurer dans `PUBLIC_ENTRIES` de `scripts/build-site.js`.
- Les pull requests sont vérifiées par `.github/workflows/ci.yml` (tests et construction).

## Structure

```
index.html              Page d'accueil (cartes des modules)
404.html                Page « introuvable » (servie à n'importe quelle adresse inexistante)
robots.txt, sitemap.xml Référencement (accueil + 5 modules + Ma progression)
modules/<nom>/index.html  Une page par module : abstrait, verbal, numerique, jugement, examen
progression/index.html  Page « Ma progression »
assets/js/<module>/     quiz.js ou generator.js (logique sans DOM, testée sous Node),
                        view.js (rendu partagé avec le mode examen), app.js (interface)
assets/js/lib/          Utilitaires partagés : random.js (tirages avec graine), dom.js, viz.js (SVG, infobulle)
assets/js/progression/  Suivi de progression : store.js (SEUL accès à localStorage), stats.js,
                        review.js (« Revoir mes erreurs » dans les modules), chart.js, app.js (page)
assets/img/             favicon.svg, og-image.png (image de partage 1200 × 630)
assets/css/app.css      Généré par Tailwind (npm run build:css), non versionné
src/css/                main.css (thème Tailwind, fichiers analysés), components.css
src/og-image.html       Source de og-image.png (non publiée)
data/*.json             Banques d'exercices : verbal, numerique, jugement (validées par les tests)
tests/                  Tests node --test (un fichier par module + site.test.js)
scripts/build-site.js   Assemble dist/
scripts/calculer-numerique.js  Calcule les propositions de data/numerique.json (npm run calculer:numerique)
```

## Commandes

- `npm start` : compile le CSS et sert le site sur http://localhost:8000.
- `npm run watch:css` : recompile le CSS en continu pendant le développement.
- `npm test` : lance tous les tests ; ils doivent passer avant chaque commit.
- `npm run build` : produit `dist/`, comme en production.
- Lint, sans dépendance ajoutée au projet :

  ```bash
  npx --yes eslint@9 --no-config-lookup --rule '{"no-unused-vars":"error","no-undef":"off"}' --parser-options=ecmaVersion:latest,sourceType:module assets/js tests scripts
  ```

## Règles du projet

1. **Ne jamais supprimer ni modifier le fichier `CNAME`.** Aujourd'hui, la publication par GitHub Actions n'en utilise pas. Si un tel fichier existe un jour, il ne doit pas être touché.
2. **Toujours utiliser des chemins relatifs** pour les liens, les ressources et les `fetch` (`../../assets/…`, `new URL('../../../data/x.json', import.meta.url)`). Aucun chemin commençant par `/`. Aucune référence à l'ancienne adresse `github.io`. Seules deux exceptions utilisent l'adresse absolue `https://selor-epso-prep.eu` :
   - les balises de référencement : `canonical`, `og:url`, `og:image`, `sitemap.xml` et `robots.txt` ;
   - la page `404.html`, car GitHub Pages la sert à n'importe quelle profondeur.
3. **Site en français de Belgique (`fr_BE`)** :
   - `lang="fr"` sur chaque page et `og:locale` à `fr_BE` ;
   - typographie française : espaces insécables avant `: ; ? !` et guillemets « » (voir `frenchTypography`) ;
   - nombres au format `fr-BE`.
4. **Exercices originaux uniquement**, jamais copiés ni adaptés de tests officiels (EPSO, SPF BOSA / Travaillerpour.be) ou d'ouvrages protégés. Les organismes, chiffres et situations cités sont fictifs. La grille du jugement situationnel est une grille d'entraînement, présentée comme telle, et non une grille officielle.
5. **Conserver la mention « non affiliée au SPF BOSA ni à l'EPSO »** dans le pied de page de chaque page. Elle figure aussi dans le README et sur l'image de partage (« Plateforme indépendante »). Un test vérifie sa présence.
6. **Pas de dépendance externe sans nécessité** :
   - pas de CDN, pas de framework, pas de bibliothèque d'exécution : HTML, Tailwind compilé et JavaScript natif en modules ES ;
   - les seules dépendances de développement sont `@tailwindcss/cli` et `http-server` ;
   - toute nouvelle dépendance doit être justifiée.

7. **Données de progression : sur l'appareil uniquement.**
   - Aucune donnée n'est envoyée ni partagée, et la phrase « Vos résultats restent sur cet appareil : rien n'est envoyé ni partagé. » doit rester vraie. Elle figure sur la page Ma progression et dans le pied de page de chaque page.
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
  - l'ajouter à `sitemap.xml` ;
  - lui donner dans son `<head>` la balise `canonical`, `og:url` et `og:image`, sur le modèle des modules existants ;
  - les tests de `tests/site.test.js` le vérifient.
- **Nouvelles classes Tailwind** : elles sont détectées dans les fichiers listés par `@source` dans `src/css/main.css`. Si une page ou un dossier n'y figure pas, l'ajouter.
- **Banques d'exercices** :
  - leur format est décrit en tête du `quiz.js` du module ;
  - `validateBank` et les tests vérifient les identifiants, les réponses, les citations exactes et les calculs.
- **Accessibilité** :
  - les modules se pilotent au clavier ;
  - les éléments graphiques ont une description textuelle ;
  - le focus est déplacé après chaque action.
- **Contenu et design** : ne pas modifier le contenu des exercices ni le design sans demande explicite.
