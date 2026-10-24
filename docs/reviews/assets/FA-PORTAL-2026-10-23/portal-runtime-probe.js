// Runtime portal probe (post-auth DOM) — PA-03..06 + MR-R08 hooks.
(() => {
  const locale = document.documentElement.lang || 'vi';
  const catalog = document.querySelector('[data-testid="import-catalog-filters"]');
  const exportInput = document.querySelector('[data-testid="export-id-input"]');
  const exportAria = exportInput?.getAttribute('aria-label') ?? null;
  const auditPanel = document.querySelector('[data-testid="audit-log-panel"]');
  const auditTable = document.querySelector('[data-testid="audit-table"]');
  const platformGrants = document.querySelector('[data-testid="platform-grants-panel"]');
  const contextStrip = document.querySelector('[data-testid="portal-context-strip"]');
  const brand = document.querySelector('[data-testid="portal-brand"]');
  const sider = document.querySelector('[data-testid="portal-sider"]');
  const pa04 = document.querySelector('[data-testid="pa04-formatted-instant"]');
  const rmMedia = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rmClass = document.documentElement.classList.contains('rm-reduce');
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null;
  const hash = window.location.hash.replace('#', '');
  const path = window.location.pathname;
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    locale,
    path,
    hash,
    activeTab,
    pa01: {
      contextStrip: !!contextStrip,
      brand: !!brand,
      sider: !!sider,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    },
    pa03: {
      catalogVisible: !!catalog,
      onImportTab: hash === 'import' || activeTab?.toLowerCase().includes('csv') || activeTab?.toLowerCase().includes('import'),
    },
    pa04: {
      formatted: pa04?.textContent?.trim() ?? null,
      hasUtcSibling: !!document.querySelector('.utc-badge'),
    },
    pa05: {
      exportAriaLabel: exportAria,
      exportAriaNotFieldId: exportAria !== 'exportId' && exportAria !== null,
    },
    pa06: { rmMedia, rmClass },
    mrR08: {
      auditPanel: !!auditPanel,
      auditTable: !!auditTable,
      platformGrants: !!platformGrants,
    },
  };
})();
