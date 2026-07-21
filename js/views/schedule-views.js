import { DAYS } from '../../domain/constants.js';
import { SCHEDULE_ROWS } from '../../domain/blocks.js';
import { blockDisplayLabel } from '../../domain/agentSummary.js';
import { buildWhatsAppDayText, defaultWhatsAppShareDay } from '../../domain/whatsappShare.js';
import { getState, setVisibleWeek } from '../store.js';
import { renderPublishedSchedule } from './published-schedule.js';
import { renderDistributionPanel } from './distribution-panel.js';
import {
  renderScheduleDayEditor,
  bindScheduleDayEditor,
  shouldUseDayEditor,
} from './schedule-day-editor.js';
import { renderScheduleGrid, bindScheduleGrid } from './schedule-grid.js';
import { dayHeaders, weekRangeLabel } from '../utils/calendar.js';
import { persistVisibleWeek } from '../actions/persist.js';
import { copyTextToClipboard, downloadScheduleImage } from '../utils/scheduleExport.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPublishedDayCards(weekKey, headers) {
  const state = getState();
  const schedule = state.schedules[weekKey];
  const agentsById = state.agents.byId;
  const morningWbdMap = state.morningWbdMap;
  const dataRows = SCHEDULE_ROWS.filter((row) => row.type !== 'section');

  return `
    <section class="published-cards panel">
      <h3>Vista por día</h3>
      <div class="published-cards__grid">
        ${DAYS.map((day, index) => {
          const assignments = [];
          for (const row of dataRows) {
            for (const agentId of schedule.days[day]?.[row.key] || []) {
              const agent = agentsById[agentId];
              if (!agent?.active) continue;
              const wbd = (morningWbdMap[day] || []).includes(agentId);
              assignments.push({ agent, block: row.key, wbd });
            }
          }
          return `
          <article class="published-day-card">
            <h4>${escapeHtml(headers[index] || day)}</h4>
            ${assignments.length ? assignments.map(({ agent, block, wbd }) => `
              <div class="published-day-card__row">
                <strong>${escapeHtml(agent.name)}</strong>
                <span>${escapeHtml(blockDisplayLabel(block))}${wbd ? ' · WBD' : ''}</span>
              </div>
            `).join('') : '<p class="published-day-card__empty">Sin asignaciones</p>'}
          </article>
        `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderWeekSelector(weekKey) {
  return `
    <label class="week-selector">
      Semana
      <select id="visible-week-select">
        <option value="current" ${weekKey === 'current' ? 'selected' : ''}>Actual (${weekRangeLabel('current')})</option>
        <option value="next" ${weekKey === 'next' ? 'selected' : ''}>Próxima (${weekRangeLabel('next')})</option>
      </select>
    </label>
  `;
}

function renderWhatsAppControls(weekKey, headers, selectedDay) {
  return `
    <div class="horario-share-controls">
      <label class="week-selector">
        Día WhatsApp
        <select id="horario-share-day">
          ${DAYS.map((day, index) => `
            <option value="${day}" ${day === selectedDay ? 'selected' : ''}>${escapeHtml(headers[index] || day)}</option>
          `).join('')}
        </select>
      </label>
      <label class="horario-op-input">
        Sala op.
        <input id="horario-sala-op" class="field-input" inputmode="numeric" placeholder="Opcional" />
      </label>
      <label class="horario-op-input">
        Lobby op.
        <input id="horario-lobby-op" class="field-input" inputmode="numeric" placeholder="Opcional" />
      </label>
    </div>
  `;
}

function bindWeekSelector(container, rerender) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    rerender();
  });
}

function bindHorarioShare(container, weekKey) {
  container.querySelector('#horario-image-btn')?.addEventListener('click', async () => {
    const source = container.querySelector('#published-mount .published-schedule');
    const filename = `horario-${weekRangeLabel(weekKey).replace(/\s+/g, '')}.png`;
    await downloadScheduleImage(source, filename);
  });

  container.querySelector('#horario-share-btn')?.addEventListener('click', async () => {
    const state = getState();
    const day = container.querySelector('#horario-share-day')?.value;
    const salaOpportunities = container.querySelector('#horario-sala-op')?.value?.trim() || '';
    const lobbyOpportunities = container.querySelector('#horario-lobby-op')?.value?.trim() || '';
    const text = buildWhatsAppDayText({
      day,
      schedule: state.schedules[weekKey],
      agentsById: state.agents.byId,
      morningWbdMap: state.morningWbdMap,
      salaOpportunities,
      lobbyOpportunities,
    });
    await copyTextToClipboard(text);
  });
}

export function renderHorarioView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);
  const selectedDay = container.dataset.horarioShareDay
    || defaultWhatsAppShareDay(weekKey, state.forecasts[weekKey] || []);

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Horario semanal</h2>
        <p class="view-subtitle">Descarga la imagen para el grupo o copia el texto con @ para avisos nocturnos.</p>
      </div>
      <div class="view-actions view-actions--wrap">
        ${renderWeekSelector(weekKey)}
        ${renderWhatsAppControls(weekKey, headers, selectedDay)}
        <button type="button" class="btn-secondary" id="horario-image-btn">Descargar imagen</button>
        <button type="button" class="btn-primary" id="horario-share-btn">Copiar texto WhatsApp</button>
      </div>
    </div>
    <div id="published-mount" class="published-desktop"></div>
    <div id="published-mobile-cards" class="published-mobile-cards"></div>
  `;

  container.querySelector('#horario-share-day')?.addEventListener('change', (event) => {
    container.dataset.horarioShareDay = event.target.value;
  });

  bindWeekSelector(container, () => renderHorarioView(container));
  bindHorarioShare(container, weekKey);

  container.querySelector('#published-mount').innerHTML = renderPublishedSchedule({ weekKey, headers });
  container.querySelector('#published-mobile-cards').innerHTML = renderPublishedDayCards(weekKey, headers);
}

export function renderDashboardView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);
  const useDayEditor = shouldUseDayEditor();
  const selectedDay = container.dataset.dashboardDay || DAYS[0];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Dashboard</h2>
        <p class="view-subtitle">${useDayEditor ? 'Modo día activo. Usa Agregar en cada bloque.' : 'Arrastra agentes o usa + para corregir.'}</p>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="distribution-mount"></div>
    <div id="schedule-mount"></div>
  `;

  bindWeekSelectorDashboard(container, weekKey);
  container.querySelector('#distribution-mount').innerHTML = renderDistributionPanel(weekKey);

  const mount = container.querySelector('#schedule-mount');
  if (useDayEditor) {
    mount.innerHTML = renderScheduleDayEditor({ weekKey, headers, selectedDay });
    bindScheduleDayEditor(mount, {
      weekKey,
      headers,
      onDayChange: (day) => {
        container.dataset.dashboardDay = day;
        renderDashboardView(container);
      },
    });
  } else {
    mount.innerHTML = renderScheduleGrid({ weekKey, headers, canEdit: true });
    bindScheduleGrid(mount, { canEdit: true });
  }
}

function bindWeekSelectorDashboard(container, weekKey) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    renderDashboardView(container);
  });
}
