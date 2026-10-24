// Probe portal-full specimen: PA-03..06 + meta/viewport.
(() => {
  const meta = document.querySelector('[data-testid="demo-meta"]');
  const catalog = document.querySelector('[data-testid="import-catalog-filters"]');
  const pa04 = document.querySelector('[data-testid="pa04-formatted-instant"]');
  const exportInput = document.querySelector('[data-testid="export-request-id"]');
  const spinner = document.querySelector('[data-testid="pd-spinner"]');
  const locale = document.documentElement.lang || 'vi';
  let spinnerAnim = null;
  if (spinner) {
    const cs = getComputedStyle(spinner);
    spinnerAnim = {
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
    };
  }
  const exportAria = exportInput?.getAttribute('aria-label') ?? null;
  const metaText = meta?.innerText?.trim() ?? '';
  const tabMatch = metaText.match(/tab=([a-z]+)/);
  const tab = tabMatch ? tabMatch[1] : null;
  const auditTabMatch = metaText.match(/auditTab=([a-z]+)/);
  const auditTab = auditTabMatch ? auditTabMatch[1] : null;
  const platformTabMatch = metaText.match(/platformTab=([a-z]+)/);
  const platformTab = platformTabMatch ? platformTabMatch[1] : null;
  const auditTable = document.querySelector('[data-testid="audit-table"]');
  const codesTable = document.querySelector('[data-testid="codes-table"]');
  const platformGrants = document.querySelector('[data-testid="platform-grants-panel"]');
  const rmClass = document.body.classList.contains('rm-reduce');
  const rmMedia = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    locale,
    metaText,
    page: (metaText.match(/page=([a-z-]+)/) || [])[1] ?? null,
    tab,
    state: (metaText.match(/state=([a-z]+)/) || [])[1] ?? null,
    pa03: {
      catalogVisible: !!catalog,
      expectCatalogOnlyOnImport: tab === 'import' ? catalog !== null : catalog === null,
    },
    pa04: {
      formatted: pa04?.innerText?.trim() ?? null,
      hasUtcSibling: !!document.querySelector('.utc-badge'),
    },
    pa05: {
      exportAriaLabel: exportAria,
      exportAriaNotFieldId: exportAria !== 'exportId' && exportAria !== null,
    },
    pa06: {
      rmQueryClass: rmClass,
      rmMedia,
      spinnerAnim,
      reducedMotionOk:
        rmClass || rmMedia
          ? spinnerAnim?.animationName === 'none' || spinnerAnim?.animationDuration === '0s'
          : spinnerAnim?.animationName && spinnerAnim.animationName !== 'none',
    },
    mrR08: {
      auditPage: (metaText.match(/page=([a-z-]+)/) || [])[1] === 'audit',
      auditTab,
      auditTableVisible: !!auditTable,
      codesTableVisible: !!codesTable,
      platformGrantsVisible: !!platformGrants,
    },
    auditTab,
    platformTab,
  };
})();
