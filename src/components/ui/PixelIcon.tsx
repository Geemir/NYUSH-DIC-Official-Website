/**
 * Pixel icons, drawn as character maps so they are easy to read and edit.
 *
 *   L lavender   C cyan   O orchid   N navy (a cut-out)   . empty
 *
 * Each map renders as crisp-edged SVG rects, coloured from design tokens, so
 * the icons stay sharp at any size and follow the palette if it changes.
 */

const palette: Record<string, string> = {
  L: "var(--color-lavender-200)",
  C: "var(--color-cyan-400)",
  O: "var(--color-orchid-400)",
  N: "var(--color-navy-900)",
  P: "var(--color-paper)",
};

const icons = {
  business: [
    "................",
    "..LLLLLLLLLLLL..",
    ".LLLLLLLLLLLLLL.",
    ".OOLLOOLLOOLLOO.",
    ".OOLLOOLLOOLLOO.",
    "................",
    "..LLLLLLLLLLLL..",
    "..LNNNLLLLNNNL..",
    "..LNNNLLLLNNNL..",
    "..LLLLLLLLLLLL..",
    "..LLLLLNNNLLLL..",
    "..LLLLLNNNLLLL..",
    "..LLLLLNNNLLLL..",
    "..LLLLLNNNLLLL..",
    "CCCCCCCCCCCCCCCC",
    "................",
  ],
  shield: [
    "................",
    ".......LL.......",
    ".....LLLLLL.....",
    "..LLLLLLLLLLLL..",
    "..LLLLLLLLLLLL..",
    "..LLLLLLLLLLLL..",
    "..LLLLLLLLLCCL..",
    "..LLLLLLLLCCLL..",
    "..LCCLLLLCCLLL..",
    "..LLCCLLCCLLLL..",
    "...LLCCCCLLLL...",
    "...LLLCCLLLLL...",
    "....LLLLLLLL....",
    ".....LLLLLL.....",
    ".......LL.......",
    "................",
  ],
  robot: [
    ".......CC.......",
    ".......CC.......",
    "...LLLLLLLLLL...",
    "...LLLLLLLLLL...",
    "..OLLNNLLNNLLO..",
    "..OLLNNLLNNLLO..",
    "...LLLLLLLLLL...",
    "...LLLCCCCLLL...",
    "...LLLLLLLLLL...",
    "................",
    ".....LLLLLL.....",
    "...OOLLLLLLOO...",
    "...OOLLCCLLOO...",
    ".....LLLLLL.....",
    ".....LL..LL.....",
    "....CCC..CCC....",
  ],
  heart: [
    "................",
    "................",
    "..LLLL....LLLL..",
    ".LLLLLL..LLLLLL.",
    "LLLLLLLLLLLLLLLL",
    "LLLLLLLLLLLLLLLL",
    "LLLLLLLCLLLLLLLL",
    "LLLLLLCLCLLLLLLL",
    "CCCCCCLLLCLCCCCC",
    ".LLLLLLLLLCLLLL.",
    "..LLLLLLLLLLLL..",
    "...LLLLLLLLLL...",
    "....LLLLLLLL....",
    ".....LLLLLL.....",
    "......LLLL......",
    ".......LL.......",
  ],
  arrow: [
    "....L....",
    "....LL...",
    "LLLLLLLL.",
    "LLLLLLLLL",
    "LLLLLLLL.",
    "....LL...",
    "....L....",
  ],
  cursor: [
    "O..........",
    "OO.........",
    "OLO........",
    "OLLO.......",
    "OLLLO......",
    "OLLLLO.....",
    "OLLLLLO....",
    "OLLLLLLO...",
    "OLLLLLLLO..",
    "OLLLLLLLLO.",
    "OLLLLLOOOOO",
    "OLLOLLO....",
    "OLO.OLLO...",
    "OO..OLLO...",
    "O....OLLO..",
    ".....OOO...",
  ],
  spark: [
    "....C....",
    "....C....",
    "....C....",
    "...CLC...",
    "CCCLLLCCC",
    "...CLC...",
    "....C....",
    "....C....",
    "....C....",
  ],
} as const;

export type PixelIconName = keyof typeof icons;

/** Merge horizontal runs of the same colour into single rects. */
function runs(rows: readonly string[]) {
  const out: Array<{ x: number; y: number; w: number; c: string }> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === ".") {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === c) w++;
      out.push({ x, y, w, c });
      x += w;
    }
  });
  return out;
}

export default function PixelIcon({
  name,
  className = "",
  title,
}: {
  name: PixelIconName;
  className?: string;
  /** Give the icon an accessible name. Omit when it is decorative. */
  title?: string;
}) {
  const rows = icons[name];
  const width = rows[0].length;
  const height = rows.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {runs(rows).map(({ x, y, w, c }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={palette[c]} />
      ))}
    </svg>
  );
}
