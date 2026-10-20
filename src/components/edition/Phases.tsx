import Rich from "@/components/ui/Rich";
import Window from "@/components/ui/Window";
import { phases } from "@/content/data/edition2026";
import type { Locale } from "@/lib/i18n";

/** Stage 1 and Stage 2, side by side on wide screens. */
export default function Phases({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      {phases.map((phase) => (
        <Window key={phase.num} title={`stage_${phase.num}`} as="article" bodyClassName="p-5 sm:p-7">
          <div className="flex items-baseline gap-4">
            <span className="chroma font-mono text-5xl font-bold leading-none text-lavender-200">{phase.num}</span>
            <h3 className="text-xl font-bold text-paper sm:text-2xl">{phase.name[locale]}</h3>
          </div>
          <p className="mt-5 text-[0.9375rem] text-paper sm:text-base">
            <Rich text={phase.body[locale]} locale={locale} />
          </p>
          {phase.items && (
            <ul className="mt-4 space-y-2.5">
              {phase.items.map((item) => (
                <li key={item.en} className="flex gap-3 text-[0.9375rem] text-mist-300">
                  <span aria-hidden="true" className="mt-[0.6em] block h-1.5 w-1.5 shrink-0 bg-cyan-400" />
                  <span>
                    <Rich text={item[locale]} locale={locale} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Window>
      ))}
    </div>
  );
}
