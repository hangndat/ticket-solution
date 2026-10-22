(function () {
  const copy = {
    vi: {
      skip: "Bỏ qua nội dung",
      navFeatures: "Tính năng",
      navHow: "Cách hoạt động",
      navSolutions: "Giải pháp",
      navFaq: "Câu hỏi thường gặp",
      navDemo: "Xem demo",
      navInterest: "Quan tâm",
      navLogin: "Đăng nhập",
      navPrivacy: "Quyền riêng tư",
      navSupport: "Hỗ trợ",
      heroEyebrow: "Hệ điều hành sự kiện trực tiếp",
      heroH1: "Vận hành sự kiện từ mã mời đến cổng — trên một hệ điều hành",
      heroSub:
        "Multi-tenant cho agency và doanh nghiệp sự kiện. Khách thấy thương hiệu của bạn; cổng có audit, không phụ thuộc marketplace.",
      heroDemo: "Xem demo",
      heroInterest: "Đăng ký quan tâm",
      heroLogin: "Đăng nhập",
      heroNote: "Demo giả lập — không phải khách hàng thật.",
      heroP1: "Mã mời → đổi vé → QR ký theo sự kiện",
      heroP2: "Cổng chống trùng + audit",
      heroP3: "Tách tenant + RLS + deny-by-default",
      previewCaption:
        "UI composition có nhãn Demo — không dữ liệu khách thật.",
      tabWallet: "Vé & ví",
      tabGate: "Cổng",
      uiNavWallet: "Vé của tôi",
      uiNavGate: "Cổng · Quét vé",
      uiWalletTitle: "Vé của tôi",
      uiWalletSub: "3 vé · 2 sự kiện (demo)",
      uiDemoPill: "Demo",
      uiTicketUnused: "Chưa sử dụng",
      uiEventRiver: "Đêm nhạc bên sông",
      uiGateHint: "Hướng camera vào mã QR trên vé",
      uiGateOk: "Quét hợp lệ · audit ghi nhận",
      uiGateDup: "Chống trùng: bật",
      uiGateEvent: "Sự kiện: MFest (fixture)",
      uiPhoneMeta: "Vé phổ thông · Cổng A",
      trustTitle: "Tin cậy cho vận hành cổng thật",
      trustLead:
        "Thiết kế cho sự kiện trực tiếp — không dashboard «ảo real-time».",
      trust1t: "Tách tenant",
      trust1b:
        "PostgreSQL shared schema + RLS và phân quyền deny-by-default theo tenant.",
      trust2t: "Cổng chống trùng",
      trust2b:
        "Check-in ghi audit; QR ký theo sự kiện; thu hồi vé vô hiệu mã cũ.",
      trust3t: "Cổng khi mạng yếu",
      trust3b:
        "D7: luồng cổng multi-device có thiết kế offline — không hứa «luôn online 100%».",
      trust4t: "Số liệu trung thực",
      trust4b:
        "Dashboard ops kèm mốc cập nhật lúc; pilot mục tiêu trễ ≤10s.",
      trust5t: "Bảo mật vận hành",
      trust5b:
        "TLS, rate limit, MFA admin, log không chứa token QR/OTP thô.",
      bentoTitle: "Năng lực vận hành trong một hệ",
      bentoLead:
        "Mỗi khối là luồng thật trong sản phẩm — không slide «tương lai».",
      howTitle: "Cách hệ điều hành chạy",
      howLead: "Một chuỗi ops — từ chuẩn bị đến cổng.",
      howNote: "Không phải marketplace «tìm sự kiện gần bạn».",
      solTitle: "Giải pháp theo đối tượng",
      solLead:
        "Trang này dành cho người mua vận hành — không phải khách cầm vé.",
      outTitle: "Kết quả vận hành (minh họa)",
      outDisclaimer:
        "Minh hoạ — dữ liệu mô phỏng, không phải khách hàng thật.",
      outLead:
        "Số dưới đây giải thích loại chỉ số bạn theo dõi trong pilot — không phải benchmark đã ký hợp đồng.",
      faqTitle: "Câu hỏi thường gặp",
      ctaTitle: "Sẵn sàng xem vận hành thật?",
      ctaLead:
        "Xem demo giả lập hoặc để lại thông tin — chúng tôi liên hệ onboarding.",
      formTitle: "Đăng ký quan tâm",
      formLead:
        "Không thanh toán trên form này. Onboarding tenant ACTIVE qua Operator.",
      formSubmit: "Gửi đăng ký",
      footerAttendee: "Bạn có mã mời? Đổi vé trên ứng dụng",
      footerTag: "vemoki↗ · Event Operating System cho sự kiện trực tiếp",
      marquee:
        "EOS · Invite → QR → Gate · Multi-tenant · Audit · Pilot demo · Không marketplace ·",
      solOwner:
        "Nhiều sự kiện trong một tổ chức: phát hành mã, email vé, theo dõi cổng, báo cáo ops.",
      solAgency:
        "Membership nhiều tenant — một hệ điều hành, nhiều thương hiệu khách, không fork code.",
      solStaff:
        "Quét QR trên iOS; web dự phòng; audit theo sự kiện.",
      solGuest:
        "Đổi mã trên web/iOS dưới brand sự kiện — xem footer attendee link.",
    },
    en: {
      skip: "Skip to content",
      navFeatures: "Features",
      navHow: "How it works",
      navSolutions: "Solutions",
      navFaq: "FAQ",
      navDemo: "View demo",
      navInterest: "Register interest",
      navLogin: "Log in",
      navPrivacy: "Privacy",
      navSupport: "Support",
      heroEyebrow: "In-person event operating system",
      heroH1: "Run events from invite to gate — on one operating system",
      heroSub:
        "Multi-tenant for agencies and enterprise event teams. Your brand for guests; audited gate — not a marketplace.",
      heroDemo: "View demo",
      heroInterest: "Register interest",
      heroLogin: "Log in",
      heroNote: "Simulated demo — not a real customer.",
      heroP1: "Invite → redeem → event-scoped signed QR",
      heroP2: "Duplicate-safe gate + audit",
      heroP3: "Tenant isolation + RLS + deny-by-default",
      previewCaption:
        "Demo-labeled UI composition — no real guest data.",
      tabWallet: "Wallet",
      tabGate: "Gate",
      uiNavWallet: "My tickets",
      uiNavGate: "Gate · Scan",
      uiWalletTitle: "My tickets",
      uiWalletSub: "3 tickets · 2 events (demo)",
      uiDemoPill: "Demo",
      uiTicketUnused: "Unused",
      uiEventRiver: "Riverside night",
      uiGateHint: "Point the camera at the ticket QR",
      uiGateOk: "Valid scan · audit recorded",
      uiGateDup: "Duplicate block: on",
      uiGateEvent: "Event: MFest (fixture)",
      uiPhoneMeta: "General · Gate A",
      trustTitle: "Built for real gate operations",
      trustLead:
        "Designed for in-person events — not vanity real-time dashboards.",
      trust1t: "Tenant isolation",
      trust1b:
        "Shared PostgreSQL with RLS and deny-by-default tenant authz.",
      trust2t: "Duplicate-safe admission",
      trust2b:
        "Audited check-in; event-scoped signed QR; revocation rotates tokens.",
      trust3t: "Gate when connectivity is limited",
      trust3b:
        "D7: multi-device gate designed for limited connectivity — not «100% online only».",
      trust4t: "Honest metrics",
      trust4b:
        "Ops views show an as of time; pilot target latency ≤10s.",
      trust5t: "Security baseline",
      trust5b:
        "TLS, rate limits, admin MFA, logs exclude raw QR/OTP tokens.",
      bentoTitle: "Operations capabilities in one system",
      bentoLead:
        "Each tile is a real product flow — not a future roadmap slide.",
      howTitle: "How the operating system runs",
      howLead: "One ops chain — from prep to the gate.",
      howNote: "Not a «events near you» marketplace.",
      solTitle: "Solutions by audience",
      solLead:
        "This page is for operations buyers — not guests holding a ticket.",
      outTitle: "Operational outcomes (illustration)",
      outDisclaimer:
        "Illustration — simulated data, not real customers.",
      outLead:
        "Figures below show the kinds of metrics you track in pilot — not contracted benchmarks.",
      faqTitle: "Frequently asked questions",
      ctaTitle: "Ready to see real operations?",
      ctaLead:
        "Try the simulated demo or leave your details — we’ll follow up on onboarding.",
      formTitle: "Register your interest",
      formLead:
        "No payment on this form. Tenant ACTIVE onboarding is via Operator.",
      formSubmit: "Submit",
      footerAttendee: "Have an invite code? Redeem on the app",
      footerTag: "vemoki↗ · Event Operating System for in-person events",
      marquee:
        "EOS · Invite → QR → Gate · Multi-tenant · Audit · Pilot demo · Not a marketplace ·",
      solOwner:
        "Multiple events in one org: codes, ticket email, gate tracking, ops reports.",
      solAgency:
        "Membership across tenants — one OS, many client brands, no code forks.",
      solStaff:
        "Scan on iOS; web fallback; per-event audit.",
      solGuest:
        "Redeem on web/iOS under the event brand — see footer attendee link.",
    },
  };

  const faq = {
    vi: [
      [
        "Vemoki có phải marketplace bán vé không?",
        "Không. Vemoki là hệ vận hành in-person: mã mời, QR, cổng — không «tìm sự kiện» công khai như marketplace.",
      ],
      [
        "Có thanh toán hoặc bán vé trả phí trên nền tảng?",
        "MVP không có checkout, refund hay chuyển nhượng trên platform.",
      ],
      [
        "Demo có phải khách hàng thật?",
        "Không. Demo hiện tại là fixture giả lập để xem sản phẩm.",
      ],
      [
        "Ai là người mua trang này?",
        "Tenant Owner, agency và đội vận hành doanh nghiệp — không phải khách cầm vé.",
      ],
      [
        "Khách đổi mã ở đâu?",
        "Trên app.vemoki.com (web/iOS) dưới brand sự kiện — link từ footer marketing.",
      ],
      [
        "Cổng hoạt động khi mạng yếu?",
        "Có thiết kế cổng multi-device offline (D7); không hứa mọi tình huống «online only».",
      ],
      [
        "White-label nghĩa là gì?",
        "Khách thấy brand org/sự kiện; Vemoki hiện ở marketing, tài khoản và đăng nhập.",
      ],
      [
        "Dữ liệu tenant có tách biệt?",
        "Có — shared PostgreSQL với RLS và phân quyền deny-by-default (O08).",
      ],
      [
        "Có app Android?",
        "MVP tập trung iOS cho scanner; Android native không trong phạm vi O10.",
      ],
      [
        "Làm sao bắt đầu sau khi gửi form quan tâm?",
        "Chúng tôi liên hệ email — onboarding tenant ACTIVE qua Operator, không tự kích hoạt từ form marketing.",
      ],
    ],
    en: [
      [
        "Is Vemoki a ticket marketplace?",
        "No. Vemoki is in-person ops: invites, QR, gate — not public event discovery like a marketplace.",
      ],
      [
        "Paid checkout on the platform?",
        "MVP has no checkout, refunds, or transfers on-platform.",
      ],
      [
        "Is the demo a real customer?",
        "No. Current demos are simulated fixtures to explore the product.",
      ],
      [
        "Who is this page for?",
        "Tenant owners, agencies, and enterprise ops teams — not ticket-holding guests.",
      ],
      [
        "Where do guests redeem?",
        "On app.vemoki.com (web/iOS) under the event brand — see marketing footer.",
      ],
      [
        "Gate with poor connectivity?",
        "Multi-device offline gate is in scope (D7); we do not promise «online only» for every edge case.",
      ],
      [
        "What does white-label mean?",
        "Guests see org/event brand; Vemoki appears on marketing, account, and sign-in.",
      ],
      [
        "Is tenant data isolated?",
        "Yes — shared PostgreSQL with RLS and deny-by-default authz (O08).",
      ],
      [
        "Android app?",
        "MVP focuses on iOS for scanning; native Android is out of scope (O10).",
      ],
      [
        "After interest form, what's next?",
        "We follow up by email — tenant ACTIVE is via Operator, not auto from the marketing form.",
      ],
    ],
  };

  const bento = {
    vi: [
      ["Mã mời → vé", "Nguồn mã, quota, đổi mã có xác minh email.", "M02–M03"],
      ["Vé & QR ký", "Token ký theo sự kiện; không nhúng PII trong QR.", "M04"],
      ["Cổng & audit", "Quét iOS/web dự phòng; chống trùng; log staff/device.", "M06–M07"],
      ["Cổng multi-device", "Thiết kế offline D7; vé xem offline trên app.", "D7"],
      ["Quản trị sự kiện", "Sự kiện, loại vé, import khách, email vé.", "M01, M05"],
      ["White-label khách", "Brand org/event trên trang khách; platform ở marketing/IdP.", "D8"],
      ["Ops & báo cáo", "Dashboard gần real-time pilot; báo cáo có định nghĩa chỉ số.", "M08"],
    ],
    en: [
      ["Invite → ticket", "Code sources, quotas, redeem with verified email.", "M02–M03"],
      ["Signed QR tickets", "Event-scoped signed tokens; no PII in QR payload.", "M04"],
      ["Gate & audit", "iOS scan + web fallback; duplicate block; staff/device audit.", "M06–M07"],
      ["Multi-device gate", "D7 offline gate design; ticket display offline in app.", "D7"],
      ["Event administration", "Events, ticket types, guest import, ticket email.", "M01, M05"],
      ["Guest white-label", "Org/event brand on guest surfaces; platform on marketing/IdP.", "D8"],
      ["Ops reporting", "Near real-time pilot dashboard; defined metrics in reports.", "M08"],
    ],
  };

  const steps = {
    vi: [
      "Tạo sự kiện & loại vé / nguồn mã",
      "Phát hành mã hoặc import khách",
      "Khách đổi mã → nhận QR",
      "Cổng quét, chống trùng, ghi audit",
      "Theo dõi ops với mốc cập nhật lúc",
    ],
    en: [
      "Create the event, ticket types, and code sources",
      "Issue invites or import guests",
      "Guests redeem → receive QR",
      "Gate scans, blocks duplicates, writes audit",
      "Track ops with an honest as of timestamp",
    ],
  };

  let locale = "vi";
  let device = "desktop";
  let previewTab = "wallet";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  }

  function setLocale(next) {
    locale = next;
    document.documentElement.lang = locale;
    const c = copy[locale];
    $all("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (c[key] !== undefined) el.textContent = c[key];
    });
    const solKeys = ["solOwner", "solAgency", "solStaff", "solGuest"];
    $all(".mkt-audience-card p").forEach((el, i) => {
      const key = solKeys[i];
      if (key && c[key]) el.textContent = c[key];
    });
    renderFaq();
    renderBento();
    updatePreviewPanels();
    $("#locale-vi")?.setAttribute("aria-pressed", locale === "vi" ? "true" : "false");
    $("#locale-en")?.setAttribute("aria-pressed", locale === "en" ? "true" : "false");
  }

  function setDevice(d) {
    device = d;
    const browser = $("#browser");
    browser?.classList.toggle("mobile", d === "mobile");
    $("#btn-desktop")?.classList.toggle("on", d === "desktop");
    $("#btn-mobile")?.classList.toggle("on", d === "mobile");
    updatePreviewPanels();
  }

  function updatePreviewPanels() {
    const url = $("#preview-url");
    if (url) {
      url.textContent =
        previewTab === "wallet"
          ? "app.vemoki.com/wallet"
          : "app.vemoki.com/gate";
    }
    $all("[data-preview-panel]").forEach((panel) => {
      const on = panel.dataset.previewPanel === previewTab;
      panel.hidden = !on;
    });
  }

  function setPreviewTab(tab) {
    previewTab = tab;
    $all(".mkt-preview-tabs button").forEach((btn) => {
      btn.setAttribute(
        "aria-selected",
        btn.dataset.preview === tab ? "true" : "false",
      );
    });
    updatePreviewPanels();
  }

  function renderFaq() {
    const root = $("#faq-root");
    if (!root) return;
    root.innerHTML = faq[locale]
      .map(
        ([q, a], i) => `
      <div class="mkt-faq-item" data-open="${i === 0 ? "true" : "false"}">
        <button type="button" class="mkt-faq-trigger" aria-expanded="${i === 0 ? "true" : "false"}" aria-controls="faq-panel-${i}" id="faq-trigger-${i}">
          <span>${q}</span>
          <span class="mkt-faq-icon" aria-hidden="true">+</span>
        </button>
        <div class="mkt-faq-panel" id="faq-panel-${i}" role="region" aria-labelledby="faq-trigger-${i}">
          <div class="mkt-faq-panel-inner">${a}</div>
        </div>
      </div>`,
      )
      .join("");
    $all(".mkt-faq-trigger", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".mkt-faq-item");
        const open = item.dataset.open === "true";
        item.dataset.open = open ? "false" : "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
      });
    });
  }

  function renderBento() {
    const cells = [
      "invite",
      "qr",
      "gate",
      "offline",
      "admin",
      "whitelabel",
      "ops",
    ];
    const root = $("#bento-root");
    if (!root) return;
    const visuals = {
      invite: `<div class="mkt-bento-visual mkt-bento-visual--invite" aria-hidden="true">
        <span class="mkt-bento-event mkt-bento-event--a">MFest</span>
        <span class="mkt-bento-event mkt-bento-event--b">${locale === "vi" ? "Đêm nhạc" : "Riverside"}</span>
        <span class="mkt-bento-event mkt-bento-event--c">${locale === "vi" ? "Sắc màu ST" : "Creative"}</span>
        <span class="mkt-bento-visual__demo">Demo</span>
      </div>`,
      gate: `<div class="mkt-bento-visual mkt-bento-visual--gate" aria-hidden="true"><span></span></div>`,
      ops: `<div class="mkt-bento-ops-metrics" aria-hidden="true">
        <div><strong>1.240</strong><span>${locale === "vi" ? "vé (demo)" : "tickets (demo)"}</span></div>
        <div><strong>14</strong><span>${locale === "vi" ? "trùng chặn" : "dup blocked"}</span></div>
        <div><strong>≤10s</strong><span>${locale === "vi" ? "độ trễ pilot" : "pilot latency"}</span></div>
      </div>`,
    };
    root.innerHTML = bento[locale]
      .map(([title, body, tag], i) => {
        const cls = cells[i];
        const extra = cls === "ops" ? " mkt-bento-cell--ops" : "";
        const visual = visuals[cls] ? visuals[cls] : "";
        return `<article class="mkt-bento-cell mkt-bento-cell--${cls}${extra}">
          <span class="mkt-bento-tag">${tag}</span>
          <h3>${title}</h3>
          <p>${body}</p>
          ${visual}
        </article>`;
      })
      .join("");
  }

  function renderSteps() {
    const root = $("#steps-root");
    if (!root) return;
    root.innerHTML = steps[locale]
      .map(
        (text, i) => `
      <div class="mkt-step">
        <div class="mkt-step-num">${i + 1}</div>
        <p>${text}</p>
        <div class="mkt-step-visual mkt-step-visual--${i + 1}" aria-hidden="true"></div>
      </div>`,
      )
      .join("");
  }

  function initHeaderInk() {
    const header = $(".mkt-header");
    const hero = $("#top");
    if (!header || !hero) return;
    const onScroll = () => {
      const heroBottom = hero.getBoundingClientRect().bottom;
      header.classList.toggle("mkt-header--on-ink", heroBottom > 72);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.querySelector(".site")?.addEventListener("scroll", onScroll, {
      passive: true,
    });
    onScroll();
  }

  function initForm() {
    const form = $("#interest-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = $("#form-status");
      if (status) {
        status.hidden = false;
        status.textContent =
          locale === "vi"
            ? "Đã nhận đăng ký (prototype — không gửi server)."
            : "Interest received (prototype — no server).";
        status.setAttribute("role", "status");
      }
    });
  }

  window.device = setDevice;
  window.setLocale = setLocale;
  window.setPreviewTab = setPreviewTab;

  document.addEventListener("DOMContentLoaded", () => {
    renderBento();
    renderSteps();
    renderFaq();
    setLocale("vi");
    setDevice("desktop");
    setPreviewTab("wallet");
    initHeaderInk();
    initForm();
    $(".mkt-hero-copy")?.classList.add("mkt-fade-in");
  });
})();
