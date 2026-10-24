/**
 * D-2 mobile sheet — @radix-ui/react-dialog (shadcn Sheet primitive).
 * Provenance: react@18.3.1, react-dom@18.3.1, @radix-ui/react-dialog@1.1.4 (esm.sh).
 * Browser module: React.createElement only (no JSX).
 */
import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import * as Dialog from "https://esm.sh/@radix-ui/react-dialog@1.1.4?deps=react@18.3.1,react-dom@18.3.1";

export const SHEET_PROVENANCE = {
  react: "18.3.1",
  reactDom: "18.3.1",
  radixDialog: "@radix-ui/react-dialog@1.1.4",
  pattern: "shadcn/ui Sheet (Radix Dialog + side panel)",
  cdn: "https://esm.sh",
};

function BodySlot({ node }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    if (node) el.appendChild(node);
  }, [node]);
  return React.createElement("div", { ref, className: "flex flex-col gap-1" });
}

function SheetHost({
  bridge,
  triggerId,
  legacyRootId,
  initialTitle,
  titleId,
  side,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [bodyNode, setBodyNode] = useState(null);
  const [closeLabel, setCloseLabel] = useState("Close");

  useEffect(() => {
    bridge.open = open;
    bridge.ready = true;
  }, [bridge, open]);

  useEffect(() => {
    bridge.setOpen = (next) => setOpen(!!next);
    bridge.setContent = ({ title: t, body, closeLabel: c }) => {
      if (t != null) setTitle(t);
      if (body != null) setBodyNode(body);
      if (c != null) setCloseLabel(c);
    };
    bridge.isOpen = () => bridge.open;
    if (bridge.pendingOpen != null) {
      setOpen(!!bridge.pendingOpen);
      bridge.pendingOpen = null;
    }
    if (bridge.pendingContent) {
      bridge.setContent(bridge.pendingContent);
      bridge.pendingContent = null;
    }
    return () => {
      bridge.ready = false;
      bridge.setOpen = null;
      bridge.setContent = null;
      bridge.isOpen = () => false;
    };
  }, [bridge]);

  useEffect(() => {
    onChange?.(open);
    const trigger = document.getElementById(triggerId);
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("sheet-scroll-lock", open);
    if (legacyRootId) {
      const legacyRoot = document.getElementById(legacyRootId);
      if (legacyRoot) {
        legacyRoot.dataset.state = open ? "open" : "closed";
        legacyRoot.hidden = !open;
        legacyRoot.setAttribute("aria-hidden", open ? "false" : "true");
      }
    }
  }, [open, triggerId, onChange, legacyRootId]);

  const sideClass =
    side === "bottom"
      ? "inset-x-0 bottom-0 top-auto max-h-[85vh] rounded-t-xl border-t"
      : "inset-y-0 right-0 h-full w-[min(100%,320px)] border-l";

  const handleCloseAutoFocus = (event) => {
    const trigger = document.getElementById(triggerId);
    if (trigger) {
      event.preventDefault();
      trigger.focus();
    }
  };

  return React.createElement(
    Dialog.Root,
    { open, onOpenChange: setOpen },
    React.createElement(
      Dialog.Portal,
      null,
      React.createElement(Dialog.Overlay, {
        className: "fixed inset-0 z-[100] bg-ink/50",
      }),
      React.createElement(
        Dialog.Content,
        {
          className: `fixed z-[101] flex flex-col bg-paper text-ink shadow-[0_24px_64px_rgba(11,18,32,0.12)] outline-none focus-visible:ring-2 focus-visible:ring-focus ${sideClass}`,
          "aria-describedby": undefined,
          onCloseAutoFocus: handleCloseAutoFocus,
        },
        React.createElement(
          "div",
          {
            className:
              "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
          },
          React.createElement(
            Dialog.Title,
            {
              id: titleId,
              className:
                "font-display text-base font-semibold tracking-tight",
            },
            title,
          ),
          React.createElement(
            Dialog.Close,
            {
              type: "button",
              className:
                "min-h-[44px] min-w-[44px] rounded-sm px-3 text-sm font-semibold text-muted hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            },
            closeLabel,
          ),
        ),
        React.createElement(
          "div",
          { className: "flex-1 overflow-y-auto p-4" },
          React.createElement(BodySlot, { node: bodyNode }),
        ),
      ),
    ),
  );
}

/**
 * @param {{ hostId?: string, rootId?: string, triggerId: string, title?: string, titleId?: string, side?: 'right'|'bottom', onChange?: (open: boolean) => void }} options
 */
export function bindRadixSheet(options) {
  const hostId =
    options.hostId || options.rootId || `vemoki-sheet-${options.triggerId}`;
  const legacyRootId = options.rootId || null;
  let mount = document.getElementById(`${hostId}-react`);
  if (!mount) {
    mount = document.createElement("div");
    mount.id = `${hostId}-react`;
    document.body.appendChild(mount);
  }
  const titleId = options.titleId || `${hostId}-title`;
  const bridge = {
    ready: false,
    open: false,
    pendingOpen: null,
    pendingContent: null,
    setOpen: null,
    setContent: null,
    isOpen: () => false,
  };

  const root = createRoot(mount);
  root.render(
    React.createElement(SheetHost, {
      bridge,
      triggerId: options.triggerId,
      legacyRootId,
      initialTitle: options.title || "Menu",
      titleId,
      side: options.side || "right",
      onChange: options.onChange,
    }),
  );

  return {
    setOpen(open) {
      const next = !!open;
      if (bridge.setOpen) bridge.setOpen(next);
      else bridge.pendingOpen = next;
    },
    isOpen() {
      return bridge.isOpen ? bridge.isOpen() : bridge.open;
    },
    setContent(payload) {
      if (bridge.setContent) bridge.setContent(payload);
      else bridge.pendingContent = payload;
    },
    provenance: SHEET_PROVENANCE,
  };
}
