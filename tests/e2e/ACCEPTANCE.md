# F04 — ma trận nghiệm thu tích hợp

Ngày đối chiếu: **02/11/2026**. Source snapshot: `713580c386a2d6aad243655066be7ae27ca16925`. Người đối chiếu: Minh (coordinator). Architecture impact: Không; cập nhật evidence, không thay runtime/AC.

**40 nhóm đã có nghiệm thu tích hợp trong lịch sử, 45 nhóm còn thiếu gate toàn phần, JOB-08 OUT.** Đây là tổng hợp verdict trên SHA/run ở từng PR, **không phải** một full regression toàn Epic mới chạy trên source snapshot. PLAT-03 có D PostgreSQL 5/5 qua PR #1123 và H Keycloak MFA/HTTP sạch `mvyap7sk-aaa3fb` qua PR #1132; reviewer độc lập xác minh F01/F02, merge `713580c3`, CI main `41348557845` SUCCESS. Lịch sử sửa F01: 2/2 lượt tự động và một ngoại lệ helper 1/1, không reset. Thêm DB-15/16 qua PR #1109, PORT-06 qua PR #1120 và PORT-08 qua PR #1127 sau review độc lập và CI main. PORT-08 có B/H sạch `3/3`, review DoD/Security/UX PASS trên tip `8a451094`, merge `ace18977`, CI main `41339139778` SUCCESS; lịch sử #1067 partial không thay đổi. POL-01 qua PR #1125, merge `f60e0bab`, CI main `41340112075` SUCCESS; D chuẩn 8 selector/10 case PASS sau review Security độc lập và revalidation delta config. Web B trên ba stack/nhóm fixture sạch tại `feefbc10` đạt 47/47; chi tiết ngay dưới. Full Web 13 fixture trên một stack trước đó đạt 44/47 do bucket public read 600/600; giữ phép đo tải chung và rủi ro capacity riêng, không gọi nó PASS.

[PLAN.md](PLAN.md) là nguồn AC B/H/D/R. `coverage.json` chỉ là inventory selector; `implemented`/`covered` không tự chuyển thành nghiệm thu. Trạng thái công việc động lấy Issue/Project #3. Checkpoint 12 PASS trong ROADMAP/PLAN là mốc cũ, không phải tổng số PR đã nghiệm thu đến 02/11.

## Web regression trên source snapshot

