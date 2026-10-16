import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  demoEventRoutes,
  findDemoEvent,
  formatEventDate,
} from '../../../../../src/events';

type Props = { params: Promise<{ tenantSlug: string; eventSlug: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return demoEventRoutes();
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenantSlug, eventSlug } = await params;
  const event = findDemoEvent(tenantSlug, eventSlug);
  if (!event) notFound();
  return {
    title: `${event.name} — ${event.brand.organizationName}`,
    description: `Fictional demo event by ${event.brand.organizationName}. ${event.description}`,
  };
}
export default async function EventPage({ params }: Props) {
  const { tenantSlug, eventSlug } = await params;
  const event = findDemoEvent(tenantSlug, eventSlug);
  if (!event) notFound();
  return (
    <main
      id="main"
      className={`event-page ${event.theme}`}
      style={{ '--brand': event.brand.primaryColor } as CSSProperties}
    >
      <div className="container">
        <nav aria-label="Event navigation">
          <Link href="/" aria-label="All demo events">
            ticket ↗
          </Link>
          <span>{event.brand.organizationName}</span>
        </nav>
        <p className="demo-label">FICTIONAL EVENT / DEMO FIXTURE</p>
        <section className="hero" aria-labelledby="event-title">
          <div>
            <p className="eyebrow">{event.category}</p>
            <h1 id="event-title">{event.name}</h1>
            <p className="intro">{event.description}</p>
            <a className="button" href="#event-details">
              Discover the day <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="poster" aria-hidden="true">
            <span className="poster-orbit" />
            <span className="poster-word">
              {event.theme === 'festival'
                ? 'FEEL THE FUN.'
                : 'NEW POINTS OF VIEW.'}
            </span>
            <span className="poster-caption">
              {event.brand.organizationName} / 2026
            </span>
          </div>
        </section>
        <section
          id="event-details"
          className="details"
          aria-labelledby="details-title"
        >
          <h2 id="details-title">Plan your day.</h2>
          <dl>
            <div>
              <dt>When</dt>
              <dd>
                <time dateTime={event.startsAt}>{formatEventDate(event)}</time>
                <small>{event.timezone}</small>
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>Hosted by</dt>
              <dd>{event.brand.organizationName}</dd>
            </div>
          </dl>
        </section>
        <section className="highlights" aria-labelledby="highlights-title">
          <p className="eyebrow">A TASTE OF WHAT’S AHEAD</p>
          <h2 id="highlights-title">Come curious.</h2>
          <ul>
            {event.highlights.map((highlight, index) => (
              <li key={highlight}>
                <span aria-hidden="true">0{index + 1}</span>
                {highlight}
              </li>
            ))}
          </ul>
        </section>
        <aside className="notice">
          <h2>Demo preview only</h2>
          <p>
            This is fictional fixture content, not a live event listing.
            Registration, code redemption, tickets and Gate check-in are not
            available.
          </p>
        </aside>
        <section className="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Before you go</h2>
          <details>
            <summary>Can I get a ticket here?</summary>
            <p>
              No. This W0 preview demonstrates public event information only. It
              does not accept codes, personal details or payments.
            </p>
          </details>
          <details>
            <summary>Are the date and venue confirmed?</summary>
            <p>No. All details on this page are fictional demo fixtures.</p>
          </details>
        </section>
        <Link className="back-link" href="/">
          ← All demo events
        </Link>
      </div>
    </main>
  );
}
