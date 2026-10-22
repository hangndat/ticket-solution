'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';

type Props = {
  termsVersion: string;
  termsBody: string | null;
  termsAccepted: boolean;
  termsError?: string;
  disabled?: boolean;
  /** Public event page for full terms copy (product chrome). */
  termsHref?: string | null;
  compact?: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

export function RedeemTermsConsent({
  termsVersion,
  termsBody,
  termsAccepted,
  termsError,
  disabled,
  termsHref,
  compact = false,
  onAcceptedChange,
}: Props) {
  return (
    <fieldset className="redeem-terms" data-testid="redeem-terms-consent">
      <legend>Điều khoản</legend>
      {termsBody ? (
        <>
          <p className="redeem-schema-notice">
            Nội dung dưới đây do ban tổ chức ban hành (có thể khác ngôn ngữ giao
            diện).
          </p>
          <pre className="redeem-terms-body" tabIndex={0}>
            {termsBody}
          </pre>
        </>
      ) : termsHref ? (
        <p className="redeem-schema-notice">
          <Button asChild variant="link">
            <Link href={termsHref}>Đọc điều khoản sự kiện (bản {termsVersion})</Link>
          </Button>
        </p>
      ) : (
        <p className="redeem-schema-notice">
          Phiên bản điều khoản: <strong>{termsVersion}</strong>
        </p>
      )}
      <label className="redeem-checkbox" htmlFor="terms-accepted">
        <input
          id="terms-accepted"
          name="termsAccepted"
          type="checkbox"
          checked={termsAccepted}
          disabled={disabled}
          aria-invalid={termsError ? true : undefined}
          aria-describedby={termsError ? 'field-error-terms' : undefined}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span>
          {compact
            ? 'Tôi đã đọc và đồng ý điều khoản sự kiện'
            : 'Tôi đồng ý với điều khoản'}
        </span>
      </label>
      {termsError ? (
        <p id="field-error-terms" className="redeem-field-error" role="alert">
          {termsError}
        </p>
      ) : null}
    </fieldset>
  );
}
