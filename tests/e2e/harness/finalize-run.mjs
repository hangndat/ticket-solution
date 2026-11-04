/** Apply cleanup outcome without erasing the original test or setup result. */
export async function finalizeRun(summary, cleanup) {
  let cleanupError;
  try {
    cleanupError = await cleanup();
  } catch (error) {
    cleanupError = String(error.message || 'cleanup failed');
  }
  if (summary) {
    summary.cleanup = cleanupError
      ? { status: 'FAIL', detail: cleanupError }
      : { status: 'PASS' };
    if (cleanupError) {
      if (summary.status === 'PASS') summary.status = 'FAIL';
      if (summary.sourceProvenance)
        summary.sourceProvenance.evidenceExactShaEligible = false;
      if (summary.sourceProvenance) {
        summary.sourceProvenance.evidenceEligible = false;
        summary.sourceProvenance.nonEvidenceReason = 'CLEANUP_FAILED';
      }
    }
  }
  const exitCode = cleanupError
    ? 2
    : summary?.status === 'PASS'
      ? 0
      : summary?.status === 'BLOCKED'
        ? 2
        : 1;
  return { summary, cleanupError, exitCode };
}
