"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import ShanghaiClock from "@/components/layout/ShanghaiClock";
import { dict } from "@/content/dictionaries";
import { currentEdition, navLinks } from "@/content/site";
import { href, type Locale } from "@/lib/i18n";
import { asset } from "@/lib/paths";

/** The menu bar: the top edge of the desktop the whole page sits on. */
export default function SiteHeader({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const registerHref = currentEdition.registerUrl || href("/challenge#register", locale);

  /* The same page in each language. */
  const pathFor = (target: Locale) => pathname.replace(`/${locale}`, `/${target}`);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-600 bg-navy-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          href={href("/", locale)}
          className="flex shrink-0 items-center gap-2.5"
          aria-label={dict.home[locale]}
        >
          <Image
            src={asset("/brand/dic-mark-light.png")}
            alt=""
            width={682}
            height={1000}
            priority
            className="h-7 w-auto"
          />
          <span className="font-mono text-sm font-bold tracking-wider text-paper">
            DIC<span className="text-cyan-400">·{currentEdition.year}</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => {
            const target = href(link.path, locale);
            const active = pathname.startsWith(target);
            return (
              <Link
                key={link.path}
                href={target}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative px-3 py-2 font-display text-sm font-semibold transition-colors",
                  active ? "text-lavender-200" : "text-mist-300 hover:text-paper",
                ].join(" ")}
              >
                {active && (
                  <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-cyan-400" />
                )}
                {link.label[locale]}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <span className="hidden md:inline-flex">
            <ShanghaiClock locale={locale} />
          </span>

          {/* Segmented language toggle: both options always visible. */}
          <div className="flex border border-navy-600 font-mono text-xs font-bold" role="group" aria-label="Language">
            {(["en", "zh"] as const).map((l) => (
              <Link
                key={l}
                href={pathFor(l)}
                hrefLang={l === "zh" ? "zh-Hans" : "en"}
                aria-current={l === locale ? "true" : undefined}
                className={[
                  "flex h-8 min-w-9 items-center justify-center px-2 transition-colors",
                  l === locale ? "bg-lavender-200 text-navy-900" : "text-mist-300 hover:text-paper",
                ].join(" ")}
              >
                {l === "en" ? "EN" : "中"}
              </Link>
            ))}
          </div>

          <Link
            href={registerHref}
            className="btn btn-primary hidden !min-h-9 !px-4 !py-1.5 !text-sm sm:inline-flex"
          >
            {dict.ctaRegister[locale]}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="-mr-1.5 inline-flex h-10 w-10 items-center justify-center text-paper lg:hidden"
          >
            <span className="sr-only">{open ? dict.close[locale] : dict.menu[locale]}</span>
            <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className="h-4 w-4" aria-hidden="true">
              {open ? (
                <path d="M2 2h2v2H2zM4 4h2v2H4zM6 6h4v4H6zM10 4h2v2h-2zM12 2h2v2h-2zM4 10h2v2H4zM2 12h2v2H2zM10 10h2v2h-2zM12 12h2v2h-2z" fill="currentColor" />
              ) : (
                <path d="M1 2h14v2H1zM1 7h14v2H1zM1 12h14v2H1z" fill="currentColor" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        /* Each link closes the menu itself; tying it to a pathname effect
           would leave it open when the target is the current page. */
        <nav
          id="mobile-nav"
          aria-label="Main"
          onClick={() => setOpen(false)}
          className="border-t border-navy-600 bg-navy-950 px-4 pb-6 pt-1 sm:px-6 lg:hidden"
        >
          {navLinks.map((link, i) => (
            <Link
              key={link.path}
              href={href(link.path, locale)}
              className="flex items-baseline gap-4 border-b border-navy-700 py-3.5 font-display text-lg font-bold text-paper"
            >
              <span className="label text-cyan-400">{String(i + 1).padStart(2, "0")}</span>
              {link.label[locale]}
            </Link>
          ))}
          <div className="mt-5 flex items-center justify-between gap-4">
            <Link href={registerHref} className="btn btn-primary">
              {dict.ctaRegister[locale]}
            </Link>
            <ShanghaiClock locale={locale} />
          </div>
        </nav>
      )}
    </header>
  );
}
