import { DAYS } from '../../domain/constants.js';
import { SCHEDULE_ROWS, isGeneralClose } from '../../domain/blocks.js';
import { agentsOnVacationForWeek } from '../../domain/distribution.js';

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

function renderBlockAgents(agents, { wbdSet, general, eveningWbd } = {}) {
  if (!agents.length) return '<p class="mobile-day-block__empty">—</p>';
  return `
    <ul class="mobile-day-block__list">
      ${agents.map((agent) => {
        const isWbd = wbdSet?.has(agent.id);
        return `
          <li class="mobile-day-block__agent ${general ? 'mobile-day-block__agent--general' : ''} ${isWbd ? 'mobile-day-block__agent--wbd' : ''} ${eveningWbd ? 'mobile-day-block__agent--evening' : ''}">
            <span>${escapeHtml(displayName(agent))}</span>
            ${isWbd ? '<span class="mobile-day-block__tag">WBD</span>' : ''}
            ${eveningWbd ? '<span class="mobile-day-block__tag">5:30PM</span>' : ''}
            ${general ? '<span class="mobile-day-block__tag">General</span>' : ''}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

export function renderMobileScheduleDays({ headers, schedule, agentsById, morningWbdMap, forecast, exceptions }) {
  const vacationByDay = agentsOnVacationForWeek(exceptions, forecast);
  const assignmentRows = SCHEDULE_ROWS.filter((row) => row.type !== 'section');

  return `
    <section class="mobile-schedule-days">
      <h3 class="mobile-schedule-days__title">Horario por día</h3>
      <div class="mobile-schedule-days__grid">
        ${DAYS.map((day, index) => {
          const dayPlan = schedule.days[day] || {};
          const wbdSet = new Set(morningWbdMap[day] || []);
          const vacationIds = vacationByDay?.[day] || [];

          const blocksHtml = assignmentRows.map((row) => {
            const agents = (dayPlan[row.key] || [])
              .map((id) => agentsById[id])
              .filter((agent) => agent?.active);
            const general = isGeneralClose(day, row.key);
            const eveningWbd = row.key === 'WBD 5:30PM';
            const alwaysShow = ['Off', 'Posible Off', 'WBD 5:30PM'].includes(row.key);
            if (!agents.length && !alwaysShow) return '';

            return `
              <section class="mobile-day-block tone-${row.tone} ${general ? 'mobile-day-block--general' : ''}">
                <header class="mobile-day-block__head">
                  <strong>${escapeHtml(row.label)}</strong>
                  <span>${escapeHtml(row.section || row.area || '')}</span>
                </header>
                ${renderBlockAgents(agents, { wbdSet, general, eveningWbd })}
              </section>
            `;
          }).join('');

          const vacationHtml = vacationIds.length ? `
            <section class="mobile-day-block tone-vacaciones">
              <header class="mobile-day-block__head">
                <strong>Vacaciones</strong>
                <span>VAC</span>
              </header>
              ${renderBlockAgents(vacationIds.map((id) => agentsById[id]).filter(Boolean))}
            </section>
          ` : '';

          return `
            <article class="mobile-day-card">
              <header class="mobile-day-card__head">
                <h4>${escapeHtml(headers[index] || day)}</h4>
              </header>
              <div class="mobile-day-card__body">
                ${blocksHtml || vacationHtml ? blocksHtml + vacationHtml : '<p class="mobile-day-block__empty">Sin asignaciones operativas</p>'}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}
