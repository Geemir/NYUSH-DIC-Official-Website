import { dict } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";

/**
 * Renders content text, turning [[double-bracketed]] parts into amber TBD
 * chips. Content authors mark anything unconfirmed this way; removing the
 * brackets once it is confirmed is the whole edit.
 */
export default function Rich({ text, locale }: { text: string; locale: Locale }) {
  const parts = text.split(/\[\[(.+?)\]\]/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="tbd" title={dict.tbdTitle[locale]}>
            {part}
            <span className="sr-only"> ({dict.tbdTitle[locale]})</span>
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
