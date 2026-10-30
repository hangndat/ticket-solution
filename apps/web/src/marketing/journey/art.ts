/** Ticket art helpers — seeded so SSR and client markup match. */

export const PALETTE = {
  navy: '#060817',
  navyDeep: '#03040c',
  ink: '#0a0d22',
  violet: '#9b4dff',
  magenta: '#f23cb3',
  cyan: '#28d4ef',
  amber: '#ffb547',
  warm: '#ff835f',
} as const;

export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 25×25 QR-like matrix with three finder patterns (decorative, not scannable). */
export function qrMatrix(seed = 11, n = 25): boolean[][] {
  const rand = rng(seed);
  const m = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => rand() > 0.52),
  );
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const gx = ox + x;
        const gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        m[gy]![gx] = ring !== 2 && ring !== 4;
      }
    }
  };
  finder(0, 0);
  finder(n - 7, 0);
  finder(0, n - 7);
  return m;
}

export function qrPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return d;
}
