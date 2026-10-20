"use client";

import { useSyncExternalStore } from "react";

import { dict } from "@/content/dictionaries";
import { clock } from "@/lib/browser-stores";
import type { Locale } from "@/lib/i18n";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** A mono readout: `T−19d 04:12:33█  until Kick-off · Nov 9`. */
export default function Countdown({ target, locale }: { target: string; locale: Locale }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const diff = new Date(target).getTime() - now;

  let readout: React.ReactNode;
  let caption: string;

  if (now === 0) {
    /* Server snapshot: hold the line so layout does not jump on hydration. */
    readout = <span className="text-mist-400">T−--d --:--:--</span>;
    caption = dict.countdownTo[locale];
  } else if (diff > 0) {
    readout = (
      <>
        <span className="text-mist-400">T−</span>
        {Math.floor(diff / DAY)}
        <span className="text-mist-400">d</span> {pad(Math.floor(diff / 3_600_000) % 24)}:
        {pad(Math.floor(diff / 60_000) % 60)}:{pad(Math.floor(diff / 1000) % 60)}
      </>
    );
    caption = dict.countdownTo[locale];
  } else if (diff > -DAY) {
    readout = <span className="text-orchid-300">T−0</span>;
    caption = dict.countdownToday[locale];
  } else {
    readout = <span className="text-cyan-400">RUNNING</span>;
    caption = dict.countdownPast[locale];
  }

  return (
    <div className="inline-flex flex-col border border-navy-600 bg-navy-950/70 px-4 py-3">
      <span className="label text-mist-400">countdown.log</span>
      <span className="mt-1.5 flex items-center font-mono text-[1.6rem] font-bold leading-none tabular-nums text-paper sm:text-3xl">
        <span aria-live="off">{readout}</span>
        <span aria-hidden="true" className="ml-1.5 inline-block h-[0.85em] w-[0.5em] animate-blink bg-cyan-400" />
      </span>
      <span className="label mt-2 text-cyan-400">{caption}</span>
    </div>
  );
}
