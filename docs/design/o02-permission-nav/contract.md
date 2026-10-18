# O02 — Contract: staffEligible + tenant/event capabilities

Neo: [README.md](./README.md) · Issue [#368](https://github.com/hangndat/ticket-solution/issues/368) · BE [#369](https://github.com/hangndat/ticket-solution/issues/369)

## 1. Invariants

1. **Deny-by-default chrome:** không có tín hiệu server hợp lệ → ẩn staff/admin/gate nav; không escalate quyền vì user mở URL/tab.
2. **Permission strings chỉ từ server allowlist** (`role-map` / rows đã grant). Client không tự tạo permission; không map role name local thành quyền mới.
3. **O02:** đổi tab / mode UI **không** cấp quyền mới — chỉ thay presentation khi `staffEligible` / permissions cho phép.
4. **PostgreSQL = SoT** cho membership + `event_assignments`; Redis không quyết định eligibility.
5. **Revoke fail-closed:** sau revoke commit, GET discovery phản ánh ngay; mutation staff bị từ chối bằng mã authz hiện có.

## 2. Endpoints (discovery)

| Method | Path | Vai trò chrome |
| --- | --- | --- |
| `GET` | `/v1/me` | Identity only — **không** đổi trong O02 |
| `GET` | `/v1/me/tenants` | Tenant selector + tenant-scoped admin chrome (**đã có**) |
| `GET` | `/v1/me/events` | **Mới** — event capabilities + `staffEligible` |

Auth: Bearer OIDC đã verify (cùng `selfActor` như `/v1/me/tenants`). Không cookie-special; web qua BFF forward bearer.

### 2.1 `GET /v1/me/events` — response 200

```json
{
  "staffEligible": true,
  "items": [
    {
      "tenantId": "11111111-1111-1111-1111-111111111111",
      "eventId": "22222222-2222-2222-2222-222222222222",
      "name": "Demo Night",
      "permissions": ["gate.confirm", "gate.undo"]
    }
  ]
}
```

#### `MeEventsResponse` (additive vs tip contracts)

| Field | Type | Rules |
| --- | --- | --- |
| `staffEligible` | `boolean` | **Server-computed.** `true` iff caller có ≥1 **active tenant membership** **hoặc** ≥1 **active event assignment**. Attendee-only (chỉ vé) → `false`. |
| `items` | `MeEventItem[]` | Chỉ assignment **active** (`activated_at` set, `revoked_at` null) + event còn visible cho staff discovery (không leak tenant lạ). Có thể `[]` khi Owner mới chưa được assign event — lúc đó `staffEligible` vẫn có thể `true` nhờ membership. |

#### `MeEventItem` (mở rộng additive)

| Field | Type | Notes |
| --- | --- | --- |
| `tenantId` | `string` (uuid) | **Bắt buộc thêm** — Gate/admin scope cần cặp tenant+event |
| `eventId` | `string` (uuid) | Đã có trong type |
| `name` | `string` | Display; không phải authz |
| `permissions` | `string[]` | Copy từ assignment / derived `eventPermissionsForRole` tại grant time — **server SoT** |

**Không** bắt buộc trả `role` trên item (tránh client suy quyền từ role). Tenant role nằm trên `/v1/me/tenants`.

### 2.2 `GET /v1/me/tenants` — không đổi shape bắt buộc

Giữ `MeTenantItem`: `tenantId`, `slug`, `name`, `status`, `role`, `tenantPermissions`.

Consumers admin chrome đọc `tenantPermissions` (ví dụ `event.create`, `event.list`, `members.manage`, `tenant.profile`). **Không** yêu cầu BE #369 sửa tenants trừ khi test cần; optional later: echo `staffEligible` — **không** làm trong MVP O02 để tránh dual source; clients lấy `staffEligible` từ MeEvents.

## 3. Chrome mapping (web ∥ iOS)

Client **chỉ** dùng bảng dưới. Thiếu field / lỗi parse → treat như không eligible.

| Chrome element | Show when |
| --- | --- |
| iOS tab **Nhân viên** / web entry staff mode | `MeEvents.staffEligible === true` |
| Nav **Admin / Sự kiện** (`/admin`) | `staffEligible` **và** ∃ tenant với `tenantPermissions` giao `{event.create, event.list, members.manage, tenant.profile}` khác rỗng. Role `Owner`/`Manager` chỉ là hint UX — **mutation vẫn enforce server**. Scanner với `tenantPermissions: []` → **không** hiện admin workbench |
| Nav **Cổng** (`/gate`) / Gate scan entry | `staffEligible` **và** ∃ `MeEventItem` với `'gate.confirm' ∈ permissions` |
| Guest tabs (Sự kiện / Vé / Redeem…) | Luôn theo product guest — không phụ thuộc staffEligible |

**Soft-redirect:** user deep-link `/admin` hoặc `/gate` / iOS staff route khi không đủ capability → về guest home / account với copy fail-closed ngắn; **không** hard-crash; **không** hiện empty staff shell giả quyền.

## 4. Authz & trust boundary

```text
OIDC JWT ──verify──► users upsert
                         │
                         ├─ GET /v1/me          → identity
                         ├─ GET /v1/me/tenants  → active memberships + tenantPermissions
                         └─ GET /v1/me/events   → staffEligible + active assignments
```

- Transaction-local `app.actor_id` (pattern `list_my_tenants`).
- Runtime DB role không bypass RLS; discovery qua SECURITY DEFINER / owned function tương tự `list_my_tenants()` (BE chọn tên `list_my_events()`).
- Response **không** gồm PII người khác; chỉ event name + ids + permissions của caller.

## 5. Failure modes

| Case | HTTP / body | Client |
| --- | --- | --- |
| Missing/invalid bearer | `401` + `UNAUTHENTICATED` (hoặc identity codes hiện có) | Clear session / signed-out chrome; ẩn staff |
| OIDC misconfigured | `503` / `OIDC_MISCONFIGURED` như `/v1/me` | Fail-closed; không fallback demo staff |
| Authenticated, không membership/assignment | `200` `{ "staffEligible": false, "items": [] }` | **Không** dùng `403` cho empty discovery |
| Parse/shape invalid | — | Treat as not eligible |
| Network unreachable | — | Giữ chrome **đã biết** chỉ trong TTL ngắn *hoặc* ẩn staff (khuyến nghị: **ẩn** staff khi stale > session focus — safer O02); không đoán thêm quyền |
| Staff mutation sau revoke | `403` `MEMBERSHIP_REVOKED` / `PERMISSION_DENIED` | Ẩn nav + soft-redirect; refresh MeEvents/MeTenants |

## 6. Revoke & freshness

1. **Membership revoke** / **event assignment revoke** (existing BE) → hàng biến mất khỏi `list_my_*`; `staffEligible` cập nhật.
2. Clients **revalidate** MeEvents (+ MeTenants nếu admin) khi: app foreground, vào staff tab, sau accept invite, sau 403 staff.
3. **Không** persist `staffEligible=true` qua SecureStore/localStorage như nguồn quyền — chỉ cache UI ephemeral.
4. Gate session ACTIVE không thay thế discovery: sau revoke membership, TECHNICAL-DESIGN already locks mutations; chrome phải ẩn ở lần refresh kế.

## 7. Compatibility

- Client cũ: không gọi MeEvents → hành vi hiện tại (tab/nav lộ) **chưa** đạt O02; consumers #370/#371 bắt buộc integrate.
- Additive fields trên `MeEventItem` (`tenantId`) — generators/OpenAPI cập nhật cùng PR BE.
- Không breaking `/v1/me` / `/v1/me/tenants`.

## 8. Test matrix (evidence BE / consumers)

| Case | Expect |
| --- | --- |
| Attendee-only user | `staffEligible=false`, `items=[]`; iOS ẩn tab; web không staff/admin/gate nav |
| Scanner assigned 1 event | `true` + item có `gate.confirm`; Gate nav hiện; Admin ẩn nếu không tenant perms |
| Owner membership, 0 assignments | `true`, `items=[]`; Admin có thể hiện từ MeTenants; Gate ẩn |
| Revoke assignment rồi GET | item biến mất; Gate ẩn |
| Revoke membership rồi GET | `staffEligible=false` (trừ assignment/membership khác còn active) |
| Unauthenticated GET | 401 |

## 9. Kết luận contract

**Đủ để triển khai:** shape + mapping + failure/revoke đã chốt cho BE #369 và consumers #370/#371. Mọi permission string mới ngoài `role-map` cần ADR/decision riêng — ngoài handoff này.