Sau [PR #1114](https://github.com/hangndat/ticket-solution/pull/1114) xử lý đúng 429 và được reviewer độc lập xác minh tại exact head `783dff1e`, `main` tại `feefbc10` có ba smoke run tuần tự trên stack Docker riêng: `mvxomaja-f033ff` WEB-01–04 **11/11**, `mvxoo1n7-64f925` WEB-05–09 **18/18**, `mvxosf1l-6a95d0` WEB-10–13 **18/18**. Tổng **47/47 PASS**, không skip; cả ba `summary.json` có `evidenceEligible:true`, cây sạch và commit ổn định. [Issue #1037 evidence](https://github.com/hangndat/ticket-solution/issues/1037#issuecomment-6556771617) ghi run và giới hạn. Run bị cắt bởi shell hook `mvxop60t-9830a7` và run cây bẩn `mvxoimha-021778` không được tính.

Nghiệm thu chức năng theo nhóm không chứng minh sức chứa của một IP chia sẻ. Full 13 fixture ở `mvxnds0g-aa8291` còn 3 FAIL do 429 trên bucket `api.public.read`; cần đo topology/traffic production trước quyết định quota/cache. Không đóng #1037 theo riêng kết quả 47/47 này.

## Các nhóm có nghiệm thu tại mốc tích hợp

Mỗi dòng dẫn PR đã merge và evidence/review. SHA trong bảng là **merge SHA**, không thay SHA đã chạy test. Tested SHA, clean provenance, reviewer và CI được giữ nguyên trong link evidence.

| ID      | P   | Lớp AC | PR / merge SHA                                                                                              | Run / evidence                                                                                                                           |
| ------- | --- | ------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | P0  | B/H    | [#1041](https://github.com/hangndat/ticket-solution/pull/1041) · `04fa24b83f980b8994b0ccb9a7cf4cc4223583ec` | `mvueewq9-6443b7` · [evidence](https://github.com/hangndat/ticket-solution/pull/1041#issuecomment-6514142847)                            |
| AUTH-02 | P0  | B/H    | [#1041](https://github.com/hangndat/ticket-solution/pull/1041) · `04fa24b83f980b8994b0ccb9a7cf4cc4223583ec` | `mvueewq9-6443b7` · [evidence](https://github.com/hangndat/ticket-solution/pull/1041#issuecomment-6514142847)                            |
| AUTH-03 | P0  | B/H    | [#1044](https://github.com/hangndat/ticket-solution/pull/1044) · `34c2d638fa974376dc21a05381eba132a1c41feb` | `mvuhg384-8f05be; mvuhub6j-16fbd0` · [evidence](https://github.com/hangndat/ticket-solution/issues/1029#issuecomment-6515411311)         |
| AUTH-04 | P0  | B/H    | [#1044](https://github.com/hangndat/ticket-solution/pull/1044) · `34c2d638fa974376dc21a05381eba132a1c41feb` | `mvuhg384-8f05be; mvuhub6j-16fbd0` · [evidence](https://github.com/hangndat/ticket-solution/issues/1029#issuecomment-6515411311)         |
| AUTH-05 | P0  | B/H    | [#1044](https://github.com/hangndat/ticket-solution/pull/1044) · `34c2d638fa974376dc21a05381eba132a1c41feb` | `mvuhg384-8f05be; mvuhub6j-16fbd0` · [evidence](https://github.com/hangndat/ticket-solution/issues/1029#issuecomment-6515411311)         |
| WEB-01  | P0  | B/H    | [#1111](https://github.com/hangndat/ticket-solution/pull/1111) · `105ee3c29ec8a01cff8b63a8e95c21cf753bcd19` | `mvxlnnby-e35f78` WEB-01 PASS; [review](https://github.com/hangndat/ticket-solution/pull/1111#issuecomment-6555901115)                   |
| WEB-02  | P0  | B      | [#1077](https://github.com/hangndat/ticket-solution/pull/1077) · `21a0b8ab0f6978d792556bff2bb6d045947c9727` | `mvuxsq31-d9f462` · [evidence](https://github.com/hangndat/ticket-solution/pull/1077#issuecomment-6522759425)                            |
| WEB-03  | P0  | B/H    | [#1077](https://github.com/hangndat/ticket-solution/pull/1077) · `21a0b8ab0f6978d792556bff2bb6d045947c9727` | `mvuxsq31-d9f462` · [evidence](https://github.com/hangndat/ticket-solution/pull/1077#issuecomment-6522759425)                            |
| WEB-04  | P0  | B/H    | [#1082](https://github.com/hangndat/ticket-solution/pull/1082) · `a51fd895bf8b4da5f2397193ed9ef3b16a21e670` | `mvv0kmxn-5038d2; mvv0lz1j-b30c15` · [evidence](https://github.com/hangndat/ticket-solution/issues/1037#issuecomment-6524355066)         |
| WEB-05  | P0  | B/H    | [#1071](https://github.com/hangndat/ticket-solution/pull/1071) · `64e1d270798c817aab2099142a97f03f17b1956a` | `mvuvgow7-f39e4e; mvuvhn2t-f1e3ab` · [evidence](https://github.com/hangndat/ticket-solution/pull/1071#issuecomment-6521341187)           |
| WEB-06  | P0  | B      | [#1079](https://github.com/hangndat/ticket-solution/pull/1079) · `96c8fc6a4e7b2ff657ce4ade23d9187c1ca535e2` | `mvuzute9-d7d0ba` · [evidence](https://github.com/hangndat/ticket-solution/issues/1037#issuecomment-6523932126)                          |
| WEB-07  | P0  | B/H    | [#1073](https://github.com/hangndat/ticket-solution/pull/1073) · `08f632c0b01fdf96cd388e2c454b272f7bbcbf57` | `mvuw3xnz-3dad02` · [evidence](https://github.com/hangndat/ticket-solution/pull/1073#issuecomment-6521628039)                            |
| WEB-08  | P0  | B/H/R  | [#1078](https://github.com/hangndat/ticket-solution/pull/1078) · `579677a7b069cfad990622f2b8af39b2eab7b5bc` | `mvuz7p3q-239284` · [evidence](https://github.com/hangndat/ticket-solution/issues/1037#issuecomment-6523548360)                          |
| WEB-09  | P0  | B/H    | [#1075](https://github.com/hangndat/ticket-solution/pull/1075) · `85ddecddb8f2128bdcbed60b94c56fc416fc89af` | `mvuwgqol-9172ce` · [evidence](https://github.com/hangndat/ticket-solution/pull/1075#issuecomment-6521985612)                            |
| WEB-10  | P0  | B/H    | [#1076](https://github.com/hangndat/ticket-solution/pull/1076) · `96339b10a215febb0dac49ae017b71641f5f01a5` | `mvuxklpu-3655e6` · [evidence](https://github.com/hangndat/ticket-solution/pull/1076#issuecomment-6522564415)                            |
| WEB-11  | P1  | B      | [#1069](https://github.com/hangndat/ticket-solution/pull/1069) · `6d9e9a1955f837e6644d204484086408861cf703` | `mvuu1bx0-e34021` · [evidence](https://github.com/hangndat/ticket-solution/pull/1069#issuecomment-6520675452)                            |
| WEB-12  | P1  | B/H    | [#1087](https://github.com/hangndat/ticket-solution/pull/1087) · `daba800de6b9612da7fff3a9178a5515fd22fa0c` | `mvvtjyqc-fcefe0` · [evidence](https://github.com/hangndat/ticket-solution/pull/1087#issuecomment-6538223227)                            |
| WEB-13  | P0  | B/H/R  | [#1068](https://github.com/hangndat/ticket-solution/pull/1068) · `9385b61c6a6d6aa5e1188ed2ec8cedee1810a02e` | `mvut08cn-720b41` · [evidence](https://github.com/hangndat/ticket-solution/pull/1068#issuecomment-6520214329)                            |
| PORT-05 | P0  | B/H    | [#1074](https://github.com/hangndat/ticket-solution/pull/1074) · `50da08137c136433e45b9ee0a1a018ca00ae8176` | `mvux6zqa-29e1e6` · [evidence](https://github.com/hangndat/ticket-solution/issues/1035#issuecomment-6522477304)                          |
| PORT-06 | P0  | B/H    | [#1120](https://github.com/hangndat/ticket-solution/pull/1120) · `52120d9ca51edb7ef650c6711ebb68a91c7d9dfd` | `mvy3j11q-c5d6cf` 5/5 trên `db8020ec` · [review](https://github.com/hangndat/ticket-solution/pull/1120#issuecomment-6561587792)          |
| PORT-07 | P0  | B/H    | [#1064](https://github.com/hangndat/ticket-solution/pull/1064) · `72e2d495e5e58e07b5d4515a9527ce0bb4caf997` | `mvusk9f6-1ab717` · [evidence](https://github.com/hangndat/ticket-solution/pull/1064#issuecomment-6519921340)                            |
| PORT-08 | P0  | B/H    | [#1127](https://github.com/hangndat/ticket-solution/pull/1127) · `ace18977ab023fb9521e77eb2b3dfc437b0b3e4d` | `mvy6cgor-c22a6e` 3/3 trên `f3cfb27d` · [review](https://github.com/hangndat/ticket-solution/pull/1127#issuecomment-6562397438)          |
| PORT-09 | P0  | B/H    | [#1084](https://github.com/hangndat/ticket-solution/pull/1084) · `f02b4feb5913435a059e3019186a0dc46b2bca9a` | `mvvrilmh-ca2b2e` · [evidence](https://github.com/hangndat/ticket-solution/pull/1084#issuecomment-6537643668)                            |
| DB-01   | P0  | D/H    | [#1040](https://github.com/hangndat/ticket-solution/pull/1040) · `7382a4bdfb5de85cbcda96a8ef57a569e96e6b63` | `mvuesfb3-a7f229` · [evidence](https://github.com/hangndat/ticket-solution/pull/1040#issuecomment-6514309627)                            |
| DB-02   | P0  | D/H    | [#1040](https://github.com/hangndat/ticket-solution/pull/1040) · `7382a4bdfb5de85cbcda96a8ef57a569e96e6b63` | `mvuesfb3-a7f229` · [evidence](https://github.com/hangndat/ticket-solution/pull/1040#issuecomment-6514309627)                            |
| DB-03   | P0  | D/H    | [#1040](https://github.com/hangndat/ticket-solution/pull/1040) · `7382a4bdfb5de85cbcda96a8ef57a569e96e6b63` | `mvuesfb3-a7f229` · [evidence](https://github.com/hangndat/ticket-solution/pull/1040#issuecomment-6514309627)                            |
| DB-04   | P0  | D/H    | [#1046](https://github.com/hangndat/ticket-solution/pull/1046) · `4a04a5920e57b9498b0f61d4de4937d0af6e2d38` | `mvugfv3g-6fa3d8; D 64/64` · [evidence](https://github.com/hangndat/ticket-solution/pull/1046#issuecomment-6514874623)                   |
| DB-05   | P0  | D      | [#1046](https://github.com/hangndat/ticket-solution/pull/1046) · `4a04a5920e57b9498b0f61d4de4937d0af6e2d38` | `mvugfv3g-6fa3d8; D 64/64` · [evidence](https://github.com/hangndat/ticket-solution/pull/1046#issuecomment-6514874623)                   |
| DB-07   | P0  | D/H    | [#1056](https://github.com/hangndat/ticket-solution/pull/1056) · `a3868a68a3ade219b4613cc4c7b3ff11bce33c30` | `mvuk4po6-dac039; D 5/5` · [evidence](https://github.com/hangndat/ticket-solution/pull/1056#issuecomment-6516130586)                     |
| DB-08   | P0  | D      | [#1051](https://github.com/hangndat/ticket-solution/pull/1051) · `1e0f012f58370489e4dc7d4610b0583b7102524c` | `D 3/3 trên cb851bfa` · [evidence](https://github.com/hangndat/ticket-solution/pull/1051#issuecomment-6515418242)                        |
| DB-10   | P0  | D/H    | [#1059](https://github.com/hangndat/ticket-solution/pull/1059) · `002c96cbabad37963bb6c59f6c2f6bd8e56691eb` | `mvulhgmy-f0f539` · [evidence](https://github.com/hangndat/ticket-solution/pull/1059#issuecomment-6516635276)                            |
| DB-11   | P0  | D/H    | [#1061](https://github.com/hangndat/ticket-solution/pull/1061) · `3de19ac330efcff19ddbe3966f0675eedc74c5f0` | `mvuoefz6-2b9e25; D 2/2` · [evidence](https://github.com/hangndat/ticket-solution/pull/1061#issuecomment-6517875044)                     |
| DB-14   | P0  | D/H    | [#1063](https://github.com/hangndat/ticket-solution/pull/1063) · `553ebdf1d0e51aa0bbf117eb207409068189f648` | `mvurjvqz-abe8f0; D 3/3` · [evidence](https://github.com/hangndat/ticket-solution/pull/1063#issuecomment-6519478888)                     |
| DB-15   | P0  | D/H    | [#1109](https://github.com/hangndat/ticket-solution/pull/1109) · `569a9aad4fd1a1116d8f61b083d429853e64d7e1` | `mvxl0ywo-323403; D 3/3` trên `16e909c9` · [review](https://github.com/hangndat/ticket-solution/pull/1109#issuecomment-6561199785)       |
| DB-16   | P1  | D/H    | [#1109](https://github.com/hangndat/ticket-solution/pull/1109) · `569a9aad4fd1a1116d8f61b083d429853e64d7e1` | `mvxl0ywo-323403; D retry 2/2` trên `16e909c9` · [review](https://github.com/hangndat/ticket-solution/pull/1109#issuecomment-6561199785) |
| JOB-01  | P0  | R/D    | [#1080](https://github.com/hangndat/ticket-solution/pull/1080) · `2105c30efa32fbdfb4bc1ebab3b529c5450f7116` | `D/R 3/3 sạch trên 50f1241d` · [evidence](https://github.com/hangndat/ticket-solution/issues/1032#issuecomment-6524280665)               |
| JOB-02  | P0  | R/D    | [#1081](https://github.com/hangndat/ticket-solution/pull/1081) · `def73ae05f2526fe5e265f51a3dac72a15a98fd0` | `D/R 2/2 sạch trên c5ae316f` · [evidence](https://github.com/hangndat/ticket-solution/issues/1032#issuecomment-6524477477)               |
| JOB-03  | P0  | R/D    | [#1083](https://github.com/hangndat/ticket-solution/pull/1083) · `d597079f5db1c047322429ddfc9dea083987e8dd` | `D 1/1; R 3/3 trên 7488ee6c` · [evidence](https://github.com/hangndat/ticket-solution/issues/1032#issuecomment-6525324272)               |
| POL-01  | P1  | D      | [#1125](https://github.com/hangndat/ticket-solution/pull/1125) · `f60e0bab398c91b185d4796c38013dce52235919` | D 8 selector/10 case trên `7218acc2` · [review](https://github.com/hangndat/ticket-solution/pull/1125#issuecomment-6562525257)           |
| PLAT-03 | P0  | H/D    | [#1123](https://github.com/hangndat/ticket-solution/pull/1123) · `08376150f6e634fba007d1ffae000d5a0e8c04af`; [#1132](https://github.com/hangndat/ticket-solution/pull/1132) · `713580c386a2d6aad243655066be7ae27ca16925` | D 5/5 trên `fe1ffa75`; H `mvyap7sk-aaa3fb` trên `089a916c` · [review H](https://github.com/hangndat/ticket-solution/pull/1132#issuecomment-6563651529) |

## Phân tầng nghiệm thu 45 nhóm còn lại — quyết định user 02/11/2026

User quyết định chia 45 nhóm còn thiếu thành ba tầng thay vì giữ một gate đồng nhất, **và cho phép điều chỉnh AC khi cần** thay vì khóa cứng toàn bộ lớp/độ rộng assertion như các bản trước. Chi tiết, phần được giảm và phần đánh đổi: [PLAN.md §15](PLAN.md). Ưu tiên cao nhất kèm theo là chạy song song và tái sử dụng infra: [PLAN.md §16](PLAN.md).

**Quy tắc AC sau quyết định này:** lớp bằng chứng và độ rộng assertion của từng ID được phép điều chỉnh khi chi phí không tương xứng với rủi ro. Mỗi lần điều chỉnh phải ghi đủ bốn mục: ID, phần bị giảm, lý do, rủi ro còn lại. Hai ranh giới giữ nguyên vì chúng không phải là độ cao của gate mà là tính trung thực của bằng chứng: **không đổi expected outcome để khớp một bug đã biết**, và **không ghi PASS cho lớp chưa chạy**.

| Tầng | Số ID | ID | Cách nghiệm thu |
| ---- | ----: | -- | ---------------- |
| **1 — giữ gate B/H/R đầy đủ** | 16 | AUTH-06/07/08 · SEC-01/02/05 · PORT-02/03/10/11/12/14 · PLAT-01/02/04 · JOB-05 | Như hiện tại: run sạch theo lớp PLAN, reviewer độc lập, CI main, evidence exact SHA. Đây là các ID chỉ chứng minh được khi ghép thật — cookie/session đa host, SSR/BFF, mutation qua UI, worker process thật |
| **2 — kiểm kê + vòng chạy gộp, AC thu gọn** | 20 | GATE-01–09 · SEC-03/04/06 · DB-13/17/18/19 · JOB-04/06/07 · POL-02 | PLAN đã chỉ yêu cầu D/H (không có lớp B) và test nền đã tồn tại. Kiểm kê assertion→ID theo PLAN §8, bổ sung phần thiếu có giá trị, rồi một vòng `test:integration:local` + `test:e2e:http` trên SHA gắn tag; verdict nhiều ID ghi một lần. Ma trận vét cạn được thu về ca đại diện theo PLAN §15, ghi rõ phần đã giảm |
| **3 — known gap, chờ quyết định owner** | 9 | DB-06/09/12 · PORT-01/04/13 · PLAT-05 · POL-03/04 | Bị chặn bởi contract/ADR hoặc evidence ops production, không phải bởi test. Ghi known gap theo mẫu [ROADMAP §1.1](../../docs/ROADMAP.md); mở lại khi có quyết định |

Tổng 16 + 20 + 9 = 45; cộng 40 nhóm đã nghiệm thu và JOB-08 OUT = 86.

**Test nền có sẵn cho tầng 2** (inventory để map, chưa phải PASS — PLAN §8): `packages/backend/test/` `gate.test.cjs`, `gates.test.cjs`, `offline-sync-apply.test.cjs`, `offline-sync-receipt.test.cjs`, `db09-ticket-security-invariants.test.cjs`, `event-lifecycle.test.cjs`, `role-presets.test.cjs`, `tenant-limits-usage.test.cjs`, `account-idp-erasure.test.cjs`, `account-session-revoke.test.cjs`, `job04-resend-caps.test.cjs`, `email-budget.test.cjs`, `o06-retention-db.test.cjs`, `o06-offline-purge.test.cjs`; `apps/api/test/` `gate-create.test.cjs`, `gate-offline-sync-receipt.test.cjs`, `gate-reissue.test.cjs`, `api-hardening.test.cjs`, `http-rate-limit.test.cjs`, `export-barrier.test.cjs`, `tenant-limits.test.cjs`; `apps/worker/test/` `job06-late-completion.test.cjs`, `offline-sync-replay.test.cjs`, `worker-budget-fault.test.cjs`.

**Thay đổi quy trình kèm theo:** tầng 2 bỏ mô hình một PR cho một ID; một vòng chạy gộp trên SHA gắn tag, một lần cập nhật ledger. Tầng 1 giữ nguyên nhánh B — reviewer độc lập khác implementer từng PR. Chạy song song và tái sử dụng infra theo [PLAN.md §16](PLAN.md).

**Giới hạn của quyết định này:** tầng 2 không chứng minh hành vi cookie/CSRF trong browser thật hoặc dây SSR/BFF cho các ID thuộc tầng — đúng phạm vi PLAN đã ghi (GATE không kiểm native UI; SEC-03/04/06 là H/D). Tầng 3 mang known gap vào gate pilot; không suy pilot ready từ việc F04 đóng tầng 1 và 2.

## Thử nghiệm tầng 2 trên suite GATE — 02/11/2026

Mục đích: kiểm tra cách làm "kiểm kê + một vòng chạy gộp" trên một suite trước khi áp cho 20 nhóm. Chạy trên worktree sạch tại `3fe83843` (`workingTreeDirty=false`, `evidenceExactShaEligible=true`): **D 9/9 selector PASS** (`test:integration:local --case GATE-0N`) và **H GATE-01/03 PASS** (run `mvz6hk43-198080`, lane1). Lần đầu GATE-09 báo FAIL vì tôi gọi `--no-build` nên bước build API bị bỏ qua (`Cannot find module '../dist/app'`); chạy lại không cờ đó PASS, không phải lỗi sản phẩm.

**Hiệu chỉnh:** PLAN §15.3 và comment trên #1031 viết "thiếu là *verdict*, không phải *coverage*" cho tầng 2. Với GATE điều đó **sai**. Chạy xanh chưa phải phủ đủ: GATE-02, 03, 04, 05 cùng map vào đúng một test D (`gate: one confirm wins…`, `packages/backend/test/gate.test.cjs`), và lớp H mới tồn tại cho GATE-01/03.

| ID | Đã có assertion (đã đọc) | Còn thiếu so với AC | Đánh giá |
| -- | ------------------------ | ------------------- | -------- |
| GATE-01 | D `gates.test.cjs` (list/create/open, RLS, cross-event); H `[GATE-01]` PASS: list/create/trùng tên/quyền/session nullable/FK cổng khác event | H mở lại cùng cổng; actor được gán ở cả hai event | **Gần đủ.** Có thể xin review gộp với phần thiếu ghi là giảm |
| GATE-02 | D: `HELD_BY_OTHER_SESSION` (staff khác nhận HELD riêng) | Retry cùng holder; cancel giải phóng hold; không có check-in trước confirm; H | Thiếu assertion D, thiếu H |
| GATE-03 | H `[GATE-03]`: ticket UUID sai/không tồn tại, thiếu assignment, reject-audit; D: `TICKET_NOT_ACTIVE` cho revoked/cancelled | QR giả/audience/kid/version/hash/event — **API Gate nhận `ticketId`, không có HTTP QR parser** | **Bị chặn bởi quyết định sản phẩm** (signed QR, handoff GATE-03), không bởi thiếu test |
| GATE-04 | D: confirm đồng thời đúng một thắng (`ALREADY_CHECKED_IN`, 1 check-in), `RESERVATION_EXPIRED`, confirm vs revoke | Sai holder/token; revoke session/permission; H retry mất response | Thiếu assertion D, thiếu H |
| GATE-05 | D: undo thành công, ticket về `ACTIVE` | Quyền + lý do bắt buộc; idempotency; Scanner không override; giữ lịch sử; undo vs scan/revoke; H | Chỉ có happy path |
| GATE-06 | U: `validateOfflineSyncRequest` (skew, batch quá lớn); D: apply | H biên ±300 s và item hỗn hợp | Thiếu H |
| GATE-07 | D: duplicate idempotent, conflict, không double-admit | H authz khi retry; audit batch hỗn hợp | Thiếu H |
| GATE-08 | D: receipt matrix authz, states, closed window, read-only | H authz thật và cổng đã đóng | Thiếu H |
| GATE-09 | D: matrix + PG evidence F02-EVID-01; U: 422 UUID sai; bucket rate GET tách POST | H ownership/authz/rate thật | Thiếu H |

**Kết luận của lần thử:** trong 9 ID chỉ GATE-01 gần đóng được; 1 ID (GATE-03) bị chặn bởi quyết định sản phẩm; 7 ID thiếu lớp H hoặc assertion D. "Tầng 2 chỉ cần chạy gộp" đúng cho phần *chạy* (D 9 ID mất ~50 s, H 17–25 s) nhưng **không đúng cho phần *đủ AC***. Chưa ID nào đổi verdict; không ghi PASS cho ID nào ở mục này.

**Hai hướng cho GATE, cần owner chọn** (AC được phép điều chỉnh nhưng đây là giảm lớp, không chỉ thu gọn ma trận):
1. **Viết thêm** ~7 test H (và vài assertion D còn thiếu cho GATE-02/04/05) vào `live.test.mjs`; trung thực nhưng là công việc thật.
2. **Giảm AC GATE xuống D**, ghi rõ ID · phần H bị bỏ · lý do · rủi ro còn lại (authz/route chỉ được chứng minh ở tầng domain, không qua JWT Keycloak thật).

### GATE: thực hiện hướng kết hợp — 02/11/2026

Owner chọn đề xuất kết hợp (viết thêm test cho logic check-in cốt lõi GATE-02/04/05; giảm AC xuống D cho offline sync/receipt GATE-06–09). Bảng trên là trạng thái trước bước này.

**Đã làm cho GATE-02/04/05.** Thêm `packages/backend/test/gate-acceptance.test.cjs` (D) và ba khối H trong `tests/e2e/http/live.test.mjs`, nối vào catalog/coverage. D: hold không là check-in, retry cùng holder dùng lại reservation và xoay token, hold hết hạn nhả cho session khác, sai holder/sai token không mutation, retry confirm không thêm check-in, confirm sau khi session bị revoke bị chặn, Scanner không undo được, lý do trống bị từ chối, undo giữ hàng check-in làm lịch sử với đúng một audit, re-entry sau undo vẫn đúng một check-in hiện hành. H (run `mvz7c12y-668d9f`, 3/3 PASS): cùng các nhánh qua JWT Keycloak thật, thêm hai confirm HTTP đồng thời cho đúng `[200, 409]`. Cả hai lớp đã kiểm đột biến: cho Scanner undo làm D fail (`Missing expected rejection (AuthzError)`) và H fail (`201 !== 403`, run `mvz7d7i0-fbb980`); cho phép lý do trống làm D fail. Cây dirty nên các run này chưa là evidence nghiệm thu.

**Phát hiện cần owner quyết định** (không tự sửa contract, không ghim hành vi lệch):

| # | Phát hiện | ID |
| - | --------- | -- |
| 1 | Không có thao tác huỷ hold chủ động trong API hay domain; `RELEASED` chỉ được đặt khi `revokeTicket`. AC GATE-02 nhắc "cancel" nên vế này chưa có gì để kiểm | GATE-02 |
| 2 | Undo lần hai trả 409 `CHECKIN_ALREADY_UNDONE`, domain không replay. AC ghi "idempotency" nhưng không nói nghĩa là replay cùng kết quả hay từ chối | GATE-05 |
| 3 | Domain ném `CHECKIN_NOT_FOUND` cho lý do trống, trong khi reissue dùng `REASON_REQUIRED`; HTTP che đi bằng 422 `SCOPE_REQUIRED` nên người dùng không thấy. Test chỉ khẳng định bị từ chối và không mutation | GATE-05 |
| 4 | `authz được kiểm cả khi retry` (GATE-07) không có assertion ở **bất kỳ** lớp nào: D `offline-sync-apply` phủ DUPLICATE/conflict/REJECTED/CONFLICT nhưng không có ca bị thu quyền hay revoke session rồi retry | GATE-07 |

**Giảm AC đã ghi** (đúng khung §15.2: ID · phần giảm · lý do · rủi ro còn lại):

| ID | Phần H bị bỏ | Lý do | Rủi ro còn lại |
| -- | ------------ | ----- | -------------- |
| GATE-06 | Biên skew ±300 s và item hỗn hợp qua HTTP | U `validateOfflineSyncRequest` đã phủ skew và batch quá lớn; D đã phủ apply/replay | Ánh xạ HTTP (422 theo `gateHttpException`), authz và rate bucket của route chưa được chứng minh qua JWT thật |
| GATE-08 | Receipt qua HTTP, cổng đã đóng | D matrix đã phủ authz, trạng thái, cửa sổ đóng, read-only | Chỉ chứng minh ở tầng domain; ánh xạ route và token thật chưa kiểm |
| GATE-09 | Ownership/authz/rate qua HTTP | D matrix + PG evidence F02-EVID-01, U 422 UUID sai, U bucket GET tách POST | Như GATE-08; 404 chung sau authz chưa kiểm qua route thật |

**GATE-07 không giảm được theo hướng này:** bỏ H thì vẫn thiếu authz-on-retry ở D. Cần thêm một assertion D (thu quyền hoặc revoke session rồi replay phải bị từ chối) trước khi xin review.

**Trạng thái sau bước này** (chưa ID nào đổi verdict; xếp theo mức sẵn sàng xin review gộp):

| ID | Trạng thái |
| -- | ---------- |
| GATE-01 | D + H PASS; thiếu H mở lại cùng cổng và actor gán ở hai event. Sẵn sàng xin review gộp với phần thiếu ghi là giảm |
| GATE-04 | D + H PASS; thiếu revoke permission giữa request đang bay (race không tái hiện tất định). Sẵn sàng xin review gộp |
| GATE-06, 08, 09 | D (+U) PASS; giảm AC xuống D như bảng trên. Sẵn sàng xin review gộp |
| GATE-02 | D + H PASS trừ vế "cancel" chưa có implementation (phát hiện 1). Cần owner quyết định |
| GATE-05 | D + H PASS; AC "idempotency" mơ hồ (phát hiện 2, 3). Cần owner quyết định |
| GATE-07 | Cần thêm assertion D cho authz-on-retry (phát hiện 4) |
| GATE-03 | Bị chặn bởi signed QR (quyết định sản phẩm) |

### GATE: xử lý các mục còn mở — 02/11/2026

Owner trả lời "làm theo cách bạn suggestion". Gợi ý cụ thể của tôi chỉ có một mục; các mục còn lại là quyết định hành vi sản phẩm nên **không tự đổi contract**, chỉ ghi known gap.

| Mục | Xử lý | Ghi chú |
| --- | ----- | ------- |
| GATE-07 authz-on-retry | **Đã làm.** Thêm `packages/backend/test/offline-sync-authz-retry.test.cjs` (D) | Retry DUPLICATE trước khi thu quyền là vô hại; sau khi thu `event_assignments` thì `AuthzError`, sau khi revoke staff session thì `SESSION_NOT_ACTIVE`; `offline_sync_events` và `checkins` không đổi. Kiểm đột biến: bỏ kiểm quyền hoặc bỏ kiểm session làm test fail. CI: thêm vào shard `offline-sync-apply` |
| GATE-02 huỷ hold chủ động | **Known gap, chờ owner** | Chưa có thao tác trong API/domain; không viết test cho thứ chưa tồn tại và không tự thêm feature. Vế "cancel" của AC giữ BLOCKED |
| GATE-05 idempotency của undo | **Known gap, chờ owner** | Hành vi hiện tại (từ chối undo lần hai bằng 409 `CHECKIN_ALREADY_UNDONE`) đã được ghim ở D và H như *hành vi hiện tại*, không như quyết định. Đổi sang replay cần owner chốt contract |
| GATE-05 mã lỗi lý do trống | **Known gap, chờ owner** | Test không ghim mã (`CHECKIN_NOT_FOUND` ở domain, `SCOPE_REQUIRED` ở HTTP) |

**Giới hạn của GATE-07:** vế "mixed batch audit" ghi trong catalog cũ vẫn chỉ có ở `offline-sync-apply` (REJECTED/CONFLICT có audit idempotent, không inflate `rejectByReason` khi replay); không có assertion mới cho batch hỗn hợp trong cùng một request. H không viết, theo cùng giảm AC như GATE-06/08/09, rủi ro còn lại là ánh xạ route và JWT thật cho offline-sync.

**Trạng thái GATE sau bước này** (chưa ID nào đổi verdict; sẵn sàng xin review gộp): GATE-01, 04, 06, 07, 08, 09. Chờ owner: GATE-02, 05. Bị chặn sản phẩm: GATE-03.

## Các nhóm còn thiếu nghiệm thu toàn phần

Các dòng này giữ BLOCKED ở mức AC; không có nghĩa tất cả đều đã chứng minh có bug. Có thể thiếu test, runtime evidence, review hoặc contract; không đổi expected outcome để lấy PASS.

| ID                                                                 | P   | Lớp AC | Phần còn thiếu / điều kiện tiếp tục                                                                                                                                          |
| ------------------------------------------------------------------ | --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AUTH-06](https://github.com/hangndat/ticket-solution/issues/1029) | P0  | B/H    | Thiếu nhánh revoke/session-expiry đầy đủ và feedback UI sau mất quyền; không yêu cầu scan trên Portal (O23).                                                                 |
| [AUTH-07](https://github.com/hangndat/ticket-solution/issues/1029) | P0  | B/H    | Web #1048 + Portal #1055 đã merge; owner chấp nhận gap bfcache. Chưa đối chiếu gate toàn ID sau tích hợp; không gọi persisted=true đã kiểm.                                  |
| [AUTH-08](https://github.com/hangndat/ticket-solution/issues/1029) | P0  | B/H/D  | Thiếu full B/H/D cho consent, attempt key/retry unknown, một open request và revoke/erasure.                                                                                 |
| [PORT-01](https://github.com/hangndat/ticket-solution/issues/1035) | P0  | B      | #1070 partial: wizard thiếu quota configuration; public projection 404 sau publish cần đối chiếu product/contract.                                                           |
| [PORT-02](https://github.com/hangndat/ticket-solution/issues/1035) | P0  | B/H    | #1072 partial: chưa chứng minh Web publish/rollback delta; liên quan public projection/cache.                                                                                |
| [PORT-03](https://github.com/hangndat/ticket-solution/issues/1035) | P1  | B/H    | Thiếu full B clone/archive/cancel và isolation business records/notification policy.                                                                                         |
| [PORT-04](https://github.com/hangndat/ticket-solution/issues/1035) | P0  | B/H    | Quota page read-only; thiếu mutation surface/contract và capacity/permission/rollback branches.                                                                              |
| [PORT-10](https://github.com/hangndat/ticket-solution/issues/1035) | P1  | B/H    | Thiếu full portfolio/role boundary và runtime theo PLAN.                                                                                                                     |
| [PORT-11](https://github.com/hangndat/ticket-solution/issues/1035) | P0  | B/H/R  | Thiếu Portal staff invitation accept BFF/UI; product gap cần quyết định contract trước coding.                                                                               |
| [PORT-12](https://github.com/hangndat/ticket-solution/issues/1035) | P1  | B/H    | Thiếu full B/H self-serve PENDING/operator activation và isolation.                                                                                                          |
| [PORT-13](https://github.com/hangndat/ticket-solution/issues/1035) | P1  | B      | #1089 đã merge partial; pagination/filter/locale/saved view có evidence, sort thiếu UI/API contract. Không reset lịch sử fix.                                                |
| [PORT-14](https://github.com/hangndat/ticket-solution/issues/1035) | P0  | B/H    | Thiếu full B/H audit/export/cursor/permissions và no-leak theo PLAN.                                                                                                         |
| [PLAT-01](https://github.com/hangndat/ticket-solution/issues/1033) | P0  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [PLAT-02](https://github.com/hangndat/ticket-solution/issues/1033) | P0  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [PLAT-04](https://github.com/hangndat/ticket-solution/issues/1033) | P0  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [PLAT-05](https://github.com/hangndat/ticket-solution/issues/1033) | P1  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [DB-06](https://github.com/hangndat/ticket-solution/issues/1030)   | P0  | D      | Đề xuất #1057 chưa chốt quota-reduction command/retry budget; SQL diagnostic #1052 không thay đường runtime.                                                                 |
| [DB-09](https://github.com/hangndat/ticket-solution/issues/1030)   | P0  | D/H    | #1060 chỉ H một phần; signed QR GATE-03 và các quyết định trong GATE-03-SIGNED-QR-HANDOFF còn mở.                                                                            |
| [DB-12](https://github.com/hangndat/ticket-solution/issues/1030)   | P0  | D/H    | #1062 partial: preview no-store, canonical cache key host/tenant/event/version/locale, publish/rollback invalidation chưa đủ.                                                |
| [DB-13](https://github.com/hangndat/ticket-solution/issues/1030)   | P1  | D/H    | Thiếu H và đầy đủ lifecycle windows/timezone/deadline sau lock, clone/archive/cancel và policy vé đã cấp.                                                                    |
| [DB-17](https://github.com/hangndat/ticket-solution/issues/1030)   | P0  | D/H    | Thiếu H named presets/self-serve PENDING/operator activation, arbitrary permissions deny và limits/usage.                                                                    |
| [DB-18](https://github.com/hangndat/ticket-solution/issues/1030)   | P0  | D/H    | Thiếu H account deletion/revoke/job IdP retry và bảo toàn audit/đối soát.                                                                                                    |
| [DB-19](https://github.com/hangndat/ticket-solution/issues/1030)   | P1  | D/H    | Thiếu D/H rotation key/pepper version, fail-closed unsupported/revoked và bảo vệ key material.                                                                               |
| [GATE-01](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-02](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-03](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-04](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | D/H    | Thiếu full D/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-05](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-06](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-07](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-08](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [GATE-09](https://github.com/hangndat/ticket-solution/issues/1031) | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [JOB-04](https://github.com/hangndat/ticket-solution/issues/1032)  | P0  | D/H    | #1088 đã merge partial; tenant email budget runtime đã có `reserveEmailBudget` từ `47bc7b18`; còn thiếu full D/H resend/delivery budget matrix. Giữ 2/2 + ngoại lệ 1/1 + B1. |
| [JOB-05](https://github.com/hangndat/ticket-solution/issues/1032)  | P1  | B/H/D  | Thiếu runtime R template/reminder schedule và validation theo PLAN.                                                                                                          |
| [JOB-06](https://github.com/hangndat/ticket-solution/issues/1032)  | P0  | D/R    | Tenant email budget runtime đã có `reserveEmailBudget` từ `47bc7b18`; còn thiếu D/R cap/overlap/budget/backpressure matrix.                                                  |
| [JOB-07](https://github.com/hangndat/ticket-solution/issues/1032)  | P0  | H/D    | Thiếu H/R signed URL scope/expiry, export worker và recovery theo PLAN.                                                                                                      |
| [SEC-01](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [SEC-02](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | B/H    | Thiếu full B/H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [SEC-03](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | H      | Thiếu full H và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                  |
| [SEC-04](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [SEC-05](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | B/H/D  | Thiếu full B/H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                              |
| [SEC-06](https://github.com/hangndat/ticket-solution/issues/1036)  | P0  | H/D    | Thiếu full H/D và verdict độc lập theo PLAN; đối chiếu test hiện có trước bổ sung, không dùng D/U thay H/B/R.                                                                |
| [POL-02](https://github.com/hangndat/ticket-solution/issues/1034)  | P1  | D      | Thiếu ops đo event lớn/restore re-sweep; audit TTL deletion là policy gap riêng.                                                                                             |
| [POL-03](https://github.com/hangndat/ticket-solution/issues/1034)  | P1  | D/H    | Thiếu object write fence/MinIO stale PUT barrier, signed URL expiry và restore evidence; local không thay live ops.                                                          |
| [POL-04](https://github.com/hangndat/ticket-solution/issues/1034)  | P1  | B/H/D  | Thiếu B/ops privacy copy và restore RPO/RTO theo PLAN.                                                                                                                       |

**JOB-08 — OUT**, không tính vào 85 nhóm phải nghiệm thu.

## Giới hạn và thứ tự tiếp tục

- AUTH-02/DB-02: issuer phụ dùng signing key khác; 401 fail-closed không cô lập riêng issuer check khỏi signature/JWKS.
- WEB-09: REVOKED/CANCELLED là fixture state; không chứng minh product transition/cascade.
- JOB-01/02/03: PG outbox là durable state; Mailpit ACCEPTED không là Internet inbox/read receipt, không exactly-once SMTP. JOB-03 dùng relay subprocess thoát giữa SMTP accept và PG ack, chưa SIGKILL main worker tại đúng cửa sổ.
- AUTH-07: quyết định owner chấp nhận gap bfcache để merge #1055 vẫn giữ nguyên; không ghi đã chạy được persisted=true.
- PORT-09 giữ lịch sử 2/2 + ngoại lệ 1/1 + B1 đã hoàn tất. PORT-13 chỉ nghiệm thu phần pagination/filter/locale/saved views, không sort.
- DB-15: hai review O12 (`docs/reviews/D11-EVENTREPORT-O12-DOD.md:27`, `D11-PR-242-EVENTREPORT-O12-DOD.md:25`) nghiệm thu confirm→1, undo→0, giữ lịch sử; bổ sung test không tự đổi sang metric tích lũy.
- Ưu tiên nhóm test/evidence đã có contract; product gaps DB-06/09/12, PORT-01/04/11/13 cần quyết định tương ứng trước sửa runtime; JOB-04/06 còn thiếu full AC evidence trên budget đã triển khai. Không mở feature mới từ inventory này.
- F04 không chứng minh native camera/APNs, benchmark tải/SLO, production restore hoặc pilot GO; các gate đó theo roadmap riêng.
