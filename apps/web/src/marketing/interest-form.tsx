'use client';

import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
} from '@ticket/ui';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { t, type CopyKey } from './copy';
import type { MarketingLocale } from './hosts';
import { privacyHref } from './links';
import { trackLeadSubmitted } from './analytics/client';
import {
  validateInterest,
  type InterestFieldError,
} from './interest-validate-client';

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
      org_kind: fd.get('org_kind'),
      events_per_year: fd.get('events_per_year'),
      typical_scale: fd.get('typical_scale'),
      locale,
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
      trackLeadSubmitted();
      setState('success');
    } catch {
      setBanner(t(locale, 'interest.error.generic'));
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <Alert
        className="mkt-banner mkt-banner-success"
        variant="default"
        data-testid="interest-success"
      >
        <strong>{t(locale, 'interest.success.title')}</strong>
        <p>{t(locale, 'interest.success.body')}</p>
      </Alert>
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
        <Alert className="mkt-banner mkt-banner-error" variant="destructive">
          <p>{banner}</p>
          <Button
            type="submit"
            variant="secondary"
            className="mkt-btn mkt-btn-secondary"
            disabled={busy}
          >
            {t(locale, 'interest.retry')}
          </Button>
        </Alert>
      ) : null}

      <label className="mkt-hp" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" name="website" type="text" />
      </label>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-name`}>{t(locale, 'interest.name')}</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          autoComplete="name"
          required
          disabled={busy}
          error={Boolean(fieldErrors.name)}
          className="mkt-input"
          aria-describedby={fieldErrors.name ? `${formId}-err-name` : undefined}
        />
        <FieldError id={`${formId}-err-name`} className="mkt-field-error">
          {fieldErrors.name}
        </FieldError>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-email`}>{t(locale, 'interest.email')}</Label>
        <Input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          error={Boolean(fieldErrors.email || fieldErrors.emailInvalid)}
          className="mkt-input"
          aria-describedby={
            fieldErrors.email || fieldErrors.emailInvalid
              ? `${formId}-err-email`
              : undefined
          }
        />
        <FieldError id={`${formId}-err-email`} className="mkt-field-error">
          {fieldErrors.email || fieldErrors.emailInvalid}
        </FieldError>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-org`}>{t(locale, 'interest.org')}</Label>
        <Input
          id={`${formId}-org`}
          name="org"
          autoComplete="organization"
          required
          disabled={busy}
          error={Boolean(fieldErrors.org)}
          className="mkt-input"
          aria-describedby={fieldErrors.org ? `${formId}-err-org` : undefined}
        />
        <FieldError id={`${formId}-err-org`} className="mkt-field-error">
          {fieldErrors.org}
        </FieldError>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-role`}>{t(locale, 'interest.role')}</Label>
        <select
          id={`${formId}-role`}
          name="role"
          required
          disabled={busy}
          defaultValue=""
          className="mkt-input"
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
        <FieldError id={`${formId}-err-role`} className="mkt-field-error">
          {fieldErrors.role}
        </FieldError>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-org-kind`}>
          {t(locale, 'interest.org_kind')}
        </Label>
        <select
          id={`${formId}-org-kind`}
          name="org_kind"
          disabled={busy}
          defaultValue=""
          className="mkt-input"
        >
          <option value="">{t(locale, 'interest.org_kind.placeholder')}</option>
          <option value="agency">
            {t(locale, 'interest.org_kind.agency')}
          </option>
          <option value="brand_enterprise">
            {t(locale, 'interest.org_kind.brand_enterprise')}
          </option>
          <option value="venue">{t(locale, 'interest.org_kind.venue')}</option>
          <option value="independent">
            {t(locale, 'interest.org_kind.independent')}
          </option>
          <option value="other">{t(locale, 'interest.org_kind.other')}</option>
        </select>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-events`}>
          {t(locale, 'interest.events_per_year')}
        </Label>
        <select
          id={`${formId}-events`}
          name="events_per_year"
          disabled={busy}
          defaultValue=""
          className="mkt-input"
        >
          <option value="">
            {t(locale, 'interest.events_per_year.placeholder')}
          </option>
          <option value="0">{t(locale, 'interest.events_per_year.0')}</option>
          <option value="1-5">
            {t(locale, 'interest.events_per_year.1-5')}
          </option>
          <option value="6-20">
            {t(locale, 'interest.events_per_year.6-20')}
          </option>
          <option value="21+">{t(locale, 'interest.events_per_year.21+')}</option>
        </select>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-scale`}>
          {t(locale, 'interest.typical_scale')}
        </Label>
        <select
          id={`${formId}-scale`}
          name="typical_scale"
          disabled={busy}
          defaultValue=""
          className="mkt-input"
        >
          <option value="">
            {t(locale, 'interest.typical_scale.placeholder')}
          </option>
          <option value="under_500">
            {t(locale, 'interest.typical_scale.under_500')}
          </option>
          <option value="500_2000">
            {t(locale, 'interest.typical_scale.500_2000')}
          </option>
          <option value="2000_10000">
            {t(locale, 'interest.typical_scale.2000_10000')}
          </option>
          <option value="over_10000">
            {t(locale, 'interest.typical_scale.over_10000')}
          </option>
        </select>
      </div>

      <div className="mkt-form-field">
        <Label htmlFor={`${formId}-note`}>{t(locale, 'interest.note')}</Label>
        <textarea
          id={`${formId}-note`}
          name="note"
          disabled={busy}
          className="mkt-input"
        />
      </div>

      <div className="mkt-consent mkt-form-field">
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
        <Label htmlFor={`${formId}-consent`} className="mkt-consent-label">
          {t(locale, 'interest.consent.before')}{' '}
          <Link href={privacyHref(locale)}>
            {t(locale, 'interest.consent.privacy')}
          </Link>
          .
        </Label>
      </div>
      <FieldError id={`${formId}-err-consent`} className="mkt-field-error">
        {fieldErrors.consent}
      </FieldError>

      <Button
        type="submit"
        disabled={busy}
        loading={busy}
        className="mkt-btn mkt-btn-primary"
        data-testid="interest-submit"
      >
        {busy ? t(locale, 'interest.sending') : t(locale, 'interest.submit')}
      </Button>
    </form>
  );
}
