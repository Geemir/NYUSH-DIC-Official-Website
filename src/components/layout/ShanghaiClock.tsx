"use client";

import { useSyncExternalStore } from "react";

import { dict } from "@/content/dictionaries";
import { clock } from "@/lib/browser-stores";
import type { Locale } from "@/lib/i18n";

const format = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * The menu-bar clock, always in China Standard Time — every DIC deadline is
 * in Shanghai time, and many entrants are not.
 */
export default function ShanghaiClock({ locale }: { locale: Locale }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const [hh, mm] = now === 0 ? ["--", "--"] : format.format(now).split(":");

  return (
    <span
      className="label inline-flex items-center gap-1.5 text-mist-300"
      title={dict.shanghaiTime[locale]}
    >
      <span className="text-cyan-400">SHA</span>
      <span className="tabular-nums text-paper">
        {hh}
        <span aria-hidden="true" className="animate-blink">:</span>
        <span className="sr-only">:</span>
        {mm}
      </span>
    </span>
  );
}
