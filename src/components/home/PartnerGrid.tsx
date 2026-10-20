import { partners } from "@/content/data/partners";
import type { Locale } from "@/lib/i18n";

const tierLabel = { sponsor: "sponsor", track: "track partner", academic: "academic" } as const;

/**
 * Partner tiles. Names stand in until logo files (and permission to show
 * them) arrive — add `logo` in src/content/data/partners.ts to switch.
 */
export default function PartnerGrid({ locale }: { locale: Locale }) {
  return (
    <ul className="grid grid-cols-2 gap-px border border-navy-600 bg-navy-600 sm:grid-cols-3">
      {partners.map((p) => (
        <li key={p.id} className="flex min-h-28 flex-col justify-between bg-navy-800 p-4 sm:p-5">
          <span className="label text-mist-400">{tierLabel[p.tier]}</span>
          <span className="mt-3 font-display text-lg font-bold leading-snug text-paper sm:text-xl">{p.name[locale]}</span>
        </li>
      ))}
    </ul>
  );
}
