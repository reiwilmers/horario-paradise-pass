/** Only this agent may create, edit, and publish schedules to the cloud. */
export const SCHEDULE_PUBLISHER_AGENT_ID = 'rei';

export function isSchedulePublisher(agent) {
  return agent?.id === SCHEDULE_PUBLISHER_AGENT_ID;
}
