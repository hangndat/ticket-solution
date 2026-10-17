/**
 * Redeem-time form/terms gate + consent evidence for request snapshots.
 * Stale published versions → 409; validation failures → FORM_INVALID with fieldIds.
 * Audit must never receive answers/PII from this module.
 */

import type { FormAnswerValue, FormDefinition } from '@ticket/contracts';
import { IssueError, ISSUE_ERROR_CODES } from './issue-error';
import {
  canonicalizeAnswers,
  hashFormDefinition,
  hashTermsContent,
  validateFormAnswers,
} from './form-validate';
import {
  loadPublishedFormTerms,
  type PublishedFormTerms,
} from './published-form';
import type { Prisma } from './generated/prisma/client';

export type ConsentSnapshot = {
  formVersion: string | null;
  termsVersion: string | null;
  /** Explicit true only — never invent for legacy. */
  termsAccepted: true | null;
  answers: Record<string, FormAnswerValue>;
  formDefinitionHash: string | null;
  termsContentHash: string | null;
  /** Set when termsAccepted === true; caller stamps DB clock. */
  requiresConsentTimestamp: boolean;
};

export type RedeemFormInput = {
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
};

/**
 * Resolve published form/terms and validate client payload.
 * When published has no form and client omits formVersion → legacy empty snapshot.
 */
export async function resolveAndValidateConsent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  input: RedeemFormInput,
): Promise<{ published: PublishedFormTerms; snapshot: ConsentSnapshot }> {
  const published = await loadPublishedFormTerms(tx, tenantId, eventId);
  return {
    published,
    snapshot: buildConsentSnapshot(published, input),
  };
}

export function buildConsentSnapshot(
  published: PublishedFormTerms,
  input: RedeemFormInput,
): ConsentSnapshot {
  const publishedForm = published.form;
  const publishedTermsVersion = published.termsVersion;

  if (publishedForm) {
    const clientVersion = input.formVersion?.trim() ?? '';
    if (!clientVersion) {
      throw new IssueError(
        ISSUE_ERROR_CODES.FORM_REQUIRED,
        'Published form version is required',
      );
    }
    if (clientVersion !== publishedForm.formVersion) {
      throw new IssueError(
        ISSUE_ERROR_CODES.FORM_VERSION_STALE,
        'Form version is stale; reload published form',
      );
    }
  } else if (input.formVersion?.trim()) {
    // Client sent a version but event has no published form.
    throw new IssueError(
      ISSUE_ERROR_CODES.FORM_VERSION_STALE,
      'Form version is stale; reload published form',
    );
  }

  if (publishedTermsVersion) {
    const clientTerms = input.termsVersion?.trim() ?? '';
    if (!clientTerms) {
      throw new IssueError(
        ISSUE_ERROR_CODES.TERMS_REQUIRED,
        'Published terms version is required',
      );
    }
    if (clientTerms !== publishedTermsVersion) {
      throw new IssueError(
        ISSUE_ERROR_CODES.TERMS_VERSION_STALE,
        'Terms version is stale; re-consent required',
      );
    }
    if (input.termsAccepted !== true) {
      throw new IssueError(
        ISSUE_ERROR_CODES.TERMS_REQUIRED,
        'Terms must be accepted',
      );
    }
  } else if (input.termsVersion?.trim()) {
    throw new IssueError(
      ISSUE_ERROR_CODES.TERMS_VERSION_STALE,
      'Terms version is stale; re-consent required',
    );
  }

  const definition: FormDefinition | null = publishedForm;
  const validated = validateFormAnswers(definition, input.answers);
  if (!validated.ok) {
    throw new IssueError(
      ISSUE_ERROR_CODES.FORM_INVALID,
      'Form answers are invalid',
      false,
      validated.fields,
    );
  }

  const termsAccepted: true | null =
    publishedTermsVersion && input.termsAccepted === true ? true : null;

  return {
    formVersion: publishedForm?.formVersion ?? input.formVersion?.trim() ?? null,
    termsVersion: publishedTermsVersion ?? input.termsVersion?.trim() ?? null,
    termsAccepted,
    answers: canonicalizeAnswers(validated.answers),
    formDefinitionHash: publishedForm
      ? hashFormDefinition(publishedForm)
      : null,
    termsContentHash:
      publishedTermsVersion && published.termsBody != null
        ? hashTermsContent({
            termsVersion: publishedTermsVersion,
            body: published.termsBody,
          })
        : null,
    requiresConsentTimestamp: termsAccepted === true,
  };
}

/** Canonical redeem hash payload fragment (answers + consent). */
export function consentHashFields(snapshot: ConsentSnapshot): {
  formVersion: string | null;
  termsVersion: string | null;
  answers: Record<string, FormAnswerValue>;
  termsAccepted: true | null;
} {
  return {
    formVersion: snapshot.formVersion,
    termsVersion: snapshot.termsVersion,
    answers: snapshot.answers,
    termsAccepted: snapshot.termsAccepted,
  };
}
