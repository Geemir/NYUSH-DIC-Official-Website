"use client";

/**
 * External stores for browser state that React should subscribe to rather than
 * mirror into state inside an effect. Both expose the `useSyncExternalStore`
 * shape: a server snapshot for the prerendered HTML, and a live snapshot after
 * hydration — which keeps clock- and scroll-driven UI free of hydration
 * mismatches without a synchronous setState in an effect.
 */

/* --- a shared one-second clock --------------------------------------- */

const listeners = new Set<() => void>();
let timer: number | undefined;

/* Cached so repeated getSnapshot calls in one render return the same value. */
let now = 0;

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
}

export const clock = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (timer === undefined) {
      now = Date.now();
      timer = window.setInterval(tick, 1000);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
  },
  getSnapshot: () => now,
  /* 0 means "not running in a browser yet" — callers render a placeholder. */
  getServerSnapshot: () => 0,
};

/* --- "has the page scrolled past the header?" ------------------------- */

const SCROLLED_AT = 24;

export const pageScrolled = {
  subscribe(listener: () => void) {
    window.addEventListener("scroll", listener, { passive: true });
    return () => window.removeEventListener("scroll", listener);
  },
  /* A boolean compares by value, so this needs no caching. */
  getSnapshot: () => window.scrollY > SCROLLED_AT,
  getServerSnapshot: () => false,
};
