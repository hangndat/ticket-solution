import { bindRadixSheet, SHEET_PROVENANCE } from "./sheet-nav-radix.mjs";

const PROVENANCE = { ...SHEET_PROVENANCE, loader: "sheet-nav-loader.mjs" };

/** @type {Map<string, { setOpen: (o: boolean) => void, isOpen: () => boolean }>} */
const toggleByTrigger = new Map();

if (!globalThis.__vemokiSheetToggleBound) {
  globalThis.__vemokiSheetToggleBound = true;
  document.addEventListener(
    "click",
    (e) => {
      for (const [id, api] of toggleByTrigger) {
        const trigger = document.getElementById(id);
        if (!trigger || !trigger.contains(e.target)) continue;
        if (trigger.getAttribute("onclick")) continue;
        e.preventDefault();
        api.setOpen(!api.isOpen());
        return;
      }
    },
    true,
  );
}

/**
 * @param {object} options
 */
function bind(options) {
  const hostId =
    options.hostId || options.rootId || `vemoki-sheet-${options.triggerId}`;
  const triggerId = options.triggerId;
  if (!triggerId) return null;

  const radixApi = bindRadixSheet({
    hostId,
    rootId: options.rootId,
    triggerId,
    title: options.title || "Menu",
    titleId: options.titleId,
    side: options.side || "right",
    onChange: options.onChange,
  });

  function pushContent() {
    if (typeof options.getContent !== "function") return;
    const c = options.getContent();
    const body = document.createElement("nav");
    body.className = "flex flex-col gap-1 font-sans";
    if (c.navLabel) body.setAttribute("aria-label", c.navLabel);
    (c.links || []).forEach((link) => {
      if (link.href) {
        const a = document.createElement("a");
        a.href = link.href;
        a.textContent = link.label;
        a.className =
          link.className ||
          "min-h-[44px] whitespace-nowrap rounded-sm px-3 py-2.5 text-sm font-medium text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
        if (link.onClick) a.setAttribute("onclick", link.onClick);
        body.appendChild(a);
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = link.label;
        btn.className =
          link.className ||
          "min-h-[44px] w-full rounded-sm px-3 py-2 text-left text-sm font-medium text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
        if (link.onClick) btn.setAttribute("onclick", link.onClick);
        body.appendChild(btn);
      }
    });
    radixApi.setContent({
      title: c.title,
      closeLabel: c.closeLabel,
      body,
    });
  }

  const api = {
    setOpen(open) {
      const next = !!open;
      if (next) pushContent();
      radixApi.setOpen(next);
    },
    isOpen() {
      return radixApi.isOpen();
    },
    setContent(payload) {
      radixApi.setContent(payload);
    },
    provenance: PROVENANCE,
  };

  toggleByTrigger.set(triggerId, api);

  return api;
}

window.VemokiSheetNav = { bind, provenance: PROVENANCE };
queueMicrotask(() => {
  document.dispatchEvent(new Event("vemoki-sheet-ready"));
});
