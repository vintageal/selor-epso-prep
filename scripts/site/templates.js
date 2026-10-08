/*
 * Moteur de gabarits minimal (sans dépendance) pour générer les pages dans chaque langue.
 *
 * Syntaxe, dans src/pages/ et src/partials/ :
 *   {{> nom}}                 insère le fragment src/partials/nom.html
 *   {{#if variable}}…{{else}}…{{/if}}   bloc conditionnel (imbrication possible)
 *   {{t:cle.sous-cle}}        texte du dictionnaire de la langue de la page (src/i18n/<langue>.json)
 *   {{t.nl:cle}}              texte d'une langue précise (page 404 bilingue)
 *   {{t:$variable}}           texte dont la clé est donnée par une variable de la page
 *   {{variable}}              variable de la page (chemins, adresses, langue…)
 *
 * Les textes des dictionnaires sont insérés tels quels : ils peuvent contenir du HTML
 * (balises <strong>, entités &amp;, &nbsp;…) et viennent uniquement du dépôt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Valeur d'une clé « a.b.c » dans un dictionnaire, ou undefined. */
export const lookup = (dictionary, key) => key.split('.').reduce((node, part) => node?.[part], dictionary);

/**
 * Crée un moteur lié aux dossiers des gabarits et aux dictionnaires.
 * `dictionaries` : { fr: {...}, nl: {...} }.
 */
export function createRenderer({ pagesDir, partialsDir, dictionaries }) {
  const cache = new Map();
  const read = (path) => {
    if (!cache.has(path)) cache.set(path, readFileSync(path, 'utf8'));
    return cache.get(path);
  };

  const translate = (lang, key, where) => {
    const value = lookup(dictionaries[lang], key);
    if (typeof value !== 'string') throw new Error(`${where} : texte « ${key} » absent du dictionnaire ${lang}.`);
    return value;
  };

  const expand = (source, vars, where, depth = 0) => {
    if (depth > 10) throw new Error(`${where} : inclusions trop profondes.`);
    // 1. Fragments
    let text = source.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => expand(read(join(partialsDir, `${name}.html`)), vars, `${where} > ${name}`, depth + 1));
    // 2. Conditions, de l'intérieur vers l'extérieur
    const condition = /\{\{#if (\w+)\}\}((?:(?!\{\{#if )[\s\S])*?)\{\{\/if\}\}/;
    for (let match = condition.exec(text); match; match = condition.exec(text)) {
      const [whole, name, body] = match;
      const [ifTrue, ifFalse = ''] = body.split('{{else}}');
      text = text.replace(whole, () => (vars[name] ? ifTrue : ifFalse));
    }
    // 3. Textes traduits
    text = text.replace(/\{\{t(?:\.(\w+))?:(\$?[\w.-]+)\}\}/g, (_, lang, key) => {
      const resolved = key.startsWith('$') ? vars[key.slice(1)] : key;
      if (typeof resolved !== 'string') throw new Error(`${where} : variable « ${key} » sans clé de texte.`);
      return translate(lang ?? vars.lang, resolved, where);
    });
    // 4. Variables
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      if (vars[name] === undefined || vars[name] === null) throw new Error(`${where} : variable « ${name} » non définie.`);
      return String(vars[name]);
    });
  };

  return {
    translate,
    /** Rend un gabarit de src/pages/ avec les variables de la page ; refuse toute balise non résolue. */
    render(template, vars) {
      const html = expand(read(join(pagesDir, template)), vars, template);
      const leftover = html.match(/\{\{[^}]*\}\}/);
      if (leftover) throw new Error(`${template} (${vars.lang}) : balise non résolue ${leftover[0]}.`);
      return html;
    },
  };
}
