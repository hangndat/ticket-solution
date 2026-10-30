import type { JourneyMilestone } from '../analytics/events';
import { T } from './timeline';

/** Only the chapter actually reached, not unseen chapters skipped by a fast jump. */
export function milestoneAt(progress: number): JourneyMilestone {
  if (progress >= T.brand[1]) return 'complete';
  if (progress >= 0.68) return 'moment';
  if (progress >= 0.41) return 'gateway';
  if (progress >= 0.2) return 'arrival';
  return 'invitation';
}

/** Component-owned, never persisted or identified across page views. */
export function oncePerView(send: (milestone: JourneyMilestone) => void) {
  const reached = new Set<JourneyMilestone>();
  return (milestone: JourneyMilestone) => {
    if (reached.has(milestone)) return;
    reached.add(milestone);
    send(milestone);
  };
}
