# AC dùng chung — S-P0-C Brand-test multi-tenant

> **Không phải Task Dispatch riêng.** Gắn checklist này vào Issue/Dispatch surface (`D11-B2-web-*`, `D11-B3`, `D11-B5`) khi scope gồm white-label / event chrome.  
> **CHƯA APPROVED** cho coding — proposal chờ user review roadmap.  
> Nguồn: BA S-P0-C / P0-4; PD §6.3; tokens `brand/vemoki/tokens.json`; evidence mẫu D8 (lịch sử).

## Vai trò khi gắn vào Task

- Role theo surface: `web` hoặc `ios` (một ownership / Dispatch).  
- Agent: cursor.  
- **Không** đổi API/auth/contract trong brand-test; gap projection → escalate coordinator.

## AC cụ thể

- [ ] **≥2 tenant/event** đã publish brand khác nhau; chứng minh trên **web và/hoặc iOS** đúng surface Task (không claim platform ngoài scope).
- [ ] **Nguồn brand / tokens / fallback boundaries** ghi rõ theo surface:
  - Platform Vemoki (marketing/account/IdP chrome) vs tenant/org vs event (M04).
  - Event đã resolve brand → **không** fallback wordmark/chrome Vemoki sai ngữ cảnh.
  - Tokens reuse `brand/vemoki/tokens.json` (+ ThemeProvider/slug) — không skin-only (chỉ đổi 1 màu).
- [ ] **Sau switch tenant/event hoặc logout:** không lẫn brand/assets/copy của tenant trước (identity/theme cache).
- [ ] **Screenshot crop** (bỏ chrome platform/nav chung vẫn nhận đúng org/event brand trong review).
- [ ] **API auth unchanged** — không đổi endpoint auth, session model, hoặc OpenAPI; mọi đề xuất contract = escalate, **không** auto-approve.
- [ ] **Headless commands + artifacts:**
  - Web: `scripts/web-uat.sh` (Playwright headless) — path artifact dưới `apps/web/.uat-artifacts/` (gitignored).
  - iOS: `scripts/sim-uat.sh` — path dưới `apps/mobile/.uat-artifacts/` (gitignored).
  - Ghi exact SHA tip đang duyệt trên evidence.

## Proof limits

- Headless / sim ≠ device UAT; ≠ store submit; ≠ pilot ready.
- Screenshot D8 / docs lịch sử **không** đủ proof runtime trừ khi chụp lại trên tip đang duyệt.
- Prototype HTML (`docs/design/d11-prototype/**`) có PD headless QA 29/29 PASS (`docs/reviews/D11-PROTOTYPE-HEADLESS-QA.md`) nhưng **≠** runtime/app QA / a11y pass trên `apps/**`.
- Optional Gate capabilities (vd. validate-only) **chưa approved** — không gộp vào brand-test.

## OUT

Invent API; đổi O09 palette không ủy quyền; EAS Cloud Build; deploy/store; claim “brand-test PASS” chỉ từ prototype.
