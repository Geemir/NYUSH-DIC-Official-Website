"use client";

import { useEffect, useRef } from "react";

import { headlineStats } from "@/content/site";
import type { Locale } from "@/lib/i18n";

const DURATION = 1200;

/**
 * One number. The real value is in the HTML, so it is correct without JS,
 * for crawlers and in screenshots. If the cell starts below the fold, it is
 * reset to 0 out of sight and counts up when it scrolls into view; if it is
 * already visible on load, it simply stays put.
 */
function Cell({ value, prefix, label }: { value: number; prefix: string; label: string }) {
  const cellRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cell = cellRef.current;
    const num = numRef.current;
    if (!cell || !num) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (cell.getBoundingClientRect().top < window.innerHeight) return;

    num.textContent = "0";
    let frame = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min((now - t0) / DURATION, 1);
          num.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.35 },
    );

    observer.observe(cell);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      num.textContent = String(value);
    };
  }, [value]);

  return (
    <div ref={cellRef} className="bg-navy-950 px-5 py-6 sm:px-6">
      <div className="font-mono text-5xl font-bold leading-none tracking-tight text-paper tabular-nums sm:text-6xl">
        <span className="text-cyan-400">{prefix}</span>
        <span ref={numRef}>{value}</span>
      </div>
      <div className="mt-3 text-sm text-mist-300">{label}</div>
    </div>
  );
}

/** Last edition's headline numbers, as a system readout. */
export default function Readout({ locale }: { locale: Locale }) {
  return (
    <div className="border border-navy-600 bg-navy-950">
      <div className="label flex items-center justify-between border-b border-navy-600 px-5 py-2.5 text-mist-400 sm:px-6">
        <span>last_run · {headlineStats.year}</span>
        <span className="text-cyan-400">ok</span>
      </div>
      {/* gap-px over a hairline-coloured grid draws the dividers at every breakpoint. */}
      <div className="grid grid-cols-2 gap-px bg-navy-600 lg:grid-cols-4">
        {headlineStats.items.map((item) => (
          <Cell key={item.label.en} value={item.value} prefix={item.prefix} label={item.label[locale]} />
        ))}
      </div>
    </div>
  );
}
