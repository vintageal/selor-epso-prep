/*
 * Configuration du site bilingue : adresse publique, langues et pages générées par scripts/build-site.js.
 */

export const SITE = 'https://selor-epso-prep.eu';

/**
 * Langues du site. Le français est la langue par défaut (x-default) et occupe la racine ;
 * le néerlandais de Belgique occupe /nl/, avec la même arborescence.
 */
export const LANGUAGES = {
  fr: { prefix: '', hreflang: 'fr-BE', ogLocale: 'fr_BE', ogImage: 'assets/img/og-image.png' },
  nl: { prefix: 'nl/', hreflang: 'nl-BE', ogLocale: 'nl_BE', ogImage: 'assets/img/og-image-nl.png' },
};

export const DEFAULT_LANGUAGE = 'fr';

/**
 * Version néerlandaise publique : sélecteur de langue, hreflang, sitemap et 404 bilingues. Avec false,
 * les pages /nl/ seraient générées mais non découvrables : balise noindex, absentes du sitemap,
 * ni sélecteur de langue ni hreflang (mode utilisé pendant la mise en ligne progressive).
 */
export const NL_PUBLIC = true;

/** Langues découvrables (sélecteur, hreflang, sitemap). */
export const publicLanguages = (nlPublic = NL_PUBLIC) => (nlPublic ? ['fr', 'nl'] : ['fr']);

/**
 * Pages générées dans chaque langue : `path` est le dossier de la page (vide pour l'accueil),
 * `template` le gabarit dans src/pages/, `meta` l'espace de noms de ses textes de référencement
 * (title, description, ogTitle, ogDescription) et `vars` ses variables propres.
 */
export const PAGES = [
  { id: 'accueil', path: '', template: 'index.html', meta: 'meta.home', vars: { htmlClass: 'scroll-smooth' } },
  { id: 'abstrait', path: 'modules/abstrait/', template: 'modules/abstrait.html', meta: 'meta.abstrait', vars: { crumb: 'pages.abstrait' } },
  { id: 'verbal', path: 'modules/verbal/', template: 'modules/verbal.html', meta: 'meta.verbal', vars: { crumb: 'pages.verbal' } },
  {
    id: 'numerique',
    path: 'modules/numerique/',
    template: 'modules/numerique.html',
    meta: 'meta.numerique',
    vars: { crumb: 'pages.numerique', footerNote: 'site.footerNote.numerique' },
  },
  {
    id: 'jugement',
    path: 'modules/jugement/',
    template: 'modules/jugement.html',
    meta: 'meta.jugement',
    vars: { crumb: 'pages.jugement', footerNote: 'site.footerNote.jugement' },
  },
  { id: 'examen', path: 'modules/examen/', template: 'modules/examen.html', meta: 'meta.examen', vars: { crumb: 'pages.examen', staticHeader: true } },
  { id: 'progression', path: 'progression/', template: 'progression.html', meta: 'meta.progression', vars: { crumb: 'pages.progression', isProgressPage: true } },
];

/** Fichiers et dossiers copiés tels quels dans dist/ (les pages, le sitemap et robots.txt sont générés). */
export const STATIC_ENTRIES = ['assets', 'data'];
