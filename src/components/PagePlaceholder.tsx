import Link from "next/link";

import SectionHeader, { StatusChip } from "@/components/ui/SectionHeader";
import Window from "@/components/ui/Window";
import { href, type Locale } from "@/lib/i18n";

/**
 * Temporary shell for routes that exist in the sitemap but have not been
 * built out yet. Keeps navigation honest instead of shipping dead links.
 * Delete each usage as the real page lands.
 */
export default function PagePlaceholder({
  locale,
  label,
  title,
  intro,
  planned,
}: {
  locale: Locale;
  label: string;
  title: string;
  intro: string;
  planned: string[];
}) {
  return (
    <section>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader
          as="h1"
          label={label}
          title={title}
          lead={intro}
          status={<StatusChip>{locale === "zh" ? "建设中" : "in progress"}</StatusChip>}
        />

        <Window title="roadmap.txt" className="mt-12" bodyClassName="p-6 sm:p-7">
          <h2 className="label text-cyan-400">{locale === "zh" ? "本页将包含" : "This page will cover"}</h2>
          <ul className="mt-5 space-y-3">
            {planned.map((item) => (
              <li key={item} className="flex gap-3 text-[0.9375rem] text-mist-300">
                <span aria-hidden="true" className="mt-[0.6em] block h-1.5 w-1.5 shrink-0 bg-cyan-400" />
                {item}
              </li>
            ))}
          </ul>
        </Window>

        <Link href={href("/", locale)} className="btn btn-secondary mt-12">
          <span aria-hidden="true">←</span> {locale === "zh" ? "返回首页" : "Back to home"}
        </Link>
      </div>
    </section>
  );
}
