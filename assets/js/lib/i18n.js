/*
 * Textes de l'interface en français et en néerlandais (assets/js/i18n/fr.js et nl.js).
 *
 * La langue est celle de la page (<html lang="fr"> ou <html lang="nl">), générée par scripts/build-site.js.
 * Sous Node (tests), la langue par défaut est le français ; setLocale permet de tester le néerlandais.
 * Les deux dictionnaires ont exactement les mêmes clés (un test le vérifie).
 */
import fr from '../i18n/fr.js';
import nl from '../i18n/nl.js';
import { dutchTypography, frenchTypography } from './typography.js';

export const MESSAGES = { fr, nl };
export const LOCALES = Object.keys(MESSAGES);

const detect = () => (globalThis.document?.documentElement?.lang === 'nl' ? 'nl' : 'fr');
let current = detect();

export const getLocale = () => current;

export function setLocale(locale) {
  if (!MESSAGES[locale]) throw new Error(`Langue « ${locale} » inconnue.`);
  current = locale;
}

/** Locale des formats de nombres et de dates : fr-BE ou nl-BE. */
export const intlLocale = () => (current === 'nl' ? 'nl-BE' : 'fr-BE');

export const lookup = (messages, key) => key.split('.').reduce((node, part) => node?.[part], messages);

/**
 * Texte de la langue courante. Les paramètres remplacent les marques {nom} ;
 * une entrée peut aussi être une fonction (accords et pluriels), appelée avec les paramètres.
 */
export function t(key, params = {}) {
  const value = lookup(MESSAGES[current], key);
  if (value === undefined) throw new Error(`Texte « ${key} » absent du dictionnaire ${current}.`);
  if (typeof value === 'function') return value(params);
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Typographie de la langue courante (espaces insécables en français). */
export const typography = (text) => (current === 'nl' ? dutchTypography(text) : frenchTypography(text));

/**
 * Banques de questions traduites. Tant qu'une banque n'est pas traduite, la version néerlandaise
 * du site utilise la banque française (la version NL n'est pas encore publique).
 */
export const TRANSLATED_BANKS = { fr: ['verbal', 'numerique', 'jugement'], nl: ['jugement', 'verbal'] };

/** Adresse de la banque `name` (verbal, numerique, jugement) dans la langue de la page. */
export const bankUrl = (name, locale = current) =>
  new URL(`../../../data/${locale !== 'fr' && TRANSLATED_BANKS[locale].includes(name) ? `${locale}/` : ''}${name}.json`, import.meta.url);
