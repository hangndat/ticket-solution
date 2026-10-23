/**
 * Shared sanitized config renderer — text nodes only, no arbitrary HTML/CSS/JS.
 */

import type { CSSProperties } from 'react';
import type {
  EventConfigPayload,
  EventContentSection,
} from '@ticket/contracts';
import {
  escapeText,
  visibleSectionsInOrder,
  type AllowlistedSectionBody,
} from '../content/config-schema';

export type ConfigRendererProps = {
  payload: EventConfigPayload;
  /** Optional heading for the preview region. */
  headingId?: string;
  className?: string;
  /** When true, mark as protected admin preview (no-store). */
  protectedPreview?: boolean;
  versionLabel?: string | null;
};

function sectionTitle(section: EventContentSection): string {
  const body = section.body as AllowlistedSectionBody;
  return body.title?.trim() || section.kind;
}

function Plain({ text }: { text: string }) {
  // React text nodes are escaped by the runtime — never dangerouslySetInnerHTML.
  return <>{text}</>;
}

function SectionBlock({ section }: { section: EventContentSection }) {
  const body = section.body as AllowlistedSectionBody;
  const title = sectionTitle(section);
  const headingId = `cfg-section-${section.id}`;

  if (section.kind === 'faq') {
    const items = body.items ?? [];
    return (
      <section
        className="cfg-section cfg-section-faq"
        aria-labelledby={headingId}
        data-section-kind="faq"
        data-section-id={section.id}
      >
        <h3 id={headingId}>
          <Plain text={title} />
        </h3>
        {items.length === 0 ? (
          <p className="cfg-muted">Chưa có câu hỏi.</p>
        ) : (
          <dl>
            {items.map((item, index) => (
              <div key={`${section.id}-faq-${index}`}>
                <dt>
                  <Plain text={item.question} />
                </dt>
                <dd>
                  <Plain text={item.answer} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }

  if (section.kind === 'terms') {
    return (
      <section
        className="cfg-section cfg-section-terms"
        aria-labelledby={headingId}
        data-section-kind="terms"
        data-section-id={section.id}
      >
        <h3 id={headingId}>
          <Plain text={title} />
        </h3>
        {body.termsVersion ? (
          <p className="cfg-meta">
            Phiên bản điều khoản:{' '}
            <code>
              <Plain text={body.termsVersion} />
            </code>
          </p>
        ) : null}
        {body.text ? (
          <p>
            <Plain text={body.text} />
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={`cfg-section cfg-section-${section.kind}`}
      aria-labelledby={headingId}
      data-section-kind={section.kind}
      data-section-id={section.id}
    >
      <h3 id={headingId}>
        <Plain text={title} />
      </h3>
      {body.text ? (
        <p>
          <Plain text={body.text} />
        </p>
      ) : null}
    </section>
  );
}

/**
 * Render visible sections in order with brand color as CSS variable only
 * (allowlisted hex already validated — never inject raw style strings from body).
 */
export function ConfigRenderer({
  payload,
  headingId = 'config-preview-heading',
  className = 'cfg-preview',
  protectedPreview = false,
  versionLabel = null,
}: ConfigRendererProps) {
  const sections = visibleSectionsInOrder(payload);
  const style = {
    ['--cfg-brand' as string]: payload.brand.primaryColor,
  } as CSSProperties;

  return (
    <article
      className={className}
      style={style}
      aria-labelledby={headingId}
      data-testid="config-rendered-preview"
      data-cache-control="no-store"
      data-protected={protectedPreview ? 'true' : undefined}
    >
      <header className="cfg-preview-header">
        <p className="cfg-brand-org">
          <Plain text={payload.brand.organizationName || '—'} />
        </p>
        {payload.brand.logoAssetId ? (
          <p className="cfg-meta">
            Logo asset:{' '}
            <code>
              <Plain text={payload.brand.logoAssetId} />
            </code>
          </p>
        ) : null}
        {payload.brand.bannerAssetId ? (
          <p className="cfg-meta">
            Banner asset:{' '}
            <code>
              <Plain text={payload.brand.bannerAssetId} />
            </code>
          </p>
        ) : null}
        {versionLabel ? (
          <p className="cfg-meta" role="status">
            {versionLabel}
          </p>
        ) : null}
        {protectedPreview ? (
          <p className="cfg-meta" role="note">
            Preview xác thực · Cache-Control: no-store
          </p>
        ) : null}
      </header>
      <h2 id={headingId} className="cfg-sr-only">
        Nội dung cấu hình đã render
      </h2>
      {sections.length === 0 ? (
        <p className="cfg-muted">Không có section nào đang hiện.</p>
      ) : (
        sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))
      )}
    </article>
  );
}

/**
 * Pure string serialization for XSS unit tests — mirrors escape rules.
 * Never used as HTML injection sink.
 */
export function serializePreviewText(payload: EventConfigPayload): string {
  const parts: string[] = [
    escapeText(payload.brand.organizationName),
    escapeText(payload.brand.primaryColor),
  ];
  for (const section of visibleSectionsInOrder(payload)) {
    const body = section.body as AllowlistedSectionBody;
    if (body.title) parts.push(escapeText(body.title));
    if (body.text) parts.push(escapeText(body.text));
    if (body.termsVersion) parts.push(escapeText(body.termsVersion));
    for (const item of body.items ?? []) {
      parts.push(escapeText(item.question), escapeText(item.answer));
    }
  }
  return parts.join('\n');
}
