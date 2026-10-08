/*
 * Assemble le site publiable dans dist/ (déployé sur GitHub Pages) :
 * uniquement les fichiers servis au navigateur, sans sources CSS, tests ni dépendances.
 * Prérequis : la feuille CSS doit avoir été générée (npm run build:css ; `npm run build` le fait).
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const PUBLIC_ENTRIES = ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'modules', 'assets', 'data'];

if (!existsSync(join(root, 'assets/css/app.css'))) {
  console.error('assets/css/app.css est introuvable : lancez d\'abord « npm run build:css ».');
  process.exit(1);
}

rmSync(output, { recursive: true, force: true });
for (const entry of PUBLIC_ENTRIES) {
  cpSync(join(root, entry), join(output, entry), { recursive: true });
}
console.log(`Site prêt dans dist/ (${PUBLIC_ENTRIES.join(', ')}).`);
