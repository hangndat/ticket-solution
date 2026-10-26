/** Invalidate every response started for a previous context or earlier reload. */
export function createContextRequestGate() {
  let generation = 0;
  let activeContext = '';
  return {
    begin(context: string) {
      activeContext = context;
      const requestGeneration = ++generation;
      return {
        isCurrent: () =>
          requestGeneration === generation && activeContext === context,
      };
    },
    invalidate() {
      generation += 1;
    },
  };
}
