import { DAYS } from '../../domain/constants.js';
import {
  SCHEDULE_ROWS,
  isGeneralClose,
  MORNING_WBD_BLOCKS,
  WBD_EVENING_BLOCK,
} from '../../domain/blocks.js';
import { agentsOnVacationForWeek } from '../../domain/distribution.js';
import { getState } from '../store.js';
import { scheduleHasAssignments } from '../utils/calendar.js';
import { weekRangeLabel } from '../../domain/forecast.js';

const CATEGORY_CLASS = {
  TOP: 'cat-top',
  MA: 'cat-ma',
  MB: 'cat-mb',
  SUP: 'cat-sup',
  GTE: 'cat-gte',
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayName(agent) {
  return String(agent?.name || '').toUpperCase();
}

export function renderPublishedSchedule({ weekKey, headers }) {
  const state = getState();
  const schedule = state.schedules[weekKey];
  const agentsById = state.agents.byId;
  const morningWbdMap = state.morningWbdMap;
  const forecast = state.forecasts[weekKey] || [];
  const isEmpty = !scheduleHasAssignments(schedule);

  if (isEmpty) {
    return `
      <section class="published-schedule published-schedule--empty">
        <p class="published-schedule__title">Paradise Pass Punta Cana</p>
        <p class="published-schedule__range">${escapeHtml(weekRangeLabel(weekKey))}</p>
        <p class="published-schedule__empty">Semana sin horario publicado.</p>
      </section>
    `;
  }

  const vacationByDay = agentsOnVacationForWeek(state.exceptions, forecast);

  const bodyRows = SCHEDULE_ROWS.map((row) => {
    if (row.type === 'section') {
      return `
        <tr class="published-row published-row--section tone-${row.tone}">
          <td class="published-label">${escapeHtml(row.label)}</td>
          ${DAYS.map(() => '<td></td>').join('')}
        </tr>
      `;
    }

    return `
      <tr class="published-row tone-${row.tone}">
        <td class="published-label">${escapeHtml(row.label)}</td>
        ${DAYS.map((day) => {
    const general = isGeneralClose(day, row.key);
    const vacationIds = vacationByDay?.[day] || [];
    const agents = filterAgentsNotOnVacation(
      (schedule.days[day]?.[row.key] || []).filter((id) => agentsById[id]?.active),
      row.key === 'Off' || row.key === 'Posible Off' ? vacationIds : [],
    );
    const wbdSet = new Set(morningWbdMap[day] || []);
    return `
          <td class="${general ? 'published-cell--general' : ''}">
            ${agents.map((agentId) => {
      const agent = agentsById[agentId];
      const isMorningWbd = MORNING_WBD_BLOCKS.includes(row.key) && wbdSet.has(agentId);
      const isEveningWbd = row.key === WBD_EVENING_BLOCK;
      const personClass = [
        CATEGORY_CLASS[agent.category] || '',
        isMorningWbd ? 'published-person--wbd' : '',
        isEveningWbd ? 'published-person--evening' : '',
        general ? 'published-person--general' : '',
      ].filter(Boolean).join(' ');
      return `
              <div class="published-person ${personClass}">
                <span>${escapeHtml(displayName(agent))}</span>
                ${isMorningWbd ? '<span class="published-wbd-tag">WBD</span>' : ''}
              </div>
            `;
    }).join('')}
          </td>
        `;
  }).join('')}
      </tr>
    `;
  }).join('');

  const vacationRow = vacationByDay ? `
    <tr class="published-row tone-vacaciones">
      <td class="published-label">Vacaciones</td>
      ${DAYS.map((day) => {
    const ids = vacationByDay[day] || [];
    return `<td>${ids.map((id) => `<div class="published-person">${escapeHtml(displayName(agentsById[id]))}</div>`).join('')}</td>`;
  }).join('')}
    </tr>
  ` : '';

  const salidasRow = `
    <tr class="published-row tone-salidas">
      <td class="published-label">SALIDAS</td>
      ${DAYS.map((_, index) => `<td>${escapeHtml(forecast[index]?.total ?? '')}</td>`).join('')}
    </tr>
  `;

  const headerCells = DAYS.map((day, index) => (
    `<th>${escapeHtml((headers[index] || day).toUpperCase())}</th>`
  )).join('');

  return `
    <section class="published-schedule">
      <header class="published-schedule__header">
        <p class="published-schedule__brand">Paradise Pass Punta Cana</p>
        <p class="published-schedule__title">Horario semanal</p>
        <p class="published-schedule__range">${escapeHtml(weekRangeLabel(weekKey))}</p>
      </header>
      <div class="published-scroll">
        <table class="published-table">
          <thead>
            <tr>
              <th class="published-label">HORARIO</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            ${vacationRow}
            ${salidasRow}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
