import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldError,
  Input,
  Label,
  Skeleton,
  SurfaceState,
  VEMOKI_BRAND_COLORS,
} from '@ticket/ui';

export const metadata: Metadata = {
  title: 'Design system (dev)',
  robots: { index: false, follow: false },
};

/** Internal preview — not linked from prod chrome; 404 in production builds. */
export default function DevDesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main
      id="main"
      className="container ui:mx-auto ui:max-w-3xl ui:space-y-10 ui:p-8 ui:text-ink"
    >
      <header className="ui:space-y-2">
        <h1 className="ui:font-display ui:text-2xl ui:font-bold ui:tracking-tight">
          Design system — slice 1
        </h1>
        <p className="ui:text-sm ui:text-ink/75">
          Live Pulse v2 primitives (`@ticket/ui`). Prod routes still use legacy CSS until migrated.
        </p>
      </header>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">Tokens</h2>
        <ul className="ui:grid ui:gap-2 ui:text-sm">
          {Object.entries(VEMOKI_BRAND_COLORS).map(([name, hex]) => (
            <li key={name} className="ui:flex ui:items-center ui:gap-2">
              <span
                className="ui:inline-block ui:size-4 ui:rounded-sm ui:border ui:border-line"
                style={{ background: hex }}
                aria-hidden
              />
              {name}: {hex}
            </li>
          ))}
        </ul>
      </section>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">Button</h2>
        <div className="ui:flex ui:flex-wrap ui:gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button loading loadingLabel="Đang gửi…">Gửi</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">Form</h2>
        <div className="ui:max-w-sm ui:space-y-2">
          <Label htmlFor="ds-code">Mã vé (demo)</Label>
          <Input id="ds-code" name="code" placeholder="VD: DEMO-001" autoComplete="off" />
          <FieldError id="ds-code-error">
            Ví dụ lỗi — nhãn demo, không phải dữ liệu thật.
          </FieldError>
          <Input error placeholder="Trạng thái lỗi" aria-label="Lỗi demo" />
        </div>
      </section>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">Card &amp; Alert</h2>
        <Card>
          <CardHeader>
            <CardTitle>Tiêu đề thẻ</CardTitle>
            <CardDescription>Mô tả ngắn — copy demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert title="Thông báo">Nội dung alert mặc định.</Alert>
            <Alert variant="destructive" className="ui:mt-3">
              Không thể hoàn tác — ví dụ destructive.
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">Skeleton</h2>
        <Skeleton className="ui:h-12 ui:w-full ui:max-w-md" />
      </section>

      <section className="ui:space-y-3">
        <h2 className="ui:font-display ui:text-lg ui:font-semibold">SurfaceState (legacy classes)</h2>
        <SurfaceState kind="empty" title="Chưa có vé" detail="Demo empty — class khớp prod." />
        <SurfaceState kind="loading" title="Đang tải…" />
      </section>
    </main>
  );
}
