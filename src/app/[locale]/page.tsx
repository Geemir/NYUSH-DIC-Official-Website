import Link from "next/link";
import type { ReactNode } from "react";

import Countdown from "@/components/edition/Countdown";
import HeroCircuit from "@/components/edition/HeroCircuit";
import Phases from "@/components/edition/Phases";
import ThemeBlock from "@/components/edition/ThemeBlock";
import Timeline from "@/components/edition/Timeline";
import { TrackCard } from "@/components/edition/TrackWindow";
import EventList from "@/components/home/EventList";
import PartnerGrid from "@/components/home/PartnerGrid";
import Readout from "@/components/home/Readout";
import Reveal from "@/components/ui/Reveal";
import SectionHeader, { StatusChip } from "@/components/ui/SectionHeader";
import Window from "@/components/ui/Window";
import { dict } from "@/content/dictionaries";
import { theme, tracks2026 } from "@/content/data/edition2026";
import { events } from "@/content/data/events";
import { currentEdition } from "@/content/site";
import { href, isLocale, type Locale } from "@/lib/i18n";

function Section({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`border-t border-navy-700 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">{children}</div>
    </section>
  );
}

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale: raw } = await props.params;
  const locale: Locale = isLocale(raw) ? raw : "en";

  const registerHref = currentEdition.registerUrl || href("/challenge#register", locale);
  const recruitHref = currentEdition.recruitUrl || href("/join", locale);

  return (
    <>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-8 lg:pb-24 lg:pt-16">
          <div>
            <p className="label text-cyan-400">{dict.heroKicker[locale]}</p>

            {/* The year as a double outline, after the poster. Decorative:
                the h1 below carries the same information for assistive tech. */}
            <div aria-hidden="true" className="mt-4 select-none font-display text-[5.25rem] font-extrabold leading-[0.9] tracking-tight sm:text-[7.5rem] lg:text-[8.5rem]">
              <span className="relative inline-block">
                <span className="absolute left-[3px] top-[3px] text-transparent [-webkit-text-stroke:2px_var(--color-orchid-400)] sm:left-[5px] sm:top-[5px]">
                  {currentEdition.year}
                </span>
                <span className="relative text-transparent [-webkit-text-stroke:2px_var(--color-cyan-400)]">
                  {currentEdition.year}
                </span>
              </span>
            </div>

            <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-paper sm:text-5xl">
              <span className="sr-only">DIC {currentEdition.year} · </span>
              {dict.heroTitle[locale]}
            </h1>

            <div className="mt-7 border-l-2 border-orchid-400 pl-4">
              <p className="label text-mist-400">{dict.heroThemeLabel[locale]}</p>
              <p className="mt-1.5 font-display text-xl font-bold leading-snug text-lavender-200 sm:text-2xl">
                <span className="chroma">{currentEdition.theme.short}:</span> {dict.heroThemeLine.en}
              </p>
              {locale === "zh" && <p className="mt-0.5 text-sm text-mist-300">{dict.heroThemeLine.zh}</p>}
            </div>

            <p className="mt-6 max-w-xl text-base text-mist-300 sm:text-[1.0625rem]">{dict.heroBody[locale]}</p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={registerHref} className="btn btn-primary">
                {dict.ctaRegister[locale]}
              </Link>
              <Link href="#tracks" className="btn btn-secondary">
                {dict.ctaTracks[locale]}
              </Link>
            </div>

            <div className="mt-10">
              <Countdown target={currentEdition.kickoff} locale={locale} />
            </div>
          </div>

          <HeroCircuit locale={locale} />
        </div>
      </section>

      {/* ---- Theme ---- */}
      <Section id="theme">
        <Reveal>
          <SectionHeader index="01" label="Theme" title={dict.themeHeading[locale]} />
        </Reveal>
        <Reveal className="mt-12">
          <ThemeBlock locale={locale} />
        </Reveal>
      </Section>

      {/* ---- Tracks ---- */}
      <Section id="tracks">
        <Reveal>
          <SectionHeader
            index="02"
            label="Tracks"
            title={dict.tracksHeading[locale]}
            lead={theme.tracksLead[locale]}
            status={<StatusChip>4 tracks</StatusChip>}
          />
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8">
          {tracks2026.map((track, i) => (
            <Reveal key={track.id} delay={(i % 2) * 80} className="h-full">
              <TrackCard track={track} locale={locale} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---- How it works ---- */}
      <Section id="how">
        <Reveal>
          <SectionHeader index="03" label="How it works" title={dict.howHeading[locale]} />
        </Reveal>
        <Reveal className="mt-12">
          <Phases locale={locale} />
        </Reveal>
        <Reveal className="mt-16">
          <h3 className="label mb-8 text-cyan-400">{dict.timelineHeading[locale]}</h3>
          <Timeline locale={locale} />
        </Reveal>
        <Reveal className="mt-12">
          <Link href={href("/challenge", locale)} className="btn btn-secondary">
            {dict.ctaChallenge[locale]} <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      </Section>

      {/* ---- Last edition, by the numbers ---- */}
      <Section id="last-run" className="bg-navy-950/40">
        <Reveal>
          <SectionHeader index="04" label="Last run" title={dict.readoutHeading[locale]} />
        </Reveal>
        <Reveal className="mt-12">
          <Readout locale={locale} />
        </Reveal>
      </Section>

      {/* ---- About ---- */}
      <Section id="about">
        <Reveal>
          <SectionHeader index="05" label="About DIC" title={dict.aboutHeading[locale]} />
        </Reveal>
        <Reveal className="mt-10">
          <div className="grid gap-6 text-mist-300 sm:text-[1.0625rem] lg:grid-cols-2 lg:gap-12">
            <p>{dict.aboutBodyA[locale]}</p>
            <p>{dict.aboutBodyB[locale]}</p>
          </div>
        </Reveal>

        {/* Dean's endorsement — an inverse panel, the one lavender block. */}
        <Reveal className="mt-14">
          <figure className="relative border border-lavender-200 bg-lavender-100 p-7 text-navy-900 shadow-[6px_6px_0_0_var(--color-indigo-600)] sm:p-10">
            <span aria-hidden="true" className="absolute -top-5 left-6 bg-navy-900 px-2 font-mono text-5xl font-bold leading-none text-orchid-400 sm:left-9">
              “
            </span>
            <blockquote className="font-display text-lg font-semibold leading-relaxed sm:text-[1.375rem]">
              {dict.deanQuote[locale]}
            </blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="block font-display text-base font-extrabold">Nasir Memon</span>
              <span className="text-navy-700">{dict.deanTitle[locale]}</span>
            </figcaption>
          </figure>
        </Reveal>
      </Section>

      {/* ---- Events ---- */}
      <Section id="events">
        <Reveal>
          <SectionHeader index="06" label="Events" title={dict.eventsHeading[locale]} lead={dict.eventsBody[locale]} />
        </Reveal>
        <Reveal className="mt-12">
          <EventList events={events.slice(0, 4)} locale={locale} />
        </Reveal>
        <Reveal className="mt-8">
          <Link href={href("/events", locale)} className="label inline-flex items-center gap-2 text-cyan-400 transition-colors hover:text-cyan-300">
            {dict.viewAllEvents[locale]} <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      </Section>

      {/* ---- Partners ---- */}
      <Section id="partners">
        <Reveal>
          <SectionHeader index="07" label="Partners" title={dict.partnersHeading[locale]} lead={dict.partnersBody[locale]} />
        </Reveal>
        <Reveal className="mt-12">
          <p className="label mb-4 text-mist-400">{dict.partnersLastYear[locale]}</p>
          <PartnerGrid locale={locale} />
        </Reveal>
        <Reveal className="mt-10">
          <Link href={href("/partners", locale)} className="btn btn-secondary">
            {dict.becomePartner[locale]}
          </Link>
        </Reveal>
      </Section>

      {/* ---- Core team recruitment ---- */}
      <Section id="join">
        <Reveal>
          <Window title="join --core-team" tone="paper" bodyClassName="p-7 sm:p-10">
            <p className="font-mono text-sm font-bold text-indigo-600">
              &gt; recruiting_2026
              <span aria-hidden="true" className="ml-1 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] animate-blink bg-indigo-600" />
            </p>
            <h2 className="mt-4 max-w-3xl text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
              {dict.joinHeading[locale]}
            </h2>
            <p className="mt-5 max-w-2xl text-navy-700 sm:text-[1.0625rem]">{dict.joinBody[locale]}</p>
            <Link href={recruitHref} className="btn btn-inverse mt-8">
              {dict.ctaJoinTeam[locale]} <span aria-hidden="true">→</span>
            </Link>
          </Window>
        </Reveal>
      </Section>
    </>
  );
}
