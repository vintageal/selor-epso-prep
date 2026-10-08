/*
 * Assemble le site publiable dans dist/ (déployé sur GitHub Pages).
 *
 * Les pages ne sont pas écrites à la main dans chaque langue : elles sont générées à partir
 * de gabarits communs (src/pages/, src/partials/) et de dictionnaires de textes
 * (src/i18n/fr.json, src/i18n/nl.json). Le français occupe la racine du site, le néerlandais /nl/.
 * Sont aussi générés : la page 404 bilingue, sitemap.xml et robots.txt.
 * Les ressources (assets/, data/) sont copiées telles quelles et partagées par les deux langues.
 *
 * Usage :
 *   node scripts/build-site.js           construit dist/
 *   node scripts/build-site.js --watch   reconstruit dist/ à chaque modification (développement)
 * Prérequis : la feuille CSS doit avoir été générée (npm run build:css ; `npm run build` le fait).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LANGUAGE, LANGUAGES, NL_PUBLIC, PAGES, SITE, STATIC_ENTRIES, publicLanguages } from './site/config.js';
import { createRenderer } from './site/templates.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

export const readDictionaries = () =>
  Object.fromEntries(Object.keys(LANGUAGES).map((lang) => [lang, JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8'))]));

/** Adresse publique d'une page dans une langue : https://selor-epso-prep.eu/nl/modules/verbal/ */
export const pageUrl = (page, lang) => `${SITE}/${LANGUAGES[lang].prefix}${page.path}`;

/** Chemin du fichier généré : « nl/modules/verbal/index.html ». */
export const pageFile = (page, lang) => `${LANGUAGES[lang].prefix}${page.path}index.html`;

/** Chemin relatif d'un fichier généré vers la racine du site (« ../../ »). */
const upTo = (file) => '../'.repeat(file.split('/').length - 1);

/** Variables d'une page dans une langue (`nlPublic` : version néerlandaise découvrable ou non). */
function pageVars(page, lang, nlPublic) {
  const file = pageFile(page, lang);
  const root = upTo(file); // ressources partagées (assets/, data/)
  const home = upTo(`${page.path}index.html`); // pages de la même langue (même arborescence en FR et en NL)
  const isPublic = publicLanguages(nlPublic).includes(lang);
  const otherLang = lang === 'fr' ? 'nl' : 'fr';
  const alternates = nlPublic
    ? [
        ...Object.keys(LANGUAGES).map((code) => `<link rel="alternate" hreflang="${LANGUAGES[code].hreflang}" href="${pageUrl(page, code)}">`),
        `<link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LANGUAGE)}">`,
      ].join('\n  ')
    : '';
  return {
    lang,
    ogLocale: LANGUAGES[lang].ogLocale,
    ogLocaleAlternate: LANGUAGES[otherLang].ogLocale,
    root,
    home,
    url: pageUrl(page, lang),
    ogImage: `${SITE}/${LANGUAGES[lang].ogImage}`,
    metaTitle: `${page.meta}.title`,
    metaDescription: `${page.meta}.description`,
    metaOgTitle: `${page.meta}.ogTitle`,
    metaOgDescription: `${page.meta}.ogDescription`,
    noindex: !isPublic,
    alternates,
    hasAlternates: Boolean(alternates),
    // Sélecteur de langue : lien vers la page équivalente dans l'autre langue
    switcher: nlPublic,
    otherLang,
    otherLangHref: `${root}${LANGUAGES[otherLang].prefix}${page.path}index.html`,
    isFr: lang === 'fr',
    isNl: lang === 'nl',
    ...page.vars,
  };
}

function sitemap(nlPublic) {
  const languages = publicLanguages(nlPublic);
  const entries = PAGES.flatMap((page) =>
    languages.map((lang) => {
      const links = nlPublic
        ? [
            ...Object.keys(LANGUAGES).map((code) => `    <xhtml:link rel="alternate" hreflang="${LANGUAGES[code].hreflang}" href="${pageUrl(page, code)}"/>`),
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LANGUAGE)}"/>`,
          ]
        : [];
      return [`  <url>`, `    <loc>${pageUrl(page, lang)}</loc>`, ...links, `  </url>`].join('\n');
    }),
  );
  const namespaces = nlPublic ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${namespaces}>\n${entries.join('\n')}\n</urlset>\n`;
}

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

/**
 * Rend tout le site en mémoire : { 'index.html': '…', 'nl/index.html': '…', 'sitemap.xml': '…', … }.
 * Utilisé par la construction et par les tests ; `nlPublic` permet aux tests de rendre le site
 * avant et après l'activation de la version néerlandaise (par défaut : NL_PUBLIC).
 */
export function renderSite({ nlPublic = NL_PUBLIC } = {}) {
  const dictionaries = readDictionaries();
  const renderer = createRenderer({ pagesDir: join(root, 'src/pages'), partialsDir: join(root, 'src/partials'), dictionaries });
  const files = {};
  for (const page of PAGES) {
    for (const lang of Object.keys(LANGUAGES)) files[pageFile(page, lang)] = renderer.render(page.template, pageVars(page, lang, nlPublic));
  }
  files['404.html'] = renderer.render('404.html', { lang: DEFAULT_LANGUAGE, site: SITE, nlPublic });
  files['sitemap.xml'] = sitemap(nlPublic);
  files['robots.txt'] = robots();
  return files;
}

export function build() {
  if (!existsSync(join(root, 'assets/css/app.css'))) {
    throw new Error('assets/css/app.css est introuvable : lancez d\'abord « npm run build:css ».');
  }
  const files = renderSite();
  rmSync(output, { recursive: true, force: true });
  for (const entry of STATIC_ENTRIES) cpSync(join(root, entry), join(output, entry), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    writeFileSync(join(output, path), content);
  }
  return Object.keys(files);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const run = () => {
    try {
      const files = build();
      console.log(`Site prêt dans dist/ : ${files.length} fichiers générés (${Object.keys(LANGUAGES).join(', ')}), plus ${STATIC_ENTRIES.join(', ')}.`);
    } catch (error) {
      console.error(error.message);
      if (!process.argv.includes('--watch')) process.exit(1);
    }
  };
  run();
  if (process.argv.includes('--watch')) {
    let timer;
    for (const folder of ['src', 'assets', 'data']) {
      watch(join(root, folder), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(run, 150);
      });
    }
    console.log('Surveillance de src/, assets/ et data/ : dist/ est reconstruit à chaque modification.');
  }
}
