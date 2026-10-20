import Link from "next/link";

import PixelIcon from "@/components/ui/PixelIcon";
import Window from "@/components/ui/Window";
import { dict } from "@/content/dictionaries";
import type { Track2026 } from "@/content/data/edition2026";
import { href, type Locale } from "@/lib/i18n";

const other = (l: Locale): Locale => (l === "en" ? "zh" : "en");

function TrackTitle({ track, locale, level }: { track: Track2026; locale: Locale; level: "h3" | "h2" }) {
  const H = level;
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center border border-navy-600 bg-navy-900">
        <PixelIcon name={track.icon} className="h-9 w-9" />
      </span>
      <div className="min-w-0">
        <span className="label text-cyan-400">
          {dict.trackLabel[locale]} {track.num}
        </span>
        <H className="mt-0.5 text-xl font-bold leading-snug text-paper sm:text-[1.375rem]">
          {track.name[locale]}
        </H>
        <span lang={other(locale) === "zh" ? "zh-Hans" : "en"} className="block text-sm text-lavender-200">
          {track.name[other(locale)]}
        </span>
      </div>
    </div>
  );
}

/** Compact track window for the home page: name, mission, link to the brief. */
export function TrackCard({ track, locale }: { track: Track2026; locale: Locale }) {
  return (
    <Window title={`tracks/${track.num}_${track.slug}`} as="article" className="h-full" bodyClassName="flex flex-col p-5 sm:p-6">
      <TrackTitle track={track} locale={locale} level="h3" />
      <p className="mt-5 flex-1 border-l-2 border-cyan-400 pl-4 text-[0.9375rem] font-semibold text-lavender-200">
        {track.mission[locale]}
      </p>
      <Link
        href={href(`/challenge#${track.id}`, locale)}
        className="label mt-6 inline-flex items-center gap-2 self-start text-cyan-400 transition-colors hover:text-cyan-300"
      >
        {dict.readTrack[locale]}
        <span aria-hidden="true">→</span>
      </Link>
    </Window>
  );
}

/** Full track brief for the Challenge page. */
export default function TrackWindow({ track, locale }: { track: Track2026; locale: Locale }) {
  return (
    <Window
      id={track.id}
      title={`tracks/${track.num}_${track.slug}`}
      as="article"
      className="scroll-mt-24"
      bodyClassName="p-5 sm:p-7"
    >
      <TrackTitle track={track} locale={locale} level="h3" />

      <p className="mt-6 border-l-2 border-cyan-400 pl-4 text-base font-semibold text-lavender-200 sm:text-[1.0625rem]">
        {track.mission[locale]}
      </p>
      <p className="mt-5 text-[0.9375rem] text-paper sm:text-base">{track.body[locale]}</p>

      {/* Native disclosure: works without JS, keyboard and screen reader friendly. */}
      <details className="group/ex mt-6 border-t-2 border-orchid-400 bg-navy-700">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="label block text-orchid-300">{dict.exampleLabel[locale]}</span>
            <span className="mt-0.5 block font-display text-[0.9375rem] font-bold text-paper">
              {track.example.title}
            </span>
          </span>
          <span aria-hidden="true" className="font-mono text-lg text-orchid-300 transition-transform group-open/ex:rotate-45">
            +
          </span>
        </summary>
        <p className="px-4 pb-4 text-sm text-mist-300">{track.example.body[locale]}</p>
      </details>
    </Window>
  );
}
