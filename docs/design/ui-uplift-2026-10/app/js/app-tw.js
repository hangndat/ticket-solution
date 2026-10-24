/** D-2 Tailwind bundles for consumer app prototype templates. */
window.APP_TW = {
  demoStrip:
    "border-b border-white/10 bg-gradient-to-r from-[#1a2740] to-ink px-5 py-2 text-center text-[0.7rem] text-paper/80 [&_strong]:font-semibold [&_strong]:text-[#f9a8d4]",
  nav:
    "sticky top-0 z-20 flex h-[72px] items-center gap-5 border-b border-line bg-white/90 px-7 backdrop-blur-md",
  logo: "font-display text-[1.55rem] font-bold tracking-tight text-ink [&_span]:text-signal",
  navlinks: "hidden flex-1 items-center gap-1 md:flex",
  navlinkBtn:
    "min-h-[44px] rounded-sm px-3.5 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  navlinkOn: "font-semibold text-ink shadow-[inset_0_-2px_0_#E11D48]",
  navActions: "ml-auto flex items-center gap-2.5",
  locale:
    "flex overflow-hidden rounded-sm border border-line text-xs font-semibold",
  localeBtn: "min-h-9 bg-white px-2.5",
  localeOn: "bg-ink text-white",
  avatar: "flex items-center gap-2.5 text-sm font-medium",
  avatarIcon:
    "grid h-9 w-9 place-items-center rounded-full border border-signal/15 bg-[#fce7ef] text-[0.7rem] font-bold not-italic text-signal",
  mobileMenu:
    "mobile-menu-btn ml-auto inline-flex shrink-0 min-h-[44px] items-center whitespace-nowrap rounded-sm border border-line bg-white px-3 text-sm font-semibold md:hidden",
  main: "min-h-[640px] px-5 pb-24 pt-2 md:px-8",
  footer:
    "border-t border-line bg-white px-5 py-6 text-xs text-muted md:px-8 [&_nav]:mt-2 [&_nav]:flex [&_nav]:flex-wrap [&_nav]:gap-2",
  catalogHero: "border-b border-line bg-white px-5 py-10 md:px-8",
  catalogHeroInner: "mx-auto max-w-3xl",
  eyebrow: "mb-2 text-xs font-bold uppercase tracking-widest text-signal",
  tools: "mx-auto flex max-w-5xl flex-col gap-3 px-5 py-6 md:flex-row md:items-center md:px-8",
  searchWrap:
    "flex flex-1 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 shadow-sm",
  search:
    "min-h-[44px] w-full border-0 bg-transparent text-sm outline-none focus-visible:ring-0",
  help: "text-sm text-muted",
  grid: "mx-auto grid max-w-5xl gap-4 px-5 pb-10 sm:grid-cols-2 lg:grid-cols-3 md:px-8",
  eventWrap: "flex flex-col gap-2",
  eventCard:
    "group w-full overflow-hidden rounded-xl border border-line bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  eventArt:
    "relative flex h-32 items-end p-4 text-white before:absolute before:inset-0 before:bg-black/20",
  eventArtTitle: "relative z-[1] font-display text-lg font-bold",
  eventBody: "p-4",
  eventMeta: "mb-1 flex items-center justify-between text-xs text-muted",
  badgeDemo:
    "rounded-full bg-signal/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-signal",
  ownedStrip:
    "flex items-center justify-between rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium",
  btn:
    "inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  btnPrimary: "bg-signal text-white hover:brightness-105",
  btnSecondary: "border border-line bg-white text-ink hover:bg-paper",
  btnGhost: "w-auto justify-start px-0 text-sm font-medium text-muted hover:text-ink",
  btnDestructive: "bg-[#be123c] text-white",
  narrow: "mx-auto max-w-lg px-5 py-8",
  pageIntro: "mb-6",
  formCard: "rounded-xl border border-line bg-white p-5 shadow-sm",
  formCardLabel: "mb-1.5 block text-sm font-medium",
  formCardInput:
    "mb-4 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  termsBox:
    "mb-4 max-h-40 overflow-y-auto rounded-md border border-line bg-paper p-3 text-xs leading-relaxed text-muted",
  checkRow: "mb-3 flex gap-2 text-sm",
  formError:
    "mb-3 rounded-md bg-[#fff1f2] px-3 py-2 text-sm text-[#be123c]",
  surfaceState: "mx-auto max-w-md py-12 text-center",
  stateIcon:
    "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl",
  stateLoading: "bg-paper text-muted",
  stateError: "bg-[#fff1f2] text-[#be123c]",
  stateEmpty: "bg-paper text-muted",
  notice: "rounded-md border border-line bg-paper p-4 text-sm",
  noticeError: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
  successPanel: "py-12 text-center",
  successRing:
    "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ecfdf3] text-2xl text-[#15803d]",
  walletHeader:
    "mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4",
  ticketGrid: "grid gap-4 sm:grid-cols-2",
  ticketCard: "rounded-xl border border-line bg-white p-4 shadow-sm",
  tag: "inline-block rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[0.65rem] font-bold uppercase text-[#15803d]",
  textlink: "text-sm font-semibold text-focus underline-offset-2 hover:underline",
  cols: "grid gap-8 lg:grid-cols-[1.2fr_0.8fr]",
  sidebox: "rounded-xl border border-line bg-white p-5 shadow-sm",
  sideboxHighlight: "border-signal/20 bg-signal/5",
  qrPanel: "text-center",
  group: "divide-y divide-line overflow-hidden rounded-xl border border-line bg-white",
  rowBtn:
    "flex w-full min-h-[44px] items-center justify-between px-4 py-3 text-left text-sm hover:bg-paper",
  accountLayout: "mt-6 grid gap-6 lg:grid-cols-[200px_1fr]",
  accountNav: "flex flex-col gap-1",
  toast:
    "fixed bottom-6 left-1/2 z-50 w-[min(100%-2rem,24rem)] -translate-x-1/2 rounded-lg border border-line bg-white p-4 text-sm shadow-lg",
  modalBackdrop:
    "fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4",
  dialog: "w-full max-w-sm rounded-xl bg-white p-6 shadow-lg",
  skeletonGrid: "mx-auto grid max-w-5xl gap-4 px-5 sm:grid-cols-3 md:px-8",
  skel: "h-40 animate-pulse rounded-xl bg-line/60",
};
