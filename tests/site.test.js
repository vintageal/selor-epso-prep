import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const GENERATED_CSS = 'assets/css/app.css';
const pages = ['index.html', ...readdirSync(join(root, 'modules')).map((name) => `modules/${name}/index.html`)];
const read = (page) => readFileSync(join(root, page), 'utf8');

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
  for (const entry of ['index.html', 'modules', 'assets', 'data']) {
    assert.match(buildScript, new RegExp(`'${entry}'`), `${entry} absent de scripts/build-site.js`);
  }
});
