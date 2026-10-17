# Checklist asset media (D9 / C-B)

Docs VI cho designer và ops. Nguồn giới hạn runtime: `ASSET_LIMITS` trong `packages/contracts/src/config.ts`. Pack thương hiệu nền: `brand/vemoki/`.

## 1. Format được phép (upload event / MinIO C-B)

| Cho phép | Không cho phép |
| --- | --- |
| `image/png`, `image/jpeg`, `image/webp` | SVG, HTML, JS, CSS, XML, GIF động, HEIC, PDF |
| Magic bytes thật khớp MIME | Tin client `Content-Type` không đủ |

Upload đi **quarantine → re-encode (sharp) → ready**. Object key ready:

```text
tenants/{tenantId}/events/{eventId}/assets/ready/{assetId}.{png|jpg|webp}
```

Quarantine (tạm):

```text
tenants/{tenantId}/events/{eventId}/assets/quarantine/{assetId}
```

Bucket mặc định: `MINIO_BUCKET_ASSETS` = `vemoki-assets` (private; signed URL ngắn hạn).

## 2. Giới hạn cứng (server reject)

| Hạng mục | Giá trị |
| --- | --- |
| Dung lượng | ≤ **5 MiB** (`maxBytes`) |
| Cạnh dài | ≤ **4096 px** |
| Tổng pixel | ≤ **16_000_000** |
| Số asset / event | ≤ **20** |

Checklist trước khi gửi file:

- [ ] File ≤ 5 MiB sau export
- [ ] Không vượt 4096×4096 và không > 16M pixel
- [ ] PNG / JPEG / WebP only (không SVG cho logo/banner event)
- [ ] Tên file ≤ 255 ký tự; không đuôi `.svg` / `.html` / `.js`
- [ ] Nội dung không nhúng HTML/script trong raster

## 3. Kích thước khuyến nghị theo vai trò

| Vai trò | Khuyến nghị | Ghi chú |
| --- | --- | --- |
| Logo event (`logoAssetId`) | 512×512 PNG hoặc lockup ≤ 760×200 | Nền trong/transparent OK |
| Banner event (`bannerAssetId`) | **1200×630** JPEG/WebP | Cùng tỉ lệ OG |
| Open Graph / share | 1200×630 | `brand/vemoki/og.png` là mẫu |
| Email header | 600×160 PNG | `brand/vemoki/email-header.png` |
| App icon (store) | 1024×1024 PNG | Không upload qua C-B; nằm native pack |
| Mark / glyph | SVG trong repo | **Không** upload qua API C-B |

## 4. Naming & manifest demo

- Platform pack: `brand/vemoki/<role>.<ext>` + `tokens.json`.
- Demo seed (D9): `brand/demo/manifest.json` — map tenant/event UUID ổn định → file nguồn → object key ready.
- Slug fixture mobile (`demo-fun` / `fun-fest`) **không** thay UUID trong object key; seed dùng UUID cố định trong manifest để S1/S3 gắn DB sau.

## 5. Ops seed MinIO

```bash
# Local: bring-up MinIO (compose, hoặc cleanstart fallback nếu Docker Hub bị chặn) + PutObject
D9_MEDIA_STACK_UP=1 ./scripts/d9-seed-media.sh
# Chỉ smoke (không put lại):
./scripts/d9-seed-media.sh --smoke-only
```

Biến (xem `.env.example` / `ENV-MANIFEST.md`): `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_ASSETS`, `MINIO_REGION`.

Fallback local: khi `minio/minio` pull bị deny, script dùng image cached `cleanstart/minio:latest` (cùng hướng `packages/backend/test/minio-real.test.cjs`).

Evidence mong đợi: danh sách object key + `GET`/`HEAD` smoke PASS; artifact `docs/reviews/D9-S2-MEDIA-SEED-EVIDENCE.md`.

## 6. Checklist nghiệm thu Story #139

- [ ] Designer/ops có checklist này (Issue #140)
- [ ] Seed demo đã chạy; object keys + URL/smoke log (Issue #141)
- [ ] Không commit secret MinIO; chỉ placeholder local
- [ ] Web/iOS hiển thị media demo đúng thuộc Issue #142 (ngoài scope T1/T2)
