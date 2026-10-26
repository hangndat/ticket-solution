export type PortalMenuLeaf = {
  key: string;
  path: string;
  name: string;
};

export type PortalMenuGroup = {
  key: string;
  name: string;
  children: PortalMenuLeaf[];
};

export const PORTAL_NAV_GROUP_KEYS = [
  'nav-org',
  'nav-event-run',
  'nav-event-setup',
  'nav-platform',
] as const;

type MenuChildRef = {
  groupKey: string;
  path: string;
  key: string;
};

function collectMenuChildren(menuData: PortalMenuGroup[]): MenuChildRef[] {
  const out: MenuChildRef[] = [];
  for (const group of menuData) {
    const groupKey = group.key;
    if (!group.children.length) continue;
    for (const child of group.children) {
      const path = child.path;
      if (!path) continue;
      out.push({
        groupKey,
        path,
        key: child.key ?? path,
      });
    }
  }
  return out;
}

/** Whether `pathname` should highlight a sider leaf with `menuPath`. */
export function pathnameMatchesMenuPath(pathname: string, menuPath: string): boolean {
  if (pathname === menuPath) return true;
  if (menuPath === '/platform') {
    return pathname.startsWith('/platform/');
  }
  const orgOverview = /^\/t\/[^/]+$/.test(menuPath);
  if (orgOverview) {
    if (!pathname.startsWith(`${menuPath}/`)) return false;
    return !pathname.includes('/e/');
  }
  return pathname.startsWith(`${menuPath}/`);
}

export function resolvePortalMenuKeys(
  pathname: string,
  menuData: PortalMenuGroup[],
): { selectedKeys: string[]; openKeys: string[] } {
  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    return { selectedKeys: ['/platform'], openKeys: ['nav-platform'] };
  }

  const children = collectMenuChildren(menuData);
  let best: MenuChildRef | null = null;
  for (const child of children) {
    if (!pathnameMatchesMenuPath(pathname, child.path)) continue;
    if (!best || child.path.length > best.path.length) best = child;
  }

  if (!best) {
    return { selectedKeys: pathname ? [pathname] : [], openKeys: [] };
  }
  return { selectedKeys: [best.key], openKeys: [best.groupKey] };
}
