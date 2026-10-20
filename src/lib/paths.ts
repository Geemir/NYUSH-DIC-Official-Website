/**
 * The site can be served from a sub-path (GitHub Pages serves it at
 * /NYUSH-DIC-Official-Website/). `next/link` adds that prefix on its own;
 * everything else — <img>, <picture>, plain <a>, metadata URLs — must go
 * through `asset()`.
 *
 * Both values are injected at build time by the deploy workflow and are
 * empty in local development.
 */

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Absolute site URL including the base path, without a trailing slash. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://geemir.github.io/NYUSH-DIC-Official-Website"
).replace(/\/$/, "");

/** Prefix a path under /public with the base path. */
export function asset(path: string): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL for a path under /public — for Open Graph and canonical tags. */
export function absolute(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
