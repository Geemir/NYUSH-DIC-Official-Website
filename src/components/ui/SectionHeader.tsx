import type { ReactNode } from "react";

/**
 * `02 / TRACKS ──────── status`, then the heading and an optional lead.
 * The index label stays English in both locales: it is system UI.
 */
export default function SectionHeader({
  index,
  label,
  title,
  lead,
  status,
  as: Heading = "h2",
  id,
}: {
  index?: string;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
  status?: ReactNode;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <header>
      <div className="flex items-center gap-4">
        <span className="label shrink-0 text-cyan-400">
          {index ? `${index} / ` : ""}
          {label}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-navy-600" />
        {status}
      </div>
      <Heading
        id={id}
        className={[
          "mt-5 font-extrabold tracking-tight text-paper",
          Heading === "h1"
            ? "text-[2.25rem] leading-[1.1] sm:text-5xl"
            : "text-[1.75rem] leading-tight sm:text-[2.5rem]",
        ].join(" ")}
      >
        {title}
      </Heading>
      {lead && (
        <div className="mt-4 max-w-2xl text-base text-mist-300 sm:text-[1.0625rem]">
          {lead}
        </div>
      )}
    </header>
  );
}

/** A small blinking status chip for the right end of a section header. */
export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="label inline-flex shrink-0 items-center gap-2 text-orchid-300">
      <span aria-hidden="true" className="block h-2 w-2 animate-blink bg-orchid-400" />
      {children}
    </span>
  );
}
