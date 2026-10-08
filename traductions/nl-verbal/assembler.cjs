// Brouillon (étape NL 3). Usage : node traductions/nl-verbal/assembler.cjs <sortie.json>
// Construit la banque verbale néerlandaise : structure (ids, réponses, difficulté) reprise du français,
// citations recalculées à partir de la position des phrases citées dans le texte français.
const fs = require('fs');
const dir = `${__dirname}/`;
const out = process.argv[2];
const fr = require('../../data/verbal.json');
const tr = Object.assign({}, ...fs.readdirSync(dir).filter((f) => /^v\d+\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(dir + f, 'utf8'))));
const split = (p) => p.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«])/);
const errors = [];
const passages = fr.passages.map((p) => {
  const t = tr[p.id];
  if (!t) { errors.push(`texte manquant : ${p.id}`); return p; }
  const frSents = p.paragraphs.map(split);
  frSents.forEach((s, i) => { if (s.length !== t.paragraphs[i]?.length) errors.push(`${p.id} : paragraphe ${i} : ${s.length} phrases FR, ${t.paragraphs[i]?.length} NL`); });
  const mapQuote = (q) => {
    for (let i = 0; i < frSents.length; i += 1)
      for (let a = 0; a < frSents[i].length; a += 1)
        for (let b = a; b < frSents[i].length; b += 1)
          if (frSents[i].slice(a, b + 1).join(' ') === q) return t.paragraphs[i].slice(a, b + 1).join(' ');
    errors.push(`${p.id} : citation introuvable « ${q.slice(0, 40)} »`);
    return q;
  };
  const statements = p.statements.map((s) => {
    const u = t.statements[s.id];
    if (!u) { errors.push(`affirmation manquante : ${s.id}`); return s; }
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'text' || k === 'explanation' ? u[k] : k === 'quotes' ? v.map(mapQuote) : v]));
  });
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === 'title' || k === 'theme' ? t[k] : k === 'paragraphs' ? t.paragraphs.map((s) => s.join(' ')) : k === 'statements' ? statements : v]));
});
const extra = Object.keys(tr).filter((id) => !fr.passages.some((p) => p.id === id));
if (extra.length) errors.push(`textes en trop : ${extra}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
// Même mise en forme que la banque française (tableaux de citations sur plusieurs lignes).
const json = JSON.stringify({ ...fr, passages }, null, 2).replace(/\[\n\s+("(?:[^"\\]|\\.)*")\n\s+\]/g, '[$1]');
fs.writeFileSync(out, `${json}\n`);
console.log(`ok : ${passages.length} textes, ${passages.reduce((n, p) => n + p.statements.length, 0)} affirmations`);
