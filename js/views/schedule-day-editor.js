import { DAYS } from '../../domain/constants.js';
import { SCHEDULE_ROWS } from '../../domain/blocks.js';
import { isPoolBlock, agentsOnVacationForWeek, filterAgentsNotOnVacation } from '../../domain/distribution.js';
import { getState, activeAgents } from '../store.js';
import { placeAgent, removeAgent } from '../actions/schedule.js';
import {
  showMorningWbdToggle,
  toggleMorningWbd,
} from '../actions/wbd.js';
import { dayPickerLabel, agentsAvailableForDay, renderDayUnassignedFooter } from './dashboard-alerts-panel.js';
import {
  forecastContextForDay,
  renderDashboardDayForecastStrip,
} from './dashboard-forecast-strip.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderScheduleDayEditor({ weekKey, headers, selectedDay = DAYS[0], dashboardAlerts = [] }) {
  const state = getState();
  const schedule = state.schedules[weekKey];
  const agentsById = state.agents.byId;

  const blocks = SCHEDULE_ROWS.filter((row) => row.type !== 'section');

  const forecast = state.forecasts[weekKey] || [];
  const vacationByDay = agentsOnVacationForWeek(state.exceptions, forecast);
  const vacationIds = vacationByDay?.[selectedDay] || [];
  const forecastContext = forecastContextForDay({
    weekKey,
    day: selectedDay,
    schedule,
    forecast,
    settings: state.forecastSettings,
  });
  const availableAgents = agentsAvailableForDay(selectedDay, {
    schedule,
    forecast,
    exceptions: state.exceptions,
    agents: activeAgents(),
  });

  const blockCards = blocks.map((row) => {
    const block = row.key;
    const rawAssigned = (schedule.days[selectedDay]?.[block] || []).filter((id) => agentsById[id]?.active);
    const assigned = filterAgentsNotOnVacation(
      rawAssigned,
      block === 'Off' || block === 'Posible Off' ? vacationIds : [],
    );
    const pool = isPoolBlock(block);
    const morningWbdIds = new Set(state.morningWbdMap[selectedDay] || []);

    return `
      <article class="day-block-card">
        <header class="day-block-card__head tone-${row.tone}">
          <h4>${escapeHtml(row.label)}</h4>
          ${row.section ? `<span class="day-block-card__area">${escapeHtml(row.section)}</span>` : ''}
        </header>
        <div class="day-block-card__agents tone-${row.tone}">
          ${assigned.map((agentId) => {
    const agent = agentsById[agentId];
    const wbd = morningWbdIds.has(agentId) && showMorningWbdToggle(block);
    return `
            <div class="day-agent-entry">
              <span class="schedule-agent-pill">
                <span class="schedule-agent-pill__name">${escapeHtml(String(agent.name).toUpperCase())}</span>
                ${wbd ? '<span class="schedule-agent-pill__tag">WBD</span>' : ''}
              </span>
              <div class="day-agent-entry__actions">
                ${showMorningWbdToggle(block) && agent.morningWbdEligible ? `
                  <label class="wbd-toggle wbd-toggle--touch">
                    <input type="checkbox" data-day-wbd="1" data-day="${escapeHtml(selectedDay)}" data-agent-id="${escapeHtml(agentId)}" ${wbd ? 'checked' : ''} />
                    WBD
                  </label>` : ''}
                <button type="button" class="btn-icon btn-icon--sm day-agent-entry__remove" data-day-remove="1" data-day="${escapeHtml(selectedDay)}" data-block="${escapeHtml(block)}" data-agent-id="${escapeHtml(agentId)}" aria-label="Quitar ${escapeHtml(agent.name)}">×</button>
              </div>
            </div>
          `;
  }).join('') || `<p class="day-block-card__empty">${pool ? 'Nadie asignado' : 'Espacio libre'}</p>`}
        </div>
        <div class="day-block-card__add">
          <select class="field-select field-select--compact" data-day-add-select="1" data-day="${escapeHtml(selectedDay)}" data-block="${escapeHtml(block)}" aria-label="Agregar agente">
            <option value="">${availableAgents.length ? '+ Agregar agente' : 'Todos con rol'}</option>
            ${availableAgents.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`).join('')}
          </select>
          <button type="button" class="btn-primary btn-primary--sm" data-day-add-btn="1" data-week="${escapeHtml(weekKey)}" data-day="${escapeHtml(selectedDay)}" data-block="${escapeHtml(block)}" ${availableAgents.length ? '' : 'disabled'}>+</button>
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="day-editor panel day-editor--compact">
      <label class="day-editor__picker">
        Día
        <select id="day-editor-select">
          ${DAYS.map((day, index) => {
    const header = headers[index] || day;
    return `
            <option value="${day}" ${day === selectedDay ? 'selected' : ''}>${escapeHtml(dayPickerLabel(day, header, dashboardAlerts))}</option>
          `;
  }).join('')}
        </select>
      </label>
      ${renderDashboardDayForecastStrip(forecastContext)}
      <div class="day-editor__blocks">${blockCards}</div>
      ${renderDayUnassignedFooter(dashboardAlerts, selectedDay)}
    </section>
  `;
}

export function bindScheduleDayEditor(root, { weekKey, headers, onDayChange }) {
  if (!root) return;

  root.querySelector('#day-editor-select')?.addEventListener('change', (event) => {
    onDayChange?.(event.target.value);
  });

  root.querySelectorAll('[data-day-add-btn="1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const select = root.querySelector(
        `[data-day-add-select="1"][data-day="${btn.dataset.day}"][data-block="${btn.dataset.block}"]`,
      );
      if (!select?.value) return;
      await placeAgent(btn.dataset.week, btn.dataset.day, btn.dataset.block, select.value);
      select.value = '';
      select.blur();
    });
  });

  root.querySelectorAll('[data-day-remove="1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeAgent(btn.dataset.week, btn.dataset.day, btn.dataset.block, btn.dataset.agentId);
    });
  });

  root.querySelectorAll('[data-day-wbd="1"]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      event.stopPropagation();
      const ok = await toggleMorningWbd(input.dataset.day, input.dataset.agentId, input.checked, weekKey);
      if (!ok?.ok) input.checked = !input.checked;
    });
  });
}

export function shouldUseDayEditor() {
  return window.matchMedia('(max-width: 960px)').matches;
}
