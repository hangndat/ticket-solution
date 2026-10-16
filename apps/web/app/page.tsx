import Link from 'next/link';
import { demoEventRoutes, findDemoEvent, demoEventHref } from '../src/events';

export default function Home() {
  return (
    <main id="main" className="container home">
      <nav aria-label="Main navigation">
        <span className="wordmark">
          ticket<span>↗</span>
        </span>
        <Link href="/admin">Admin shell</Link>
      </nav>
      <p className="eyebrow">W0 FOUNDATION / DEMO DIRECTORY</p>
      <h1>
        Good things
        <br />
        bring us together.
      </h1>
      <p className="intro">
        Two organizations. Two distinct experiences. Explore the public event
        shell with fictional fixture content.
      </p>
      <div className="event-grid">
        {demoEventRoutes().map((route) => {
          const event = findDemoEvent(route.tenantSlug, route.eventSlug)!;
          return (
            <Link
              className={`event-card ${event.theme}`}
              href={demoEventHref(event)}
              key={event.id}
            >
              <span className="eyebrow">
                {event.brand.organizationName} / DEMO
              </span>
              <h2>{event.name}</h2>
              <p>{event.category}</p>
              <span className="card-action">
                Explore demo event <span aria-hidden="true">↗</span>
              </span>
            </Link>
          );
        })}
      </div>
      <aside className="notice">
        <strong>Preview, with clear limits.</strong> All event details are
        fictional. Authentication, redemption, ticket issuance and Gate check-in
        are not implemented.
      </aside>
    </main>
  );
}
