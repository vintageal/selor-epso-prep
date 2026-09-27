# Prépa SELOR & EPSO

Application web gratuite pour s'entraîner aux tests de logique et de raisonnement des sélections **SELOR / Travaillerpour.be** (fonction publique belge) et **EPSO** (institutions européennes).

## Modules

| Module | Contenu | Statut |
| --- | --- | --- |
| Raisonnement abstrait | Séries de formes : trouver la figure qui complète la série | À venir |
| Raisonnement verbal | Textes et affirmations : vrai, faux ou impossible à déterminer | À venir |
| Mode examen | Test chronométré mélangeant questions abstraites et verbales | À venir |

## Stack

- **HTML5** statique, sans étape de build
- **Tailwind CSS v4** via le CDN navigateur (`@tailwindcss/browser`), thème défini dans `index.html`
- **JavaScript ES6+** natif, sans framework

## Arborescence

```
.
├── index.html            # Page d'accueil
├── assets/
│   ├── css/styles.css    # Styles complémentaires à Tailwind
│   ├── js/main.js        # Menu mobile, notifications, liens des modules
│   └── img/favicon.svg   # Logo / favicon
├── modules/              # Pages des futurs modules
│   ├── abstrait/
│   ├── verbal/
│   └── examen/
└── data/                 # Futures banques de questions (JSON)
```

## Lancer en local

La page s'ouvre directement dans le navigateur (`index.html`). Pour un comportement identique à l'hébergement, servez le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Hébergement

Site 100 % statique : déployable tel quel sur GitHub Pages, Netlify, Cloudflare Pages, etc.

> Avant la mise en production, remplacer le CDN Tailwind par une feuille CSS générée (Tailwind CLI) : le CDN navigateur est prévu pour le développement.

## Publier un module

Les cartes de la page d'accueil pointent déjà vers `modules/<nom>/`. Tant qu'un module n'est pas prêt, son lien porte l'attribut `data-coming-soon` et affiche un message « bientôt disponible ». Une fois la page du module créée, retirer cet attribut et le badge « Bientôt disponible » de la carte.

## Avertissement

Plateforme indépendante, non affiliée au SPF BOSA (Travaillerpour.be, anciennement SELOR) ni à l'Office européen de sélection du personnel (EPSO).
