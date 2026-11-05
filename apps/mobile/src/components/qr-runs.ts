/** One horizontal rectangle per dark run avoids mounting a View per QR module. */
export function qrDarkRuns(modules: boolean[][]): { x: number; y: number; width: number }[] {
  const runs: { x: number; y: number; width: number }[] = [];
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < row.length && row[x]) x++;
      runs.push({ x: start, y, width: x - start });
    }
  });
  return runs;
}
