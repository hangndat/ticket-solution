# DB-19 — versioned QR credential sealing keyring

## Quyết định tích hợp F04 — 2026-11-03

Owner chọn email gửi QR Gate ký ES256 mới. Trước khi tạo và gửi QR, outbox vẫn phải mở credential ACTIVE theo `kid` đã lưu, xác thực AES-GCM và đối chiếu hash; khóa cũ còn giữ phải dùng được, `kid` lạ hoặc dữ liệu sai phải từ chối gửi. Token cũ không được đưa vào QR ký. Quyết định này cập nhật mô tả payload email cũ bên dưới, giữ nguyên các invariant kiểm tra keyring và trạng thái credential.

Owner decision (2026-11-03): retain DB-19 D/H acceptance, including QR credentials issued under a supported old key. This handoff applies to the existing `ticket.credential` email QR and its AES-GCM sealed opaque token. Gate admission of signed QR is tracked separately by GATE-03; DB-19 does not claim to close that gap.

## Contract

- `TICKET_CREDENTIAL_KEY` is the current secret (existing setting). `TICKET_CREDENTIAL_KID` is its non-secret key ID, default `local-v1` for existing deployments. `TICKET_CREDENTIAL_LEGACY_KEYS` is an optional JSON object of `kid: secret` entries. A rotation sets a new current ID/key and retains the previous ID/key in the legacy map until all credentials issued with it leave their business lifecycle. API and worker receive the same ring. Missing, duplicate, malformed, or too-short entries fail configuration closed; key material never appears in diagnostics, responses, audit, or logs.
- New issue, approval, and reissue seal under the current key and persist its `kid` with the credential. Existing `local-v1` rows remain readable with the default or retained legacy entry. Email QR rendering selects a key by the persisted `kid`, checks AES-GCM authentication and stored token hash, and refuses an unsupported ID. It reads only the current `ACTIVE` credential version. A revoked or superseded credential cannot be made active by restoring its key.
- No automatic re-encryption or DB migration. Removing a legacy key early intentionally prevents delivery of affected credentials; operational rotation must retain it through ticket lifecycle and verify API/worker configuration together. Do not fall back to the current key for an unknown `kid`.

## Acceptance evidence

Deterministic D tests cover current/legacy issuance and opening, removed/unknown ID rejection, tampered ciphertext/hash, and revoked row selection. H uses the isolated DB-19 lane with real Keycloak bearer HTTP plus the outbox credential path. One supported/unsupported key pair suffices under PLAN §15.3. Code pepper rotation from #1155/#1163 remains unchanged.
