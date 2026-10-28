export type TermsSource = {
  version?: string | null;
  bodyMarkdown?: string | null;
} | null | undefined;

export type TermsDisplay = {
  version: string | null;
  body: string | null;
  emptyBodyNotice: string | null;
};

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Prefer published terms body; fall back to event.terms when published body is empty.
 * Never invent legal text — version-only still shows a real consent context.
 */
export function resolveTermsForDisplay(
  published: TermsSource,
  eventTerms?: TermsSource,
): TermsDisplay {
  const version =
    nonempty(published?.version) ?? nonempty(eventTerms?.version) ?? null;
  const body =
    nonempty(published?.bodyMarkdown) ??
    nonempty(eventTerms?.bodyMarkdown) ??
    null;
  if (!version) {
    return { version: null, body, emptyBodyNotice: null };
  }
  return {
    version,
    body,
    emptyBodyNotice: body
      ? null
      : `Điều khoản đã công bố (phiên bản ${version}) áp dụng khi đổi mã. Nội dung đầy đủ chưa có trên thiết bị.`,
  };
}
