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
      className="container mx-auto max-w-3xl space-y-10 p-8 text-ink"
    >
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Design system — slice 1
        </h1>
        <p className="text-sm text-ink/75">
          Live Pulse v2 primitives (`@ticket/ui`). Consumer routes use Tailwind surfaces; marketing neon stays scoped.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Tokens</h2>
        <ul className="grid gap-2 text-sm">
          {Object.entries(VEMOKI_BRAND_COLORS).map(([name, hex]) => (
            <li key={name} className="flex items-center gap-2">
              <span
                className="inline-block size-4 rounded-sm border border-line"
                style={{ background: hex }}
                aria-hidden
              />
              {name}: {hex}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Button</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="attendeePrimary">Attendee primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="lg">Large</Button>
          <Button block className="max-w-xs">Block</Button>
          <Button loading loadingLabel="Đang gửi…">Gửi</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Form</h2>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="ds-code">Mã vé (demo)</Label>
          <Input id="ds-code" name="code" placeholder="VD: DEMO-001" autoComplete="off" />
          <FieldError id="ds-code-error">
            Ví dụ lỗi — nhãn demo, không phải dữ liệu thật.
          </FieldError>
          <Input error placeholder="Trạng thái lỗi" aria-label="Lỗi demo" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Card &amp; Alert</h2>
        <Card>
          <CardHeader>
            <CardTitle>Tiêu đề thẻ</CardTitle>
            <CardDescription>Mô tả ngắn — copy demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert title="Thông báo">Nội dung alert mặc định.</Alert>
            <Alert variant="destructive" className="mt-3">
              Không thể hoàn tác — ví dụ destructive.
            </Alert>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Skeleton</h2>
        <Skeleton className="h-12 w-full max-w-md" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">SurfaceState (legacy classes)</h2>
        <SurfaceState kind="empty" title="Chưa có vé" detail="Demo empty — class khớp prod." />
        <SurfaceState kind="loading" title="Đang tải…" />
      </section>
    </main>
  );
}
