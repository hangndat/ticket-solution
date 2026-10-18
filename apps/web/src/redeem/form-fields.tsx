'use client';

import type { FormAnswerValue, FormDefinition } from '@ticket/contracts';

type Props = {
  definition: FormDefinition;
  answers: Record<string, FormAnswerValue>;
  fieldErrors: Record<string, string>;
  disabled?: boolean;
  onChange: (fieldId: string, value: FormAnswerValue) => void;
};

export function RedeemFormFields({
  definition,
  answers,
  fieldErrors,
  disabled,
  onChange,
}: Props) {
  return (
    <fieldset className="redeem-published-fields" disabled={disabled}>
      <legend>Biểu mẫu sự kiện</legend>
      {definition.fields.map((field) => {
        const error = fieldErrors[field.id];
        const errorId = error ? `field-error-${field.id}` : undefined;
        const inputId = `field-${field.id}`;
        const value = answers[field.id];

        if (field.type === 'checkbox') {
          return (
            <div key={field.id} className="redeem-field">
              <label className="redeem-checkbox" htmlFor={inputId}>
                <input
                  id={inputId}
                  name={field.id}
                  type="checkbox"
                  checked={value === true}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={errorId}
                  onChange={(e) => onChange(field.id, e.target.checked)}
                />
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
              </label>
              {error ? (
                <p id={errorId} className="redeem-field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }

        if (field.type === 'select') {
          return (
            <div key={field.id} className="redeem-field">
              <label htmlFor={inputId}>
                {field.label}
                {field.required ? ' *' : ''}
                <select
                  id={inputId}
                  name={field.id}
                  required={field.required}
                  value={typeof value === 'string' ? value : ''}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={errorId}
                  onChange={(e) => onChange(field.id, e.target.value)}
                >
                  <option value="">— Chọn —</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <p id={errorId} className="redeem-field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }

        const inputType =
          field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text';

        return (
          <div key={field.id} className="redeem-field">
            <label htmlFor={inputId}>
              {field.label}
              {field.required ? ' *' : ''}
              <input
                id={inputId}
                name={field.id}
                type={inputType}
                required={field.required}
                value={typeof value === 'string' ? value : ''}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}
                onChange={(e) => onChange(field.id, e.target.value)}
              />
            </label>
            {error ? (
              <p id={errorId} className="redeem-field-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Focus the first invalid field (or terms) for a11y after client/server field errors. */
export function focusFirstFieldError(fieldIds: string[]): void {
  if (typeof document === 'undefined') return;
  for (const id of fieldIds) {
    const el =
      document.getElementById(`field-${id}`) ??
      (id === 'terms' ? document.getElementById('terms-accepted') : null);
    if (el && 'focus' in el) {
      (el as HTMLElement).focus();
      return;
    }
  }
}
