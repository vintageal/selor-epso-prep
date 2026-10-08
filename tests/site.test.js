/*
 * Pages du site, générées par scripts/build-site.js dans les deux langues (français à la racine,
 * néerlandais sous /nl/) : ressources, liens, référencement, bilinguisme et mise en ligne progressive.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { pageFile, pageUrl, renderSite } from '../scripts/build-site.js';
import { LANGUAGES, NL_PUBLIC, PAGES, SITE, STATIC_ENTRIES } from '../scripts/site/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const GENERATED_CSS = 'assets/css/app.css';
const LANGS = Object.keys(LANGUAGES);

/** Site rendu dans son état actuel, et dans les deux états de la mise en ligne progressive. */
const site = renderSite();
const prelaunch = renderSite({ nlPublic: false });
const launched = renderSite({ nlPublic: true });

/** Toutes les pages : { file, page, lang }. */
const pages = PAGES.flatMap((page) => LANGS.map((lang) => ({ file: pageFile(page, lang), page, lang })));
const meta = (html, attribute, name) => html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`))?.[1];
const hreflangs = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(([, lang, href]) => ({ lang, href }));

/** Mentions obligatoires de chaque langue (pied de page de chaque page, page 404). */
const INDEPENDENCE = { fr: /non affiliée au SPF BOSA/, nl: /niet verbonden aan de FOD BOSA/ };
const TRANSPARENCY = {
  fr: /Vos résultats restent sur cet appareil&nbsp;: rien n'est envoyé ni partagé\./,
  nl: /Je resultaten blijven op dit toestel: er wordt niets verzonden of gedeeld\./,
};

/** Un chemin publié existe-t-il : fichier généré, ou ressource copiée du dépôt (assets/, data/) ? */
const published = (path) => path in site || (STATIC_ENTRIES.some((entry) => path.startsWith(`${entry}/`)) && (path === GENERATED_CSS || existsSync(join(root, path))));

test('chaque page est générée dans les deux langues, avec la langue déclarée et sans balise non résolue', () => {
  for (const { file, lang } of pages) {
    assert.ok(site[file], `${file} non généré`);
    assert.match(site[file], new RegExp(`^<!doctype html>\\n<html lang="${lang}"`), `${file} : attribut lang`);
    assert.doesNotMatch(site[file], /\{\{|\}\}/, `${file} : balise de gabarit non résolue`);
  }
  assert.deepEqual(
    Object.keys(site).filter((file) => file.startsWith('nl/')).sort(),
    PAGES.map((page) => pageFile(page, 'nl')).sort(),
    'la version néerlandaise reprend exactement l’arborescence française sous /nl/',
  );
});

test('chaque page charge la feuille CSS générée, et plus aucun CDN', () => {
  for (const { file } of pages) {
    const expected = posix.relative(posix.dirname(file), GENERATED_CSS);
    assert.ok(site[file].includes(`<link rel="stylesheet" href="${expected}">`), `${file} : feuille CSS absente`);
    assert.doesNotMatch(site[file], /cdn\.jsdelivr|text\/tailwindcss/, `${file} : référence au CDN Tailwind`);
  }
});

test('le script build:css génère la feuille référencée par les pages, et npm start sert le site construit', () => {
  assert.match(pkg.scripts['build:css'], new RegExp(`-o ${GENERATED_CSS} --minify`));
  assert.match(pkg.scripts.start, /npm run build && .*dist/);
});

test('tous les liens et ressources locaux existent, en chemins relatifs (compatibles GitHub Pages)', () => {
  for (const state of [prelaunch, launched]) {
    for (const { file } of pages) {
      for (const [, url] of state[file].matchAll(/\b(?:href|src)="([^"]+)"/g)) {
        if (/^(https:|mailto:|#)/.test(url)) continue;
        assert.ok(!/^(\/|http:)/.test(url), `${file} : « ${url} » doit être un chemin relatif`);
        const target = posix.normalize(posix.join(posix.dirname(file), url.split('#')[0]));
        assert.ok(published(target), `${file} : « ${url} » introuvable`);
      }
    }
  }
});

test('les scripts chargent leurs données par des chemins relatifs, banque néerlandaise comprise', () => {
  for (const { file, lang } of pages) {
    for (const [, src] of site[file].matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const target = posix.normalize(posix.join(posix.dirname(file), src));
      assert.ok(target.startsWith('assets/js/'), `${file} (${lang}) : script ${src} hors de assets/js/`);
    }
  }
});

/* ----- Référencement ----- */

test('chaque page déclare son adresse canonique, sa locale et son image de partage', () => {
  for (const { file, page, lang } of pages) {
    const html = site[file];
    const url = pageUrl(page, lang);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${file} : canonical attendue ${url}`);
    assert.equal(meta(html, 'property', 'og:url'), url, `${file} : og:url`);
    for (const name of ['og:type', 'og:title', 'og:description']) assert.ok(meta(html, 'property', name), `${file} : ${name} manquant`);
    assert.equal(meta(html, 'property', 'og:locale'), LANGUAGES[lang].ogLocale, `${file} : og:locale`);
    assert.equal(meta(html, 'property', 'og:image'), `${SITE}/${LANGUAGES[lang].ogImage}`, `${file} : og:image`);
  }
});

