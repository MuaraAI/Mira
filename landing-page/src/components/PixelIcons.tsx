/**
 * Ikon pixel-art yang digambar ulang per pixel pada grid 16x16.
 * Dirender 1:1 di ukuran 16px (h-4 w-4) dengan crispEdges supaya tajam,
 * dan memakai currentColor agar warnanya ikut tema seperti ikon lucide.
 */

function fromRows(rows: string[]) {
  const rects: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = row[x] === "#";
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        rects.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  });
  return rects;
}

// Piala dengan bintang di badannya: simbol "flexing" nilai.
const TROPHY = fromRows([
  "................",
  "...##########...",
  "##.#........#.##",
  "#..#...##...#..#",
  "#..#.######.#..#",
  ".#.#..####..#.#.",
  "..##..#..#..##..",
  "....#......#....",
  ".....#....#.....",
  "......####......",
  ".......##.......",
  ".......##.......",
  ".....######.....",
  "....########....",
  "....########....",
  "................",
]);

export function PixelTrophy({ className = "h-4 w-4", ...rest }: { className?: string; "aria-hidden"?: boolean | "true" | "false" }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges" {...rest}>
      {TROPHY.map(({ x, y, w }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} />
      ))}
    </svg>
  );
}
