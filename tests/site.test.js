import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const GENERATED_CSS = 'assets/css/app.css';
const SITE = 'https://selor-epso-prep.eu';
const pages = ['index.html', ...readdirSync(join(root, 'modules')).map((name) => `modules/${name}/index.html`)];
const read = (page) => readFileSync(join(root, page), 'utf8');
/** Adresse publique d'une page : https://selor-epso-prep.eu/ ou https://selor-epso-prep.eu/modules/<nom>/ */
const publicUrl = (page) => `${SITE}/${page.replace(/index\.html$/, '')}`;
const meta = (html, attribute, name) => html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`))?.[1];

test('chaque page charge la feuille CSS générée, et plus aucun CDN', () => {
  for (const page of pages) {
    const html = read(page);
    const expected = relative(dirname(join(root, page)), join(root, GENERATED_CSS)).split('\\').join('/');
    assert.ok(html.includes(`<link rel="stylesheet" href="${expected}">`), `${page} : feuille CSS absente`);
    assert.doesNotMatch(html, /cdn\.jsdelivr|text\/tailwindcss/, `${page} : référence au CDN Tailwind`);
  }
});

test('le script build:css génère la feuille référencée par les pages', () => {
  assert.match(pkg.scripts['build:css'], new RegExp(`-o ${GENERATED_CSS} --minify`));
});

test('tous les liens et ressources locaux existent, en chemins relatifs (compatibles GitHub Pages)', () => {
  for (const page of pages) {
    for (const [, url] of read(page).matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(https:|mailto:|#)/.test(url)) continue;
      assert.ok(!/^(\/|http:)/.test(url), `${page} : « ${url} » doit être un chemin relatif`);
      const target = relative(root, join(root, dirname(page), url.split('#')[0])).split('\\').join('/');
      if (target === GENERATED_CSS) continue; // produit par npm run build:css
      assert.ok(existsSync(join(root, target)), `${page} : « ${url} » introuvable`);
    }
  }
});

test('le site publié contient toutes les ressources nécessaires aux pages', () => {
  const buildScript = read('scripts/build-site.js');
  for (const entry of ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'modules', 'assets', 'data']) {
    assert.match(buildScript, new RegExp(`'${entry}'`), `${entry} absent de scripts/build-site.js`);
  }
});

/* ----- Référencement et domaine https://selor-epso-prep.eu ----- */

test('chaque page déclare son adresse canonique et ses balises Open Graph sur le domaine', () => {
  for (const page of pages) {
    const html = read(page);
    const url = publicUrl(page);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${page} : canonical attendue ${url}`);
    assert.equal(meta(html, 'property', 'og:url'), url, `${page} : og:url`);
    for (const name of ['og:type', 'og:title', 'og:description']) assert.ok(meta(html, 'property', name), `${page} : ${name} manquant`);
    assert.equal(meta(html, 'property', 'og:locale'), 'fr_BE', `${page} : og:locale`);
    const image = meta(html, 'property', 'og:image');
    assert.ok(image?.startsWith(`${SITE}/`), `${page} : og:image doit être une adresse absolue sur ${SITE}`);
    assert.ok(existsSync(join(root, image.slice(SITE.length + 1))), `${page} : ${image} introuvable dans le dépôt`);
  }
});

test('l’image de partage est un PNG de 1200 × 630', () => {
  const png = readFileSync(join(root, 'assets/img/og-image.png'));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

test('le sitemap liste exactement les pages du site, et robots.txt y renvoie', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.deepEqual(urls.sort(), pages.map(publicUrl).sort());
  assert.match(read('robots.txt'), new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

test('la page 404 est exclue de l’index et ses liens absolus visent des fichiers existants', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /non affiliée au SPF BOSA/);
  const urls = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(([, url]) => url).filter((url) => !url.startsWith('#'));
  assert.ok(urls.includes(`${SITE}/`), 'lien vers l’accueil absent');
  for (const url of urls) {
    assert.ok(url.startsWith(`${SITE}/`), `404.html : « ${url} » doit viser ${SITE} (page servie à toute profondeur)`);
    const path = url.slice(SITE.length + 1).split('#')[0];
    if (path === GENERATED_CSS) continue; // produit par npm run build:css
    assert.ok(existsSync(join(root, path || 'index.html', path.endsWith('/') ? 'index.html' : '')), `404.html : « ${url} » introuvable`);
  }
});

test('aucune page ne pointe vers l’ancienne adresse github.io, et la mention de non-affiliation est partout', () => {
  for (const page of [...pages, '404.html', 'robots.txt', 'sitemap.xml']) {
    assert.doesNotMatch(read(page), /github\.io|\/selor-epso-prep\//, `${page} : ancienne adresse`);
  }
  for (const page of pages) assert.match(read(page), /non affiliée au SPF BOSA/, `${page} : mention de non-affiliation absente`);
});
