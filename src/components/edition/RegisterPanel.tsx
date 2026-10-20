import Image from "next/image";

import Window from "@/components/ui/Window";
import { dict } from "@/content/dictionaries";
import { currentEdition, site } from "@/content/site";
import type { Locale } from "@/lib/i18n";
import { asset } from "@/lib/paths";

/**
 * Registration. While `currentEdition.registerUrl` is empty this says plainly
 * that sign-up opens at kick-off; filling the URL turns it into the real CTA.
 */
export default function RegisterPanel({ locale }: { locale: Locale }) {
  const url = currentEdition.registerUrl;

  return (
    <Window id="register" title="register.app" className="scroll-mt-24" bodyClassName="grid gap-8 p-5 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <h2 className="text-[1.75rem] font-extrabold tracking-tight text-paper sm:text-4xl">
          {dict.registerHeading[locale]}
        </h2>
        <p className="mt-4 max-w-xl text-mist-300">{dict.registerBody[locale]}</p>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {dict.registerOpen[locale]} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-3 font-mono text-sm text-mist-300">
              {dict.registerPending[locale]}
              <span className="tbd" title={dict.tbdTitle[locale]}>
                {locale === "zh" ? "开幕式公布" : "opens at kick-off"}
              </span>
            </span>
          )}
          <a href={`mailto:${site.email}`} className="label text-cyan-400 transition-colors hover:text-cyan-300">
            {site.email}
          </a>
        </div>
      </div>

      <a
        href={asset("/campaign/kickoff-poster.jpg")}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto block w-44 border border-navy-600 shadow-[4px_4px_0_0_var(--color-plum-800)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 sm:w-52"
      >
        <picture>
          <source srcSet={asset("/campaign/kickoff-poster.webp")} type="image/webp" />
          <Image
            src={asset("/campaign/kickoff-poster.jpg")}
            alt={locale === "zh" ? "DIC 2026 开幕式海报：11 月 9 日（周一）" : "DIC 2026 Kick-off Day poster: Nov 9 (Mon)"}
            width={1000}
            height={1414}
            className="block h-auto w-full"
          />
        </picture>
      </a>
    </Window>
  );
}
