# Process — vệ sinh CI / PR (coordinator root)

Ngày đối soát: **2026-10-17**  
Checkout base: `origin/main` = **`ed6f0dd7f7703e3c85972151303f4a7eaeb37f21`** (Merge PR #52)  
Worker: `hangndat/opt-ci-pr-hygiene` · **Không** merge `main` · **Không** đóng PR của owner khác · **Không** SaaS Turbo Remote Cache.

Phạm vi exclusive: `.github/workflows/ci.yml`, root scripts (khi có), file này. **Không** đụng ROADMAP/AGENTS/`.cursor` rules/PR template/`apps/*`/lockfile.

---

## 1. Tối ưu CI đã áp (low-risk)

| Thay đổi | Lý do | Giữ nguyên |
| --- | --- | --- |
| Cache Actions cho thư mục `.turbo` (local) | Tăng tốc `pnpm lint/typecheck/test/build` qua Turbo local; **không** `TURBO_TOKEN` / remote cache | Full pipeline khi đụng code/tooling |
| `TURBO_TELEMETRY_DISABLED=1`, `TURBO_CACHE_DIR=.turbo` | Tắt telemetry; neo cache dir rõ ràng | ADR-11 cấm SaaS runtime |
| Early-exit `check` + `database-isolation` khi PR **chỉ** đổi `docs/**` | Giảm phút CI cho PR evidence/docs | Push `main` luôn full; mọi path ngoài `docs/` (gồm `pnpm-lock.yaml`, `packages/**`, `scripts/**`, `.github/**`, `package.json`, `turbo.json`, `apps/**`, `infra/**`) → **full checks** |

Tên job giữ nguyên (`check`, `database-isolation`) để required checks (nếu có) vẫn nhận conclusion SUCCESS khi docs-only.

---

## 2. PR #53 — restore smoke `apps/api/dist/main.js` (điều phối, không duplicate)

| Mục | Evidence exact |
| --- | --- |
| PR | [#53](https://github.com/hangndat/ticket-solution/pull/53) `hangndat/d5-issue25-obs-load` |
| Head (lúc audit) | `2a181e60f96a85d3bf848df241d34db15ea858ca` |
| Owner active | worktree `vemoki-infra-complete` — đang làm platform Keycloak (terminal fail sẵn sàng :18089); **chưa** sửa build prerequisite trong `ci.yml` local |
| CI fail | Job `d5-hardening-smoke` run [38993852636](https://github.com/hangndat/ticket-solution/actions/runs/38993852636) · log: `apps/api/dist/main.js missing — build API before reconnect smoke` |
| Root cause | Job không `pnpm install` / không build `@ticket/api` trước `./scripts/d5-business-restore-drill.sh`; script hard-fail khi thiếu `dist/main.js` |
| Trạng thái fix | **Vẫn thiếu** trên head PR53 — **không** sửa checkout infra; comment điều phối trên #53 với patch đề xuất |

### Patch đề xuất cho owner #53 (chèn trước bước Business restore)

```yaml
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build API (reconnect smoke cần apps/api/dist/main.js)
        run: |
          pnpm --filter @ticket/contracts build
          pnpm --filter @ticket/backend build
          pnpm --filter @ticket/api build
      - name: Business + key restore drill
        run: ./scripts/d5-business-restore-drill.sh
```

Observability/fixture/admission steps không cần dist — có thể giữ trước hoặc sau; chỉ bước business restore bắt buộc có `main.js`.

**Blocker thực tế:** CI #53 đỏ cho đến khi owner áp patch (hoặc tương đương) trên branch của họ.

---

## 3. Đối soát PR #33 / #42 vs `main` (`ed6f0dd`)

**Không** `gh pr close` · **Không** merge `main` từ worker này.

### PR #33 — docs D2 (`hangndat/d2-cap-nhat-evidence`) — OPEN, CONFLICTING

| | |
| --- | --- |
| Nội dung | `docs/ROADMAP.md` (snapshot D2 đang làm) + **`docs/reviews/D2-ACCEPTANCE-2026-10-17.md`** (evidence D2 độc nhất ~144 dòng) |
| Vs main sau #51 | ROADMAP trên `main` đã tiến D4/D5 verify — delta #33 **lỗi thời** về trạng thái đợt; file D2-ACCEPTANCE **chưa** có trên `main` |
| Superseded | Phần ROADMAP checkbox/timeline D2 trong #33 **superseded** bởi #51 (`8b200c2`) + tiến độ D4/D5 sau đó |
| Missing / preserve | **`D2-ACCEPTANCE-2026-10-17.md` vẫn missing trên main** — cần rebase #33, giữ file acceptance, bỏ/thu hẹp ROADMAP delta |
| Hành động worker này | Báo cáo only; owner #33 rebase |

### PR #42 — Vemoki brand + VPS deploy (`hangndat/d1-vps-runtime`) — OPEN, CONFLICTING

| | |
| --- | --- |
| Head | `ec98778` |
| CI (lúc audit) | `check` FAIL · `database-isolation` PASS (run gắn PR) |
| Reviewer workspace | `vemoki-pr42-review` @ `ec98778` — **chưa** thấy review GitHub formal trên #42 |
| Đã port sang #53 (root) | `brand/vemoki/**`, `.dockerignore`, `infra/deploy/**`, deploy skill (bỏ SSH IP), `infra/keycloak/realm-ticket.json` (dual scheme), DECISION-LOG O09/ADR-16 — xem `D5-DOCS-RECONCILE-PR42.md` trên branch #53 |
| Superseded (root) | Brand pack + deploy compose/Docker + realm dual URI + skill deploy — **đã port** vào #53; không drop work |
| Vẫn missing trên main / ngoài #53 | `apps/web/**`, `apps/mobile/**` branding (một phần mobile đã vào main qua #52), `.env.example` `SMTP_FROM=noreply@vemoki.com`, `README.md` / PRD / TECHNICAL-DESIGN rename nhẹ, `packages/backend` email-adapter from, `pnpm-lock.yaml` delta, PDF FUN-FEST |
| Hành động | Không sửa branch #42; sau khi #53 land, owner #42 rebase/tách PR web·iOS còn lại; coordinator có thể đánh dấu superseded **sau** khi consumer PR ổn định |

### PR #53 — infra #25 — OPEN

| | |
| --- | --- |
| Đã có | drills, load harness, observability, admission S4, port root từ #42, docs reconcile |
| Blocker CI | `d5-hardening-smoke` thiếu build API (mục 2) |
| Ownership | `vemoki-infra-complete` (+ rereview) — D4/D5 infra; worker hygiene **không** edit checkout đó |

---

## 4. Project #3 (evidence)

Live lúc audit (không đổi Status trừ evidence comment nếu cần):

- D4 parent #5 · D5 parent #6 · #22 web · #23 iOS · #25 obs/load · #56 BE gap → **Đang làm**
- #26 UAT TestFlight → **Chờ duyệt**
- #52 đã merge `main` (`ed6f0dd`)

---

## 5. Kiểm chứng worker hygiene (sau khi land PR này)

```bash
# Workflow parse
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"

# Diff chỉ docs → docs_only logic (mô phỏng)
git diff --name-only ed6f0dd...HEAD

# Full check local khi đụng CI (không docs-only)
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck
```

Limitations: không đo được hit-rate Turbo cache trên Actions trước khi PR chạy; không claim RTO/RPO; không sửa #53.

---

## 6. Kết luận

1. Hygiene CI: Turbo local cache + docs-only early-exit — **đã implement** trên branch này.  
2. PR53 restore smoke: **vẫn fail** — chờ owner infra áp build prerequisite; đã điều phối bằng comment + bảng trên.  
3. PR33: preserve D2-ACCEPTANCE; ROADMAP delta superseded.  
4. PR42: root brand/deploy superseded-by-port vào #53; apps/* còn missing / thuộc worker khác; không close #42.
