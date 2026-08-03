import { describe, expect, it } from 'vitest';
import { isSchedulePublisher, SCHEDULE_PUBLISHER_AGENT_ID } from '../../domain/schedulePublisher.js';

describe('schedulePublisher', () => {
  it('only allows Rei to publish schedules', () => {
    expect(SCHEDULE_PUBLISHER_AGENT_ID).toBe('rei');
    expect(isSchedulePublisher({ id: 'rei', name: 'Rei' })).toBe(true);
    expect(isSchedulePublisher({ id: 'cris', name: 'Cris', category: 'GTE' })).toBe(false);
    expect(isSchedulePublisher({ id: 'lolo', name: 'Lolo' })).toBe(false);
    expect(isSchedulePublisher(null)).toBe(false);
  });
});
