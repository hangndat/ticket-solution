#!/usr/bin/env python3
"""Append Tailwind utilities to marketing index (keeps mkt-* as JS hooks only)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "marketing/index.html"

# mkt-* hook -> tailwind utilities (styling source of truth for D-2)
HOOK_TW: dict[str, str] = {
    "mkt-body": "min-h-full font-sans text-ink antialiased bg-paper",
    "mkt-skip": "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-3 focus:text-paper",
    "mkt-header": "sticky top-0 z-20 flex min-h-[72px] items-center gap-6 border-b border-line bg-paper/90 px-5 backdrop-blur-md transition-colors",
    "mkt-header--on-ink": "border-white/10 bg-ink/90 text-paper",
    "mkt-wordmark": "font-display text-[1.65rem] font-bold tracking-tight text-inherit no-underline [&_span]:text-signal",
    "mkt-nav": "ml-auto flex flex-1 flex-wrap items-center justify-end gap-1",
    "mkt-nav-links": "hidden items-center gap-0.5 lg:inline-flex",
    "mkt-nav-links-show": "inline-flex items-center gap-0.5",
    "mkt-locale": "mr-2 inline-flex items-center gap-1 rounded-[10px] bg-ink/5 p-1",
    "mkt-btn": "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-transparent px-5 py-2.5 text-sm font-semibold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
    "mkt-btn--primary": "bg-signal text-white shadow-[0_4px_20px_rgba(225,29,72,0.12)] hover:brightness-105",
    "mkt-btn--secondary": "border-line bg-white text-ink",
    "mkt-btn--ghost": "bg-transparent font-semibold text-inherit",
    "mkt-btn--block": "w-full",
    "mkt-nav-cta": "ml-0.5 hidden lg:inline-flex",
    "mkt-nav-cta-primary": "hidden lg:inline-flex",
    "mkt-mobile-menu": "ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-line bg-white px-3 text-sm font-semibold lg:hidden",
    "mkt-section": "relative px-5 py-16 md:py-24",
    "mkt-section--ink": "overflow-hidden bg-ink text-paper before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(225,29,72,0.15),transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_80%,rgba(37,99,235,0.12),transparent_50%)]",
    "mkt-section--paper": "bg-paper",
    "mkt-section--paper-alt": "bg-[#eef1f5]",
    "mkt-section--cta": "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(225,29,72,0.08),transparent_50%)]",
    "mkt-wrap": "relative z-[1] mx-auto max-w-[1120px]",
    "mkt-hero": "pb-8",
    "mkt-hero-grid": "grid items-center gap-12 lg:grid-cols-2",
    "mkt-eyebrow": "mb-3 text-xs font-bold uppercase tracking-[0.14em] text-signal",
    "mkt-display": "font-display font-bold tracking-tight",
    "mkt-h1": "text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08]",
    "mkt-h2": "mb-3 text-[clamp(1.65rem,3vw,2.35rem)]",
    "mkt-lead": "max-w-[38rem] text-base text-muted",
    "mkt-hero-points": "mt-6 space-y-2 text-sm text-paper/85",
    "mkt-hero-cta": "mt-8 flex flex-wrap gap-3",
    "mkt-demo-note": "mt-4 text-xs text-muted",
    "mkt-preview-wrap": "relative",
    "mkt-preview-glow": "pointer-events-none absolute -inset-8 opacity-80",
    "mkt-preview-stage": "relative",
    "mkt-preview-tilt": "transition-transform duration-300 hover:-rotate-1",
    "mkt-preview-frame": "overflow-hidden rounded-xl border border-white/10 bg-ink/40 shadow-[0_32px_80px_rgba(11,18,32,0.22)]",
    "mkt-preview-chrome": "flex items-center gap-1.5 border-b border-white/10 bg-ink/60 px-3 py-2 text-[10px] text-paper/60 [&_i]:h-2 [&_i]:w-2 [&_i]:rounded-full [&_i]:bg-paper/30",
    "mkt-preview-tabs": "flex gap-1 border-b border-white/10 bg-ink/30 p-1",
    "mkt-preview-viewport": "min-h-[220px] bg-paper p-3 text-ink",
    "mkt-ui-compose": "rounded-lg border border-line bg-white text-xs shadow-sm",
    "mkt-ui-compose__bar": "flex items-center justify-between border-b border-line px-3 py-2",
    "mkt-ui-compose__logo": "font-display font-bold",
    "mkt-ui-compose__nav": "text-muted",
    "mkt-ui-compose__head": "flex items-start justify-between gap-2 px-3 py-2",
    "mkt-ui-compose__pill": "rounded-full bg-signal/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-signal",
    "mkt-ui-compose__cards": "grid gap-2 p-2 sm:grid-cols-2",
    "mkt-ui-ticket": "flex overflow-hidden rounded-md border border-line",
    "mkt-ui-ticket__art": "w-16 shrink-0",
    "mkt-ui-ticket__body": "flex flex-col gap-0.5 p-2",
    "mkt-ui-ticket__status": "text-[0.6rem] font-semibold uppercase text-success",
    "mkt-staff-callout": "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm",
    "mkt-staff-callout__title": "mb-1 font-semibold",
    "mkt-staff-callout__links": "mt-2 list-disc space-y-1 pl-5 text-focus",
    "mkt-preview-phone": "absolute -right-4 top-8 hidden w-[120px] md:block",
    "mkt-phone-bezel": "rounded-[1.2rem] border-4 border-ink bg-ink p-1 shadow-lg",
    "mkt-phone-screen": "flex flex-col items-center rounded-[0.9rem] bg-paper px-2 py-4 text-center text-[0.55rem]",
    "mkt-phone-meta": "text-muted",
    "mkt-phone-qr": "my-2 h-14 w-14 rounded",
    "mkt-phone-code": "font-mono text-[0.5rem]",
    "mkt-preview-caption": "mt-3 text-center text-xs text-paper/50",
    "mkt-marquee": "mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
    "mkt-marquee-track": "flex gap-8 whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-paper/35",
    "mkt-trust-grid": "mt-10 grid gap-4 sm:grid-cols-3",
    "mkt-trust-row-2": "mt-4 grid gap-4 sm:grid-cols-2",
    "mkt-trust-card": "rounded-xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
    "mkt-trust-icon": "mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-focus/10 text-lg",
    "mkt-bento": "mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
    "mkt-steps": "mt-8 grid gap-4 md:grid-cols-5",
    "mkt-how-note": "mt-6 text-sm italic text-muted",
    "mkt-audience-grid": "mt-8 grid gap-4 sm:grid-cols-2",
    "mkt-audience-card": "rounded-xl border border-line p-5",
    "mkt-audience-card--emphasis": "border-signal/20 bg-white shadow-sm",
    "mkt-audience-card--muted": "bg-paper",
    "mkt-audience-icon": "mb-2 text-2xl",
    "mkt-demo-banner": "mb-6 inline-block rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal",
    "mkt-metrics": "mt-8 grid gap-4 sm:grid-cols-3",
    "mkt-metric": "rounded-xl border border-white/10 bg-white/5 p-4",
    "mkt-metric-label": "text-xs text-paper/70",
    "mkt-metric-value": "mt-1 font-display text-2xl font-bold",
    "mkt-chart": "mt-8 rounded-xl border border-white/10 bg-white/5 p-4",
    "mkt-chart-bars": "flex h-24 items-end gap-2",
    "mkt-chart-caption": "mt-2 text-xs text-paper/60",
    "mkt-faq": "mt-6 max-w-3xl",
    "mkt-cta-grid": "grid gap-10 lg:grid-cols-2",
    "mkt-form": "rounded-xl border border-line bg-white p-6 shadow-md",
    "mkt-field": "mb-4",
    "mkt-check": "mb-4 flex gap-2 text-sm",
    "mkt-form-error": "mb-3 rounded-md bg-signal/10 px-3 py-2 text-sm text-signal",
    "mkt-footer": "bg-ink px-5 py-12 text-paper",
    "mkt-footer-grid": "mx-auto flex max-w-[1120px] flex-col gap-8 md:flex-row md:justify-between",
    "mkt-footer-links": "flex flex-wrap gap-4 text-sm text-paper/80",
}


def patch_class_attr(match: re.Match[str]) -> str:
    quote = match.group(1)
    classes = match.group(2).split()
    out: list[str] = []
    seen: set[str] = set()
    for c in classes:
        if c not in seen:
            out.append(c)
            seen.add(c)
        tw = HOOK_TW.get(c)
        if tw:
            for t in tw.split():
                if t not in seen:
                    out.append(t)
                    seen.add(t)
    return f"class={quote}{' '.join(out)}{quote}"


def main() -> None:
    text = HTML.read_text(encoding="utf-8")
    text = text.replace(
        '<link rel="stylesheet" href="css/marketing.css" />',
        '<link rel="stylesheet" href="../css/prototype-frame.css" />\n'
        '    <link rel="stylesheet" href="css/marketing-effects.css" />',
    )
    text = re.sub(r'class=(["\'])([^"\']*)\1', patch_class_attr, text)
    text = text.replace(
        'class="mkt-marquee-track"',
        'class="mkt-marquee-track" data-marquee-track',
    )
    text = text.replace(
        'class="mkt-preview-glow"',
        'class="mkt-preview-glow" data-preview-glow',
    )
    text = text.replace(
        'class="mkt-ui-ticket__art mkt-ui-ticket__art--mfest"',
        'class="mkt-ui-ticket__art mkt-ui-ticket__art--mfest" data-ticket-art="mfest"',
    )
    text = text.replace(
        'class="mkt-ui-ticket__art mkt-ui-ticket__art--river"',
        'class="mkt-ui-ticket__art mkt-ui-ticket__art--river" data-ticket-art="river"',
    )
    text = text.replace(
        'class="mkt-phone-qr"',
        'class="mkt-phone-qr" data-phone-qr',
    )
    if "mkt-tw.js" not in text:
        text = text.replace(
            '<script src="js/marketing.js"></script>',
            '<script src="js/mkt-tw.js"></script>\n    <script src="js/marketing.js"></script>',
        )
    HTML.write_text(text, encoding="utf-8")
    print("patched", HTML)


if __name__ == "__main__":
    main()
