import Link from 'next/link';
import { BrandMark } from '../src/brand-mark';
import { SiteNav } from '../src/site-chrome';
import { demoEventRoutes, findDemoEvent, demoEventHref } from '../src/events';
import { SurfaceState } from '../src/ui/surface-state';

export default function Home() {
  return (
    <main id="main" className="container home">
      <SiteNav variant="guest" />
      <section className="home-hero" aria-labelledby="home-title">
        <p className="wordmark-hero" aria-hidden="true">
          <BrandMark />
          vemoki<span>↗</span>
        </p>
        <h1 id="home-title">Điều tốt đẹp đưa chúng ta lại gần.</h1>
        <p className="intro">
          Đổi mã lấy vé, nhận lời mời, hoặc xem sự kiện demo mang nhãn rõ — một
          thương hiệu, không chrome thử nghiệm trên đường khách.
        </p>
        <p className="home-cta">
          <Link className="button" href="/redeem">
            Đổi mã lấy vé
          </Link>
        </p>
      </section>
      {demoEventRoutes().length === 0 ? (
        <SurfaceState
          kind="empty"
          title="Chưa có sự kiện demo"
          detail="Fixture demo chưa sẵn sàng. Đổi mã thật vẫn dùng được tại Đổi mã."
          testId="home-events-empty"
        />
      ) : (
        <div className="event-list" role="list">
          {demoEventRoutes().map((route) => {
            const event = findDemoEvent(route.tenantSlug, route.eventSlug)!;
            return (
              <Link
                className="event-row"
                href={demoEventHref(event)}
                key={event.id}
                role="listitem"
              >
                <span className="eyebrow">
                  {event.brand.organizationName} · Demo
                </span>
                <h2>{event.name}</h2>
                <p>{event.category}</p>
                <span className="card-action">
                  Xem sự kiện demo <span aria-hidden="true">↗</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <aside className="notice" role="note">
        <strong>Demo có giới hạn rõ.</strong> Thư mục sự kiện là fixture hư cấu.
        Đổi mã thật qua Nest BFF tại <Link href="/redeem">Đổi mã</Link>. Đăng
        nhập: <Link href="/auth">/auth</Link>.
      </aside>
    </main>
  );
}
