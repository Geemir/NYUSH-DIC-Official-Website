import Image from "next/image";
import Link from "next/link";

import PixelIcon from "@/components/ui/PixelIcon";
import { dict } from "@/content/dictionaries";
import { tracks2026 } from "@/content/data/edition2026";
import { href, type Locale } from "@/lib/i18n";
import { asset } from "@/lib/paths";

/*
 * The theme as a diagram: one person (the DIC mark, centre) wired to four
 * capabilities (the tracks, corners). Data pulses travel the traces.
 *
 * The SVG and the HTML nodes share one 600×500 coordinate space inside a
 * fixed-aspect box, so percentages line the two layers up exactly.
 */
const W = 600;
const H = 500;

const nodes = [
  { x: 92, y: 84 },
  { x: 508, y: 84 },
  { x: 92, y: 416 },
  { x: 508, y: 416 },
];

const traces = [
  "M134 84 H250 V160",
  "M466 84 H350 V160",
  "M134 416 H250 V340",
  "M466 416 H350 V340",
];

/* Decorative stubs that run off the edge, echoing the poster's network. */
const stubs = ["M210 250 H120 V300 H40", "M390 250 H480 V200 H568", "M300 160 V120", "M300 340 V380"];

function hexagon(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function HeroCircuit({ locale }: { locale: Locale }) {
  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-[34rem]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {[hexagon(36, 40, 34), hexagon(560, 470, 30), hexagon(586, 300, 18)].map((points) => (
          <polygon key={points} points={points} fill="none" stroke="var(--color-navy-600)" strokeWidth="1.5" />
        ))}

        {stubs.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--color-navy-600)" strokeWidth="2" />
        ))}
        {traces.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--color-cyan-400)" strokeWidth="2" opacity="0.75" />
        ))}

        {/* Joints at every bend. */}
        {[
          [250, 84], [350, 84], [250, 416], [350, 416],
          [120, 250], [480, 250], [120, 300], [480, 200],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width="8" height="8" fill="var(--color-navy-900)" stroke="var(--color-cyan-400)" strokeWidth="2" />
        ))}

        <g className="motion-pulse">
          {traces.map((d, i) => (
            <rect key={d} x="-4" y="-4" width="8" height="8" fill={i % 2 ? "var(--color-orchid-400)" : "var(--color-cyan-300)"}>
              <animateMotion dur="2.8s" begin={`${i * 0.7}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            </rect>
          ))}
        </g>
      </svg>

      {/* Centre: one person, shown as the DIC mark in its original colours. */}
      <div
        className="window absolute flex flex-col"
        style={{ left: pct(210, W), top: pct(160, H), width: pct(180, W), height: pct(180, H) }}
      >
        <div className="flex h-6 shrink-0 items-center bg-lavender-200 px-2">
          <span className="label truncate !text-[0.5625rem] !tracking-[0.04em] text-navy-900 normal-case">
            {dict.circuitTitle[locale]}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center bg-lavender-50 p-[12%]">
          <Image src={asset("/brand/dic-mark.png")} alt="" width={682} height={1000} priority className="h-full w-auto" />
        </div>
      </div>

      {/* Corners: the four tracks, each a link into its brief. */}
      {tracks2026.map((track, i) => {
        const n = nodes[i];
        /* Labels hang inward from the outer edge so they never leave the box. */
        const onLeft = n.x < W / 2;
        const below = n.y < H / 2;
        return (
          <Link
            key={track.id}
            href={href(`/challenge#${track.id}`, locale)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(n.x, W), top: pct(n.y, H), width: pct(84, W) }}
          >
            <span className="flex aspect-square w-full items-center justify-center border border-navy-600 bg-navy-800 shadow-[4px_4px_0_0_var(--color-plum-800)] transition-[transform,border-color] duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-cyan-400 group-focus-visible:border-cyan-400">
              <PixelIcon name={track.icon} className="w-[58%]" />
            </span>
            <span
              className={[
                "label absolute hidden w-max max-w-[8rem] !leading-snug text-mist-300 group-hover:text-cyan-400 sm:block",
                onLeft ? "left-0 text-left" : "right-0 text-right",
                below ? "top-full mt-2.5" : "bottom-full mb-2.5",
              ].join(" ")}
            >
              <span className="text-cyan-400">{track.num}</span> {track.name[locale]}
            </span>
            <span className="sr-only sm:hidden">{track.name[locale]}</span>
          </Link>
        );
      })}
    </div>
  );
}
