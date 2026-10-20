import Image from "next/image";
import Link from "next/link";

import { dict } from "@/content/dictionaries";
import { currentEdition, navLinks, site } from "@/content/site";
import { href, type Locale } from "@/lib/i18n";
import { asset } from "@/lib/paths";

const socials = [
  { label: "Instagram", url: site.socials.instagram },
  { label: "LinkedIn", url: site.socials.linkedin },
  { label: "Xiaohongshu · 小红书", url: site.socials.xiaohongshu },
];

/** The status bar: the bottom edge of the desktop. */
export default function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-navy-600 bg-navy-950 text-mist-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Image
            src={asset("/brand/dic-logo-light.png")}
            alt={site.name}
            width={1504}
            height={549}
            className="h-14 w-auto"
          />
          <p className="mt-5 max-w-xs text-sm">{dict.footerOrg[locale]}</p>
        </div>

        <div>
          <h2 className="label text-cyan-400">{dict.footerExplore[locale]}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link href={href(link.path, locale)} className="transition-colors hover:text-paper">
                  {link.label[locale]}
                </Link>
              </li>
            ))}
            <li>
              <Link href={href("/join", locale)} className="text-lavender-200 transition-colors hover:text-paper">
                {dict.ctaJoinTeam[locale]}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="label text-cyan-400">{dict.footerFollow[locale]}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              WeChat · <span className="text-paper">{site.socials.wechat}</span>
            </li>
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-paper">
                  {s.label} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
          {/* TODO: official-account QR at public/brand/wechat-qr.png */}
        </div>

        <div>
          <h2 className="label text-cyan-400">{dict.footerContact[locale]}</h2>
          <p className="mt-4 text-sm">
            <a href={`mailto:${site.email}`} className="break-all text-paper underline decoration-navy-500 underline-offset-4 transition-colors hover:decoration-cyan-400">
              {site.email}
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-navy-700">
        <div className="label mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-mist-400 sm:px-6 lg:px-8">
          <span>
            NYUSH DIC <span className="text-navy-500">·</span> {currentEdition.year} edition{" "}
            <span className="text-navy-500">·</span> Shanghai
          </span>
          <span>© {currentEdition.year} NYUSH DIC</span>
        </div>
      </div>
    </footer>
  );
}
