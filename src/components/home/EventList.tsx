import { dict } from "@/content/dictionaries";
import { eventKinds, type ClubEvent } from "@/content/data/events";
import type { Locale } from "@/lib/i18n";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `2026.11.09` — locale-neutral, and it lines up in a mono column. */
const stamp = (iso: string) => dateFmt.format(new Date(iso)).replaceAll("-", ".");

/** Events as rows in a file explorer: date · type · title. */
export default function EventList({ events, locale }: { events: ClubEvent[]; locale: Locale }) {
  return (
    <div className="border border-navy-600 bg-navy-800">
      <div className="label hidden grid-cols-[8.5rem_7rem_1fr] gap-4 border-b border-navy-600 px-5 py-2.5 text-mist-400 sm:grid">
        <span>date</span>
        <span>type</span>
        <span>event</span>
      </div>
      <ul>
        {events.map((event) => (
          <li
            key={event.id}
            className="group relative grid gap-1.5 border-b border-navy-700 px-5 py-4 transition-colors last:border-b-0 hover:bg-cyan-400/[0.06] sm:grid-cols-[8.5rem_7rem_1fr] sm:gap-4"
          >
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-cyan-400 opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="font-mono text-sm text-lavender-200 tabular-nums">
              {event.date ? stamp(event.date) : <span className="text-mist-400">{dict.undated[locale]}</span>}
            </span>
            <span className="label pt-1 text-cyan-400">{eventKinds[event.kind][locale]}</span>
            <div>
              <h3 className="font-display text-base font-bold text-paper">{event.title[locale]}</h3>
              <p className="mt-1 text-sm text-mist-300">{event.summary[locale]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
