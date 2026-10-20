/**
 * Locale plumbing for the bilingual site.
 *
 * Routes are `/[locale]/...` with `generateStaticParams` — the built-in
 * `i18n` config in next.config is Pages-router only and is unsupported by
 * `output: "export"`, so the locale lives in the URL as a real segment.
 */

export const locales = ["en", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** A string that exists in both languages. The shape all content files use. */
export type Localized = Record<Locale, string>;

/** Optional per-locale string — falls back to the other language when absent. */
export type LocalizedRich = Record<Locale, string[]>;

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

/** `lang` attribute value — `zh-Hans` tells browsers to use simplified forms. */
export const htmlLang: Record<Locale, string> = {
  en: "en",
  zh: "zh-Hans",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Pick the right side of a `Localized` value. */
export function t(value: Localized, locale: Locale): string {
  return value[locale] || value[defaultLocale];
}

/** Build an internal href for a locale, e.g. `href("/challenge", "zh")`. */
export function href(path: string, locale: Locale): string {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  return `/${locale}${clean}` || `/${locale}`;
}
