"use client";

import { useSyncExternalStore } from "react";

import Rich from "@/components/ui/Rich";
import { dict } from "@/content/dictionaries";
import { milestones } from "@/content/data/edition2026";
import { clock } from "@/lib/browser-stores";
import type { Locale } from "@/lib/i18n";

const DAY = 86_400_000;

/** Index of the next milestone: the first one whose day has not yet ended. */
function currentIndex(now: number) {
  if (now === 0) return -1;
  for (let i = 0; i < milestones.length; i++) {
    const { date } = milestones[i];
    if (!date) return i; // undated means "still ahead"
    if (new Date(date).getTime() + DAY > now) return i;
  }
  return -1;
}

/**
 * Vertical on phones, a horizontal rail on wide screens. Square nodes; the
 * next milestone blinks orchid. Unconfirmed dates render as TBD chips.
 */
export default function Timeline({ locale }: { locale: Locale }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const current = currentIndex(now);

  return (
    <div>
      <ol className="relative grid gap-9 lg:grid-cols-4 lg:gap-6">
        {/* The rail. */}
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[5px] top-2 w-px bg-cyan-400/60 lg:bottom-auto lg:left-0 lg:right-0 lg:top-[5px] lg:h-px lg:w-auto"
        />
        {milestones.map((m, i) => {
          const isCurrent = i === current;
          return (
            <li key={m.id} className="relative pl-9 lg:pl-0 lg:pt-9" aria-current={isCurrent ? "step" : undefined}>
              <span
                aria-hidden="true"
                className={[
                  "absolute left-0 top-[0.3rem] block h-[11px] w-[11px] lg:top-0",
                  isCurrent
                    ? "animate-blink bg-orchid-400 shadow-[0_0_0_4px_var(--color-navy-900)]"
                    : "bg-cyan-400 shadow-[0_0_0_4px_var(--color-navy-900)]",
                ].join(" ")}
              />
              <div className="font-mono text-[1.0625rem] font-bold text-lavender-200">
                <Rich text={m.when[locale]} locale={locale} />
              </div>
              {isCurrent && <span className="label mt-1 block text-orchid-300">{dict.nowLabel[locale]}</span>}
              <h4 className="mt-2 font-display text-base font-bold leading-snug text-paper">{m.title[locale]}</h4>
              {m.items && (
                <ul className="mt-2.5 space-y-1">
                  {m.items.map((item) => (
                    <li key={item.en} className="text-sm text-mist-300">
                      {item[locale]}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <p className="label mt-10 !normal-case !tracking-normal text-mist-400">* {dict.timelineNote[locale]}</p>
    </div>
  );
}
