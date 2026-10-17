'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { t, type CopyKey } from './copy';
import type { MarketingLocale } from './hosts';
import { privacyHref } from './links';
import {
  validateInterest,
  type InterestFieldError,
} from './interest-validate';

type FormState = 'empty' | 'loading' | 'error' | 'success';

const FIELD_ERROR_KEY: Record<InterestFieldError, CopyKey> = {
  name: 'interest.error.name',
  email: 'interest.error.email',
  emailInvalid: 'interest.error.emailInvalid',
  org: 'interest.error.org',
  role: 'interest.error.role',
  consent: 'interest.error.consent',
};

export function InterestForm({ locale }: { locale: MarketingLocale }) {
  const formId = useId();
  const [state, setState] = useState<FormState>('empty');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<InterestFieldError, string>>
  >({});
  const [banner, setBanner] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    const fd = new FormData(event.currentTarget);
    const input = {
      name: fd.get('name'),
      email: fd.get('email'),
      org: fd.get('org'),
      role: fd.get('role'),
      note: fd.get('note'),
      consent: fd.get('consent'),
      website: fd.get('website'),
    };
    const result = validateInterest(input);
    if (!result.ok) {
      if (result.honeypot) {
        setState('success');
        return;
      }
      const next: Partial<Record<InterestFieldError, string>> = {};
      for (const f of result.fields) {
        next[f] = t(locale, FIELD_ERROR_KEY[f]);
      }
      setFieldErrors(next);
      setState('error');
      const first = result.fields[0];
      if (first) {
        const focusId =
          first === 'emailInvalid' ? `${formId}-email` : `${formId}-${first}`;
        document.getElementById(focusId)?.focus();
      }
      return;
    }

    setFieldErrors({});
    setState('loading');
    try {
      const res = await fetch('/api/marketing/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result.value),
      });
      if (!res.ok) {
        setBanner(t(locale, 'interest.error.generic'));
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setBanner(t(locale, 'interest.error.generic'));
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div
        className="mkt-banner mkt-banner-success"
        role="status"
        aria-live="polite"
        data-testid="interest-success"
      >
        <strong>{t(locale, 'interest.success.title')}</strong>
        <p>{t(locale, 'interest.success.body')}</p>
      </div>
    );
  }

  const busy = state === 'loading';

  return (
    <form
      className="mkt-form"
      id="interest-form"
      onSubmit={onSubmit}
      noValidate
      data-testid="interest-form"
      aria-busy={busy}
    >
      {banner ? (
        <div className="mkt-banner mkt-banner-error" role="alert">
          <p>{banner}</p>
          <button
            type="submit"
            className="mkt-btn mkt-btn-secondary"
            disabled={busy}
          >
            {t(locale, 'interest.retry')}
          </button>
        </div>
      ) : null}

      {/* Honeypot */}
      <label className="mkt-hp" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          name="website"
          type="text"
        />
      </label>

      <label>
        {t(locale, 'interest.name')}
        <input
          id={`${formId}-name`}
          name="name"
          autoComplete="name"
          required
          disabled={busy}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={
            fieldErrors.name ? `${formId}-err-name` : undefined
          }
        />
        {fieldErrors.name ? (
          <span className="mkt-field-error" id={`${formId}-err-name`}>
            {fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label>
        {t(locale, 'interest.email')}
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          aria-invalid={
            fieldErrors.email || fieldErrors.emailInvalid ? true : undefined
          }
          aria-describedby={
            fieldErrors.email || fieldErrors.emailInvalid
              ? `${formId}-err-email`
              : undefined
          }
        />
        {fieldErrors.email || fieldErrors.emailInvalid ? (
          <span className="mkt-field-error" id={`${formId}-err-email`}>
            {fieldErrors.email || fieldErrors.emailInvalid}
          </span>
        ) : null}
      </label>

      <label>
        {t(locale, 'interest.org')}
        <input
          id={`${formId}-org`}
          name="org"
          autoComplete="organization"
          required
          disabled={busy}
          aria-invalid={fieldErrors.org ? true : undefined}
          aria-describedby={fieldErrors.org ? `${formId}-err-org` : undefined}
        />
        {fieldErrors.org ? (
          <span className="mkt-field-error" id={`${formId}-err-org`}>
            {fieldErrors.org}
          </span>
        ) : null}
      </label>

      <label>
        {t(locale, 'interest.role')}
        <select
          id={`${formId}-role`}
          name="role"
          required
          disabled={busy}
          defaultValue=""
          aria-invalid={fieldErrors.role ? true : undefined}
          aria-describedby={
            fieldErrors.role ? `${formId}-err-role` : undefined
          }
        >
          <option value="" disabled>
            {t(locale, 'interest.role.placeholder')}
          </option>
          <option value="owner">{t(locale, 'interest.role.owner')}</option>
          <option value="agency">{t(locale, 'interest.role.agency')}</option>
          <option value="other">{t(locale, 'interest.role.other')}</option>
        </select>
        {fieldErrors.role ? (
          <span className="mkt-field-error" id={`${formId}-err-role`}>
            {fieldErrors.role}
          </span>
        ) : null}
      </label>

      <label>
        {t(locale, 'interest.note')}
        <textarea id={`${formId}-note`} name="note" disabled={busy} />
      </label>

      <label className="mkt-consent">
        <input
          id={`${formId}-consent`}
          name="consent"
          type="checkbox"
          value="true"
          required
          disabled={busy}
          aria-invalid={fieldErrors.consent ? true : undefined}
          aria-describedby={
            fieldErrors.consent ? `${formId}-err-consent` : undefined
          }
        />
        <span>
          {t(locale, 'interest.consent.before')}{' '}
          <Link href={privacyHref(locale)}>
            {t(locale, 'interest.consent.privacy')}
          </Link>
          .
        </span>
      </label>
      {fieldErrors.consent ? (
        <span className="mkt-field-error" id={`${formId}-err-consent`}>
          {fieldErrors.consent}
        </span>
      ) : null}

      <button
        className="mkt-btn mkt-btn-primary"
        type="submit"
        disabled={busy}
        data-testid="interest-submit"
      >
        {busy ? t(locale, 'interest.sending') : t(locale, 'interest.submit')}
      </button>
    </form>
  );
}
