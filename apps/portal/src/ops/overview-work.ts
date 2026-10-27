import type { ShownPortfolioItem } from './portfolio';
import {
  canAccessEventRoute,
  canPerformTenantAction,
  firstAllowedEventPath,
} from '../nav/capability-policy';
import {
  REPORT_EMAIL_CS_SECTION_ID,
  REPORT_PENDING_APPROVAL_SECTION_ID,
} from './report';

export type OverviewStage = 'prep' | 'issue' | 'dayOf' | 'after';

export type OverviewWorkItem = {
  id: string;
  stage: OverviewStage;
  href: string;
  titleKey:
    | 'overview.work.prepCreate'
    | 'overview.work.prepSetup'
    | 'overview.work.issuePending'
    | 'overview.work.issueQuota'
    | 'overview.work.dayOfGate'
    | 'overview.work.afterCs';
  eventTitle: string | null;
};

type EventRef = {
  tenantId: string;
  eventId: string;
  name: string;
  permissions: readonly string[];
};

function eventHref(
  event: EventRef,
  route: 'guests' | 'gate' | 'support' | 'quota' | 'setup',
  hash?: string,
): string | null {
  if (!canAccessEventRoute(route, event.permissions)) return null;
  const path = `/t/${event.tenantId}/e/${event.eventId}/${route}`;
  return hash ? `${path}#${hash}` : path;
}

export function overviewWorkItems(input: {
  tenantId: string;
  tenantPermissions: readonly string[];
  events: readonly EventRef[];
  portfolioItems: readonly ShownPortfolioItem[];
}): OverviewWorkItem[] {
  const items: OverviewWorkItem[] = [];
  const { tenantId, tenantPermissions, events, portfolioItems } = input;

  if (events.length === 0) {
    const href = canPerformTenantAction('createEvent', tenantPermissions)
      ? `/t/${tenantId}/events/new`
      : canPerformTenantAction('listEvents', tenantPermissions)
        ? `/t/${tenantId}/events`
        : null;
    if (href) {
      items.push({
        id: 'prep-create',
        stage: 'prep',
        href,
        titleKey: 'overview.work.prepCreate',
        eventTitle: null,
      });
    }
    return items;
  }

  for (const event of events) {
    const setup = eventHref(event, 'setup');
    const fallback = firstAllowedEventPath(event);
    const shown = portfolioItems.find((row) => row.eventId === event.eventId);
    if (!shown) {
      const href = setup ?? fallback;
      if (href) {
        items.push({
          id: `prep-${event.eventId}`,
          stage: 'prep',
          href,
          titleKey: 'overview.work.prepSetup',
          eventTitle: event.name,
        });
      }
      continue;
    }

    const before = items.length;
    if (shown.pendingApprovalCount > 0) {
      const href = eventHref(
        event,
        'guests',
        REPORT_PENDING_APPROVAL_SECTION_ID,
      );
      if (href) {
        items.push({
          id: `issue-pending-${event.eventId}`,
          stage: 'issue',
          href,
          titleKey: 'overview.work.issuePending',
          eventTitle: event.name,
        });
      }
    }

    if (
      shown.quotaCapacityState === 'FINITE' &&
      shown.quotaRemaining === 0
    ) {
      const href = eventHref(event, 'quota');
      if (href) {
        items.push({
          id: `issue-quota-${event.eventId}`,
          stage: 'issue',
          href,
          titleKey: 'overview.work.issueQuota',
          eventTitle: event.name,
        });
      }
    }

    const gate = eventHref(event, 'gate');
    if (gate && (shown.checkInSuccessCount > 0 || shown.pendingApprovalCount === 0)) {
      items.push({
        id: `dayof-${event.eventId}`,
        stage: 'dayOf',
        href: gate,
        titleKey: 'overview.work.dayOfGate',
        eventTitle: event.name,
      });
    }

    if (shown.emailNeedsCsCount > 0) {
      const href = eventHref(event, 'support', REPORT_EMAIL_CS_SECTION_ID);
      if (href) {
        items.push({
          id: `after-cs-${event.eventId}`,
          stage: 'after',
          href,
          titleKey: 'overview.work.afterCs',
          eventTitle: event.name,
        });
      }
    }
    if (items.length === before) {
      const href = setup ?? fallback;
      if (href) {
        items.push({
          id: `prep-${event.eventId}`,
          stage: 'prep',
          href,
          titleKey: 'overview.work.prepSetup',
          eventTitle: event.name,
        });
      }
    }
  }

  return items;
}

export const OVERVIEW_STAGE_ORDER: OverviewStage[] = [
  'prep',
  'issue',
  'dayOf',
  'after',
];
