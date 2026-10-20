import type { ReactNode } from "react";

/**
 * The retro-desktop window. Its title bar turns from lavender to cyan when the
 * window is hovered or holds keyboard focus — the "active window" state — so
 * the chrome tells you what you are pointing at.
 *
 * `tone="paper"` gives a light lavender body with navy text, for inverse
 * panels and for showing the logo in its original colours.
 */
export default function Window({
  title,
  children,
  tone = "navy",
  className = "",
  bodyClassName = "",
  id,
  as: Tag = "div",
}: {
  title: string;
  children: ReactNode;
  tone?: "navy" | "paper";
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "div" | "article" | "section" | "aside";
}) {
  return (
    <Tag id={id} className={`window group/win flex flex-col ${className}`}>
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 bg-lavender-200 px-3 text-navy-900 transition-colors duration-150 group-hover/win:bg-cyan-400 group-focus-within/win:bg-cyan-400">
        <span className="label truncate !tracking-[0.06em] normal-case">{title}</span>
        {/* Decorative window controls. */}
        <span aria-hidden="true" className="flex shrink-0 items-center gap-2.5">
          <span className="block h-0.5 w-2.5 bg-navy-900" />
          <span className="block h-2.5 w-2.5 border-[1.5px] border-navy-900" />
          <span className="relative block h-2.5 w-2.5">
            <span className="absolute left-1/2 top-0 block h-full w-[1.5px] -translate-x-1/2 rotate-45 bg-navy-900" />
            <span className="absolute left-1/2 top-0 block h-full w-[1.5px] -translate-x-1/2 -rotate-45 bg-navy-900" />
          </span>
        </span>
      </div>
      <div
        className={[
          "flex-1",
          tone === "paper" ? "bg-lavender-100 text-navy-900" : "",
          bodyClassName,
        ].join(" ")}
      >
        {children}
      </div>
    </Tag>
  );
}