test('les images de partage (française et néerlandaise) sont des PNG de 1200 × 630', () => {
  for (const lang of LANGS) {
    const png = readFileSync(join(root, LANGUAGES[lang].ogImage));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], LANGUAGES[lang].ogImage);
  }
});

test('robots.txt renvoie au sitemap', () => {
  assert.match(site['robots.txt'], new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

/* ----- Mise en ligne progressive de la version néerlandaise ----- */

test('avant activation, la version néerlandaise n’est pas découvrable', () => {
  const sitemapUrls = [...prelaunch['sitemap.xml'].matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.deepEqual(sitemapUrls.sort(), PAGES.map((page) => pageUrl(page, 'fr')).sort(), 'sitemap : pages françaises uniquement');
  assert.doesNotMatch(prelaunch['sitemap.xml'], /\/nl\/|hreflang/);
  for (const { file, lang } of pages) {
    const html = prelaunch[file];
    assert.doesNotMatch(html, /class="lang-switch/, `${file} : sélecteur de langue visible`);
    assert.deepEqual(hreflangs(html), [], `${file} : balises hreflang`);
    if (lang === 'fr') assert.doesNotMatch(html, /href="(?!https:\/\/(?!selor-epso-prep))[^"]*nl\//, `${file} : lien vers la version néerlandaise`);
    if (lang === 'nl') assert.match(html, /<meta name="robots" content="noindex">/, `${file} : noindex attendu`);
    else assert.doesNotMatch(html, /noindex/, `${file} : page française exclue de l’index`);
  }
  assert.doesNotMatch(prelaunch['404.html'], /lang="nl"|\/nl\//, 'page 404 : partie néerlandaise');
});

test('après activation, chaque page a son sélecteur FR | NL, ses hreflang et ses alternances dans le sitemap', () => {
  for (const { file, page, lang } of pages) {
    const html = launched[file];
    assert.doesNotMatch(html, /noindex/, `${file} : noindex`);
    assert.deepEqual(hreflangs(html), [
      { lang: 'fr-BE', href: pageUrl(page, 'fr') },
      { lang: 'nl-BE', href: pageUrl(page, 'nl') },
      { lang: 'x-default', href: pageUrl(page, 'fr') },
    ], `${file} : hreflang`);
    const other = lang === 'fr' ? 'nl' : 'fr';
    const link = html.match(/<span class="lang-switch"[^>]*>(?:(?!<\/nav>)[\s\S])*?<a href="([^"]+)" class="lang-switch__link" hreflang="([^"]+)"/);
    assert.ok(link, `${file} : sélecteur de langue absent`);
    assert.equal(link[2], LANGUAGES[other].hreflang, `${file} : langue du lien`);
    assert.equal(posix.normalize(posix.join(posix.dirname(file), link[1])), pageFile(page, other), `${file} : le sélecteur doit mener à la page équivalente`);
  }
  const entries = [...launched['sitemap.xml'].matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => entry);
  assert.equal(entries.length, PAGES.length * LANGS.length);
  for (const entry of entries) {
    for (const hreflang of ['fr-BE', 'nl-BE', 'x-default']) assert.match(entry, new RegExp(`hreflang="${hreflang}"`), entry);
  }
});

test('l’état publié suit le drapeau NL_PUBLIC', () => {
  assert.deepEqual(site, NL_PUBLIC ? launched : prelaunch);
});

test('aucune redirection automatique selon la langue du navigateur', () => {
  const walk = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`${dir}/${entry.name}`] : [],
    );
  for (const path of walk('assets/js')) assert.doesNotMatch(readFileSync(join(root, path), 'utf8'), /navigator\.languages?\b/, path);
  for (const [file, html] of Object.entries(site)) assert.doesNotMatch(html, /http-equiv="refresh"|navigator\.language/, file);
});

/* ----- Page 404 bilingue ----- */

test('la page 404 est bilingue, exclue de l’index, et ses liens absolus visent des pages existantes', () => {
  const html = launched['404.html'];
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<section[^>]*lang="nl"/, 'partie néerlandaise absente');
  for (const lang of LANGS) {
    assert.match(html, INDEPENDENCE[lang], `mention d’indépendance (${lang})`);
    assert.match(html, TRANSPARENCY[lang], `phrase de transparence (${lang})`);
  }
  const urls = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(([, url]) => url).filter((url) => !url.startsWith('#'));
  assert.ok(urls.includes(`${SITE}/`) && urls.includes(`${SITE}/nl/`), 'liens vers les deux pages d’accueil');
  for (const url of urls) {
    assert.ok(url.startsWith(`${SITE}/`), `404.html : « ${url} » doit viser ${SITE} (page servie à toute profondeur)`);
    const path = url.slice(SITE.length + 1).split('#')[0];
    assert.ok(published(path === '' || path.endsWith('/') ? `${path}index.html` : path), `404.html : « ${url} » introuvable`);
  }
});

/* ----- Mentions et navigation ----- */

test('aucune page ne pointe vers l’ancienne adresse github.io', () => {
  for (const [file, content] of Object.entries(launched)) assert.doesNotMatch(content, /github\.io|\/selor-epso-prep\//, `${file} : ancienne adresse`);
});

test('chaque page porte la mention d’indépendance et la phrase de transparence dans sa langue', () => {
  for (const { file, lang } of pages) {
    assert.match(site[file], INDEPENDENCE[lang], `${file} : mention d’indépendance absente`);
    assert.match(site[file], TRANSPARENCY[lang], `${file} : phrase de transparence absente`);
  }
});

test('la page « Ma progression » est accessible depuis le menu principal et chaque module, dans chaque langue', () => {
  for (const lang of LANGS) {
    const home = site[`${LANGUAGES[lang].prefix}index.html`];
    assert.match(home, /<nav aria-label="[^"]+" class="hidden md:block">[\s\S]*?href="progression\/index\.html"/, `${lang} : menu principal`);
    assert.match(home, /<nav id="menu-mobile"[\s\S]*?href="progression\/index\.html"/, `${lang} : menu mobile`);
  }
  for (const { file } of pages.filter(({ page }) => page.path.startsWith('modules/'))) {
    assert.match(site[file], /<header[\s\S]*?href="\.\.\/\.\.\/progression\/index\.html"[\s\S]*?<\/header>/, `${file} : lien absent de l’en-tête`);
  }
});

test('un seul module accède au stockage du navigateur', () => {
  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith('.js')) sources.push(path);
    }
  };
  walk('assets/js');
  const users = sources.filter((path) => /localStorage|sessionStorage|indexedDB/.test(readFileSync(join(root, path), 'utf8')));
  assert.deepEqual(users, ['assets/js/progression/store.js']);
});
