# MKT-BA — Analytics, qualified lead, privacy & CRM handoff (marketing / O13)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-22 |
| Role | `product-ba` |
| Epic | [#770](https://github.com/hangndat/ticket-solution/issues/770) — marketing site |
| Cost tier | standard |
| Loại | **Docs-only** — không sửa `apps/*`, không commit/push từ task này |
| Căn cứ | [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](../plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md), [DECISION-LOG O13/O06](../DECISION-LOG.md), [O06-OPTIONS](../ops/O06-OPTIONS.md), [RELEASE-CHECKLIST](../ops/RELEASE-CHECKLIST.md), [o13-platform-sales](../design/o13-platform-sales/) (Live Pulse v2), `apps/web/src/marketing/interest-validate.ts`, `interest-form.tsx`, `interest-store.ts`, `app/api/marketing/interest/route.ts` |
| Quyết định user (session) | Giữ **Live Pulse v2**; định vị **Event Operating System** cho **event agency + enterprise**; IA 8 section (Hero/Product Preview, Trust, Feature Bento, How It Works, Solutions by Audience, Business Outcomes, FAQ, Conversion CTA/Footer); demo metrics có nhãn; không testimonial/logo khách giả; không claim capacity/SLA chưa evidence; giữ anti-marketplace/ops O13 |

**Mục tiêu:** Chuẩn hóa đo lường funnel marketing, định nghĩa qualified lead minh bạch, privacy-first telemetry, hợp đồng server `LeadSink`, và KPI vận hành — để web/backend implement sau PD/ architect mà không mâu thuẫn O13/O06.

---

## 0. Tóm tắt điều hành / Executive summary

**VI:** Trang bán `vemoki.com` cần funnel first-party: click CTA → bắt đầu form → nộp → lead lưu JSONL (+ webhook tùy chọn). Analytics **không** chứa email/tên; qualified lead chấm trên server từ payload form (và vài field bổ sung tối thiểu). CRM qua interface `LeadSink` — JSONL là nguồn sự thật; webhook/HubSpot/n8n/Sheet là adapter; lỗi CRM không được trả success cho user.

**EN:** The marketing site needs a first-party funnel: CTA clicks → form start → submit → durable lead (JSONL + optional webhook). Analytics must not carry email/name; qualified-lead scoring runs server-side from form fields (plus a small set of optional fields). CRM integrates via a `LeadSink` contract — JSONL remains source of truth; webhook/HubSpot/n8n/Sheet are adapters; CRM failure must not fake success to the user.

---

## 1. Phạm vi & nguyên tắc / Scope & principles

| Nguyên tắc | VI | EN |
| ---------- | -- | -- |
| Positioning | Event OS cho agency + enterprise in-person; không marketplace | Event OS for agencies + enterprises; not a marketplace |
| GTM surface | 8 sections (hash `section` ổn định cho analytics) | Same section IDs for analytics |
| Demo / metrics UI | Nhãn «giả lập / simulated»; không số capacity/SLA chưa drill | Label simulated; no unproven capacity/SLA claims ([RELEASE-CHECKLIST](../ops/RELEASE-CHECKLIST.md) «Cấm») |
| PII boundary | Form POST = PII → JSONL + CRM; analytics event = **không** PII | Form = PII stores; analytics = **no** PII |
| Consent | Checkbox form = liên hệ sales; analytics riêng — tắt theo DNT/GPC; không ad SDK MVP | Interest checkbox ≠ product analytics consent model; respect DNT/GPC; no ad SDK in MVP |
| Retention | Marketing interest JSONL: đề xuất **24 tháng** hoặc đến khi xóa theo yêu cầu — **ghi rõ** trong privacy khi deploy; khớp tinh thần O06 (không bịa số khác) | Align new retention line with O06; document on `/privacy` before prod |

**Section IDs (analytics `section` / `page_section`) — map IA user 8 block:**

| `section_id` | VI (trang) | EN |
| ------------ | ---------- | -- |
| `hero` | Hero / Product Preview | Hero / Product Preview |
| `trust` | Trust | Trust |
| `features` | Feature Bento Grid | Feature Bento Grid |
| `how_it_works` | How It Works | How It Works |
| `solutions` | Solutions by Audience | Solutions by Audience |
| `outcomes` | Business Outcomes (demo metrics **có nhãn**) | Business Outcomes (labeled demo) |
| `faq` | FAQ | FAQ |
| `conversion` | Conversion CTA / Footer (gồm `#interest`) | Conversion CTA / Footer |

Locale: `vi` \| `en` (path prefix `/` vs `/en`).

---

## 2. Taxonomy sự kiện analytics / Event taxonomy

### 2.1 Bảng sự kiện chuẩn

| Event name | Khi bắn / When | Thuộc tính bắt buộc / Required props | Thuộc tính tuỳ chọn / Optional | Dedupe |
| ---------- | -------------- | ------------------------------------ | -------------------------------- | ------ |
| `cta_click` | User kích hoạt CTA (click, Enter trên link styled as CTA) | `locale`, `section_id`, `cta_id`, `label_key` | `position` (`header` \| `hero` \| `inline` \| `footer`), `href_kind` (`demo` \| `interest` \| `login` \| `external`) | **1 lần / 2s** cùng `(session_id, cta_id, section_id)` |
| `form_start` | Lần đầu focus **hoặc** first input vào `#interest-form` | `locale`, `section_id`=`conversion`, `form_id`=`interest` | `field_first` (`name` \| `email` \| …) — **không** gửi value | **1 / session / form** |
| `form_submit_attempt` | Sau client validation pass, **trước** `fetch` POST | `locale`, `form_id`, `role` (enum only), `has_note` (bool), `note_length_bucket` | `validation_ms` | **1 / 10s** cùng `client_submit_id` |
| `lead_submitted` | Server trả `200` + `{ ok: true }` sau persist JSONL | `locale`, `lead_id` (opaque UUID server), `role`, `qualified` (bool) | `webhook_notified` (bool) | **Idempotent** theo `lead_id` |
| `qualified_lead` | Server chấm điểm ≥ ngưỡng (§3) | `locale`, `lead_id`, `score`, `tier` (`A` \| `B` \| `C`) | `signals` (array enum, không free text) | Cùng `lead_id` tối đa 1 |

**Không** định nghĩa `page_view` trong MVP bắt buộc — có thể thêm sau với cùng transport; funnel ops (§5) vẫn hoạt động nếu chỉ có 5 event trên.

### 2.2 `cta_id` & `label_key` (gợi ý)

| `cta_id` | Mô tả | `label_key` (copy) |
| -------- | ----- | ------------------ |
| `nav_demo` | Nav «Xem demo» | `nav.demo` |
| `nav_interest` | Nav «Đăng ký quan tâm» | `nav.interest` |
| `hero_demo` | Hero primary demo | `hero.cta.demo` |
| `hero_interest` | Hero primary interest | `hero.cta.interest` |
| `hero_login` | Hero secondary login | `hero.cta.login` |
| `repeat_demo` | CTA lặp cuối trang | `cta.repeat.demo` |
| `repeat_interest` | CTA lặp cuối trang | `cta.repeat.interest` |

### 2.3 Payload envelope chung (client → first-party)

```json
{
  "v": 1,
  "event": "cta_click",
  "ts": "2026-10-22T03:48:00.000Z",
  "session_id": "uuid-v4-client",
  "locale": "vi",
  "section_id": "hero",
  "props": { }
}
```

- `session_id`: `sessionStorage` UUID, rotate khi tab đóng.
- **Cấm** trong `props`: `email`, `name`, `org`, `note`, IP client-side, device fingerprint đầy đủ.

### 2.4 Server mirror (khuyến nghị)

- `lead_submitted` và `qualified_lead` chỉ emit **server-side** sau `persistInterestSubmission` (tin cậy hơn client).
- Client có thể gửi `form_submit_attempt` + `cta_click` + `form_start` tới `POST /api/marketing/analytics` (future) hoặc batch beacon — **chỉ khi** consent analytics (§4) cho phép.

### 2.5 Dedupe & chống nhiễu

| Cơ chế | Mục đích |
| ------ | -------- |
| Client dedupe window | Giảm double-fire từ double-click / strict mode |
| Honeypot form | Không analytics success path (đã có server fake `ok` — **không** `lead_submitted`) |
| Rate limit API interest | 8 req / 60s / IP (`route.ts`) — log `RATE_LIMITED`, không `lead_submitted` |
| `client_submit_id` (UUID per submit) | Ghép attempt → server lead |

---

## 3. Qualified lead — tiêu chí & field / Criteria & fields

### 3.1 Hiện trạng form (code)

| Field | Bắt buộc | Giá trị | Ghi chú |
| ----- | -------- | ------- | ------- |
| `name` | Có | string | PII — không vào analytics |
| `email` | Có | string | PII — server có thể hash cho idempotency |
| `org` | Có | string | PII |
| `role` | Có | `owner` \| `agency` \| `other` | Dùng trong scoring |
| `note` | Không | string | PII — chỉ dùng server-side keyword bucket |
| `consent` | Có | `true` | Pháp lý liên hệ |
| `website` | Honeypot | empty | Bot |

### 3.2 Field bổ sung tối thiểu (đề xuất BA)

Thêm **không bắt buộc** để tăng chất lượng lead mà vẫn ngắn:

| Field | UI (VI) | Type | Mục đích scoring |
| ----- | ------- | ---- | ---------------- |
| `org_kind` | Loại tổ chức | `agency` \| `brand_enterprise` \| `venue` \| `independent` \| `other` | ICP agency/enterprise |
| `events_per_year` | Số sự kiện/năm (ước lượng) | `0` \| `1-5` \| `6-20` \| `21+` | Quy mô vận hành |
| `typical_scale` | Quy mô điển hình | `under_500` \| `500_2000` \| `2000_10000` \| `over_10000` | Không claim SLA — chỉ qualify |

**EN labels:** Organization type · Events per year (estimate) · Typical event size (attendees).

Không thu: revenue, budget, số điện thoại (trừ khi O06 + support process mở rộng).

### 3.3 Chấm điểm đơn giản (server-only)

**Ngưỡng:** `qualified_lead` khi **score ≥ 60** (tier A ≥ 80, B 60–79, C &lt; 60).

| Signal | Điểm | Điều kiện |
| ------ | ---- | --------- |
| Role agency | +35 | `role === 'agency'` |
| Role owner | +25 | `role === 'owner'` |
| Org kind enterprise/agency | +20 | `org_kind` in `agency`, `brand_enterprise` |
| Events per year | +15 | `6-20` or `21+` |
| Scale mid+ | +10 | `500_2000` or higher band |
| Note intent (server) | +15 | `note` match regex intent (gate, multi-event, white-label, cổng, agency) — **không** lưu note vào analytics |
| Penalty other role | 0 | `other` — cần combo field khác để đạt 60 |

**Minh bạch:** Lưu `score` + `signals[]` enum (`role_agency`, `events_high`, …) trên record JSONL / CRM — không ML, không dữ liệu nhạy cảm.

**Ví dụ:** Agency + `21+` events + note có «cổng» → 35+15+15 = 65 → qualified tier B.

### 3.4 Khác biệt `lead_submitted` vs `qualified_lead`

- Mọi persist hợp lệ → `lead_submitted`.
- Chỉ subset ICP → `qualified_lead` (+ có thể tag CRM `lifecyclestage` tương đương sau này).

---

## 4. Privacy, consent & đo lường / Privacy-first measurement

### 4.1 Đối chiếu copy hiện tại

Privacy MVP (`copy.ts`): **không SDK quảng cáo / cross-app tracking**; thu form quan tâm + log kỹ thuật (IP, browser, time). O06 đã chốt retention sản phẩm — marketing interest file cần **mục riêng** khi deploy (đề xuất: 24 tháng hoặc xóa theo yêu cầu subject).

### 4.2 Mô hình đề xuất (tôn trọng quyền riêng tư)

```text
┌─────────────┐     consent_analytics?      ┌──────────────────────┐
│  Marketing  │ ─── (banner / settings) ──► │ First-party collect  │
│  page (web) │     DNT/GPC = off           │ POST /api/marketing/ │
└─────────────┘                             │ analytics (aggregated)│
       │                                    └──────────┬───────────┘
       │ form consent (checkbox)                       │
       ▼                                               ▼
┌─────────────┐                             ┌──────────────────────┐
│ Interest    │ ─── PII ──────────────────► │ JSONL + LeadSink     │
│ POST        │     (luôn khi submit OK)    │ (CRM adapters)       │
└─────────────┘                             └──────────────────────┘
```

| Tầng | Dữ liệu | Consent |
| ---- | ------- | ------- |
| A. Interest form | PII business | Checkbox hiện tại + privacy link |
| B. Product analytics (funnel) | Ẩn danh, first-party | Opt-in banner VI/EN; **tắt** nếu `Sec-GPC: 1` hoặc DNT `1` |
| C. Provider tuỳ chọn | Plausible / PostHog self-host / none | Chỉ qua `AnalyticsProvider` interface; **không** load script third-party khi B tắt |

**PII rules:**

- Không gửi email tới analytics; idempotency CRM dùng `sha256(email_normalized)` **chỉ** server-side.
- Không cookie tracking cross-site; `session_id` sessionStorage only.
- Log server interest: giữ `clientKey` IP như hiện tại — ghi trong privacy «log kỹ thuật»; rotate/anonymize IP trong analytics aggregate (đề xuất: truncate /24 sau 30 ngày).

### 4.3 Nội dung cập nhật privacy / consent (draft)

**VI — thêm section «Đo lường trang marketing»:**

- Chúng tôi dùng **cookie/session kỹ thuật tối thiểu** để vận hành trang; **không** dùng SDK quảng cáo.
- **Sự kiện ẩn danh** (ví dụ: nhấn nút, bắt đầu form) chỉ gửi khi bạn **đồng ý** hoặc khi trình duyệt không báo «Không theo dõi» / Global Privacy Control.
- Form «Đăng ký quan tâm» là **đồng ý liên hệ** riêng — không đồng nghĩa bật analytics.
- Dữ liệu form quan tâm: lưu tối đa **[24 tháng / hoặc số O06-aligned]**; xóa theo yêu cầu qua support/privacy email.

**EN — add section «Marketing measurement»:** same substance.

**Consent banner (marketing only):** «Chấp nhận đo lường ẩn danh» / «Anonymous analytics» + «Chỉ cần thiết» / «Essential only» — essential = không gửi B.

### 4.4 Ops alignment (O06)

- Không đưa retention marketing **khác** O06 product mà không ghi DECISION-LOG.
- Deploy `/privacy` cập nhật = task riêng + user/legal duyệt (D11-B1).
- Không ingest lead production cho đến khi RELEASE + privacy gates đủ (O06 §4).

---

## 5. KPI funnel vận hành / Ops funnel KPIs

### 5.1 Định nghĩa metric (daily / weekly)

| KPI | Công thức | Nguồn |
| --- | --------- | ----- |
| CTA CTR (section) | `cta_click` grouped by `section_id`, `cta_id` | Analytics store |
| Form start rate | `form_start` / `cta_click` where `cta_id` contains `interest` | |
| Submit attempt rate | `form_submit_attempt` / `form_start` | |
| Lead capture rate | `lead_submitted` / `form_submit_attempt` | Server |
| Qualified rate | `qualified_lead` / `lead_submitted` | Server |
| Webhook success | `webhook_notified=true` / `lead_submitted` | `interest-store` |
| Error rate | HTTP 4xx/5xx on interest API | Access log |

### 5.2 Dashboard tối thiểu (MVP ops)

| View | Dimension | Ghi chú |
| ---- | --------- | ------- |
| Funnel 7 ngày | locale, section | Không hiển thị PII |
| Lead queue | tier A/B, role, org_kind | Export từ JSONL / CRM |
| Failures | `STORE_FAILED`, webhook errors | Alert nếu &gt; 0 trong 1h |

**Cấm** hiển thị dashboard «50k concurrent» hoặc SLA chưa drill — chỉ funnel thật từ event trên.

### 5.3 Ví dụ bảng tuần (mock structure)

| Tuần | cta_interest | form_start | lead | qualified | qual % |
| ---- | ------------ | ---------- | ---- | --------- | ------ |
| W42 | 120 | 45 | 30 | 18 | 60% |

---

## 6. CRM — hợp đồng `LeadSink` (server)

### 6.1 Vị trí trong kiến trúc

```text
POST /api/marketing/interest
        │
        ├─► validateInterest
        ├─► scoreQualifiedLead (new)
        ├─► LeadSink.persist (JSONL adapter)  ── MUST succeed for 200
        └─► LeadSink.notify* (webhook / future) ── async, retry, non-blocking
```

\* `notify` = optional adapters sau persist.

### 6.2 Interface TypeScript (đề xuất)

```typescript
export type LeadRecord = {
  lead_id: string; // uuid
  at: string; // ISO
  locale: 'vi' | 'en';
  payload: InterestPayload & Partial<ExtendedInterestFields>;
  score: number;
  tier: 'A' | 'B' | 'C';
  qualified: boolean;
  signals: string[];
  idempotency_key: string; // sha256(email|date) or client_submit_id
  source: 'marketing-interest';
  client_key?: string; // IP bucket — not for CRM export
};

export interface LeadSink {
  /** Durably store — failure → reject HTTP */
  persist(record: LeadRecord): Promise<{ path?: string }>;

  /** Optional fan-out — failures logged, retried */
  deliver(record: LeadRecord): Promise<DeliveryResult>;
}

export type DeliveryResult = {
  adapter: string;
  ok: boolean;
  status?: number;
  error?: string;
  attempt: number;
};
```

### 6.3 Idempotency

- Key: `sha256(lowercase(trim(email)) + '|' + utc_date)` **hoặc** header `Idempotency-Key` từ client (UUID).
- Trùng key trong 24h: trả `200` + cùng `lead_id` (không duplicate JSONL line) — **hoặc** upsert line (adapter JSONL: prefer skip duplicate key).

### 6.4 Retry / backoff (notify path)

| Attempt | Delay | Hành vi |
| ------- | ----- | ------- |
| 1 | 0 | Immediate POST webhook |
| 2 | 30s | Background job / queue |
| 3 | 5m | |
| 4 | 30m | |
| 5 | 2h | Sau đó dead-letter log + ops alert |

JSONL **không** retry — single write transactional per request.

### 6.5 Adapters

| Adapter | Trạng thái | Mô tả |
| ------- | ---------- | ----- |
| `jsonl` | **Hiện có** | `appendInterestRecord` → `MARKETING_INTEREST_PATH` |
| `webhook` | **Hiện có** | `MARKETING_INTEREST_WEBHOOK_URL` + `MARKETING_INTEREST_WEBHOOK_SECRET` |
| `hubspot` | Future | Contacts API + custom props `vemoki_score`, `vemoki_tier` |
| `n8n` | Future | Webhook workflow (email Slack, enrich) |
| `google_sheet` | Future | Row append via service account — ops only |

Mapping field CRM (webhook body mở rộng):

```json
{
  "lead_id": "…",
  "name": "…",
  "email": "…",
  "org": "…",
  "role": "agency",
  "note": "…",
  "locale": "vi",
  "qualified": true,
  "score": 65,
  "tier": "B",
  "signals": ["role_agency", "events_high"],
  "at": "2026-10-22T…"
}
```

### 6.6 Failure modes (bắt buộc)

| Tình huống | UX user | Ops |
| ---------- | ------- | --- |
| JSONL / disk fail | **503** `STORE_FAILED` — không success | Alert P2 |
| Webhook down | **200** sau persist — user thấy success | Log + retry queue; **không** báo user lỗi CRM |
| CRM chậm | 200 trong &lt;8s interest path; deliver async | Monitor backlog |
| Rate limit | **429** | Không lead |
| Honeypot | **200** giả — không persist, không analytics lead | — |

**Không báo thành công giả:** chỉ `setState('success')` khi `res.ok` (đã đúng `interest-form.tsx`).

---

## 7. Implementation handoff (không làm trong task BA)

| Slice | Owner | Việc |
| ----- | ----- | ---- |
| Web | `apps/web` | Instrument `cta_click`, `form_start`, `form_submit_attempt`; consent banner; extended form fields + copy VI/EN |
| API | `apps/web` route | `lead_id`, scoring, idempotency; `LeadSink` refactor từ `interest-store.ts` |
| Analytics route | web | `POST /api/marketing/analytics` + JSONL hoặc PG sau |
| Ops | coordinator | Env webhook, backup JSONL, dashboard từ log |
| Legal/PD | user | Duyệt privacy delta §4.3 |

**Test gợi ý:** honeypot không tăng lead count; duplicate idempotency; webhook fail vẫn 200; `STORE_FAILED` → form error UI.

---

## 8. Rủi ro & mở / Risks & open items

| ID | Rủi ro | Giảm thiểu |
| -- | ------ | ----------- |
| R1 | Nhầm form consent vs analytics consent | Copy tách bạch §4.3 |
| R2 | PII rò vào analytics | Schema review + server-only qualified |
| R3 | Mất lead khi chỉ webhook | JSONL bắt buộc trước 200 (đã là pattern hiện tại) |
| R4 | Field mới làm form dài | Optional fields + progressive disclosure |
| R5 | Báo cáo FE-MARKETING-REQ-AUDIT không có trong worktree | Dùng O13 design + code hiện tại; sync audit khi file có trên `main` |

---

## 9. Acceptance (BA task)

- [x] Taxonomy 5 event + dedupe + props
- [x] Qualified lead scoring + field bổ sung tối thiểu
- [x] Privacy/consent model + draft copy VI/EN
- [x] `LeadSink` contract + adapters + failure modes
- [x] KPI funnel ops
- [x] Căn chỉnh O13 (8 sections, Live Pulse v2, anti-fake social proof)

**Verdict:** Sẵn sàng cho implement task follow-up trên Epic #770 — **không** pilot-ready analytics cho đến khi code + privacy deploy được ủy quyền.

---

*Artifact path:* `docs/reviews/MKT-BA-ANALYTICS-LEAD-2026-10-22.md`
