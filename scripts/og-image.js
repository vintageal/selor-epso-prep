/*
 * Génère les images de partage (Open Graph, 1200 × 630 px) de chaque langue :
 * assets/img/og-image.png (français) et assets/img/og-image-nl.png (néerlandais),
 * à partir du gabarit src/og-image.html et des dictionnaires src/i18n/<langue>.json.
 *
 * Usage : node scripts/og-image.js
 *
 * La capture utilise Playwright, qui n'est pas une dépendance du projet : il doit être
 * disponible sur la machine (par exemple installé globalement : NODE_PATH="$(npm root -g)" node scripts/og-image.js).
 * Sans Playwright, le script écrit seulement les pages HTML à capturer et indique leur emplacement.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readDictionaries } from './build-site.js';
import { LANGUAGES } from './site/config.js';
import { createRenderer } from './site/templates.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const renderer = createRenderer({ pagesDir: join(root, 'src'), partialsDir: join(root, 'src/partials'), dictionaries: readDictionaries() });
const folder = mkdtempSync(join(tmpdir(), 'og-image-'));

const pages = Object.entries(LANGUAGES).map(([lang, { ogImage }]) => {
  const source = join(folder, `og-image-${lang}.html`);
  writeFileSync(source, renderer.render('og-image.html', { lang }));
  return { source, target: join(root, ogImage) };
});

let chromium;
try {
  // require (et non import) : il tient compte de NODE_PATH, donc d'une installation globale.
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.log(`Playwright est introuvable : capturez vous-même ces pages à 1200 × 630 px.\n${pages.map(({ source, target }) => `  ${source} → ${target}`).join('\n')}`);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const { source, target } of pages) {
  await page.goto(pathToFileURL(source).href);
  await page.screenshot({ path: target });
  console.log(`Image écrite : ${target}`);
}
await browser.close();
