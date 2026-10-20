import Link from "next/link";

import Countdown from "@/components/edition/Countdown";
import Phases from "@/components/edition/Phases";
import RegisterPanel from "@/components/edition/RegisterPanel";
import ThemeBlock from "@/components/edition/ThemeBlock";
import Timeline from "@/components/edition/Timeline";
import TrackWindow from "@/components/edition/TrackWindow";
import PixelIcon from "@/components/ui/PixelIcon";
import SectionHeader, { StatusChip } from "@/components/ui/SectionHeader";
import { dict } from "@/content/dictionaries";
import { theme, tracks2026 } from "@/content/data/edition2026";
import { currentEdition } from "@/content/site";
import { href, isLocale, type Locale } from "@/lib/i18n";

const copy = {
  title: { en: "The Challenge", zh: "数字创新挑战赛" },
  description: {
    en: "DIC 2026 — OPC: Redefining the Individual Business. Four tracks, two stages, kick-off on Nov 9.",
    zh: "DIC 2026 —— OPC: Redefining the Individual Business。四条赛道、两个阶段，11 月 9 日开幕。",
  },
};

export async function generateMetadata(props: PageProps<"/[locale]/challenge">) {
  const { locale } = await props.params;
  const l: Locale = isLocale(locale) ? locale : "en";
  return { title: copy.title[l], description: copy.description[l] };
}

export default async function ChallengePage(props: PageProps<"/[locale]/challenge">) {
  const { locale: raw } = await props.params;
  const locale: Locale = isLocale(raw) ? raw : "en";
  const registerHref = currentEdition.registerUrl || "#register";

  return (
    <>
      {/* ---- Page header ---- */}
      <section className="border-b border-navy-700">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <SectionHeader
            as="h1"
            label={`DIC ${currentEdition.year} / The Challenge`}
            title={
              <>
                <span className="chroma text-lavender-200">{currentEdition.theme.short}:</span>{" "}
                {currentEdition.theme.full.replace(/^OPC:\s*/, "")}
              </>
            }
            lead={theme.tracksLead[locale]}
            status={<StatusChip>{currentEdition.ordinal[locale]}</StatusChip>}
          />

          <div className="mt-10 flex flex-wrap items-end gap-6">
            <Countdown target={currentEdition.kickoff} locale={locale} />
            <div className="flex flex-wrap gap-4">
              <Link href={registerHref} className="btn btn-primary">
                {dict.ctaRegister[locale]}
              </Link>
            </div>
          </div>

          {/* Jump links into the four tracks. */}
          <nav aria-label={dict.tracksHeading[locale]} className="mt-12 grid grid-cols-2 gap-px border border-navy-600 bg-navy-600 lg:grid-cols-4">
            {tracks2026.map((track) => (
              <a
                key={track.id}
                href={`#${track.id}`}
                className="group flex items-center gap-3 bg-navy-800 px-4 py-3.5 transition-colors hover:bg-navy-700"
              >
                <PixelIcon name={track.icon} className="h-7 w-7 shrink-0" />
                <span className="min-w-0">
                  <span className="label block text-cyan-400">{track.num}</span>
                  <span className="block truncate font-display text-sm font-bold text-paper">{track.name[locale]}</span>
                </span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ---- Theme ---- */}
      <section className="border-b border-navy-700">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeader index="01" label="Theme" title={dict.themeHeading[locale]} />
          <div className="mt-12">
            <ThemeBlock locale={locale} />
          </div>
        </div>
      </section>

      {/* ---- Tracks ---- */}
      <section className="border-b border-navy-700">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeader index="02" label="Tracks" title={dict.tracksHeading[locale]} status={<StatusChip>4 tracks</StatusChip>} />
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {tracks2026.map((track) => (
              <TrackWindow key={track.id} track={track} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      {/* ---- Stages + timeline ---- */}
      <section className="border-b border-navy-700">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeader index="03" label="How it works" title={dict.howHeading[locale]} />
          <div className="mt-12">
            <Phases locale={locale} />
          </div>
          <h2 className="mt-20 text-2xl font-extrabold tracking-tight text-paper sm:text-3xl">
            {dict.timelineHeading[locale]}
          </h2>
          <div className="mt-10">
            <Timeline locale={locale} />
          </div>
        </div>
      </section>

      {/* ---- Register ---- */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <RegisterPanel locale={locale} />
          <p className="mt-10 text-sm text-mist-400">
            {locale === "zh" ? "往届赛道与获奖作品见" : "Last year's tracks and winners are in the"}{" "}
            <Link href={href("/archive", locale)} className="text-cyan-400 underline decoration-navy-500 underline-offset-4 hover:decoration-cyan-400">
              {locale === "zh" ? "往届回顾" : "archive"}
            </Link>
            {locale === "zh" ? "。" : "."}
          </p>
        </div>
      </section>
    </>
  );
}
