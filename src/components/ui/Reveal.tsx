"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * "Window open": content settles in — a short rise and a slight scale — the
 * first time it scrolls into view.
 *
 * The hidden state is applied by CSS only under `html.js` (set by an inline
 * script in the root layout), so without JavaScript everything is simply
 * visible. Under prefers-reduced-motion the transition is removed.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={shown ? "shown" : "hidden"}
      style={{ transitionDelay: `${delay}ms` }}
      className={className}
    >
      {children}
    </div>
  );
}
