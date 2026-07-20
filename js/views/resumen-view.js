import { buildAgentWeekSummary, filterRequestsForAgent } from '../../domain/agentSummary.js';
import { getState, currentUser, isAdminUser } from '../store.js';
import { dayHeaders, weekRangeLabel } from '../utils/calendar.js';

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

function statusClass(status = '') {
  const value = status.toLowerCase();
  if (value.includes('aprob')) return 'status-pill status-pill--ok';
  if (value.includes('rechaz')) return 'status-pill status-pill--bad';
  if (value.includes('fuera')) return 'status-pill status-pill--warn';
  return 'status-pill status-pill--pending';
}

function renderWeekSummary(agentId, weekKey) {
  const state = getState();
  const schedule = state.schedules[weekKey];
  const forecast = state.forecasts[weekKey] || [];
  const headers = dayHeaders(forecast, weekKey);
  const rows = buildAgentWeekSummary(schedule.days, agentId, {
    morningWbdMap: state.morningWbdMap,
    forecastRows: forecast,
  });

  return `
    <div class="summary-week panel">
      <h3>Semana ${escapeHtml(weekRangeLabel(weekKey))}</h3>
      <div class="summary-week__grid">
        ${rows.map((row, index) => `
          <article class="summary-day ${row.block ? 'summary-day--assigned' : 'summary-day--empty'}">
            <p class="summary-day__head">${escapeHtml(headers[index] || row.day)}</p>
            <p class="summary-day__block">${escapeHtml(row.label)}</p>
            ${row.wbd ? '<span class="summary-day__wbd">WBD</span>' : ''}
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRequestsList(agentId) {
  const requests = filterRequestsForAgent(getState().requests, agentId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (!requests.length) {
    return '<p class="view-subtitle">No hay solicitudes registradas para este agente.</p>';
  }

  return `
    <table class="simple-table summary-requests">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Fechas</th>
          <th>Motivo</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map((request) => `
          <tr>
            <td>${escapeHtml(request.type)}</td>
            <td>${escapeHtml(request.from)}${request.until && request.until !== request.from ? ` — ${escapeHtml(request.until)}` : ''}</td>
            <td>${escapeHtml(request.reason)}</td>
            <td><span class="${statusClass(request.status)}">${escapeHtml(request.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAgentPicker(selectedId) {
  const agents = getState().agents.ids
    .map((id) => getState().agents.byId[id])
    .filter((agent) => agent.active);

  return `
    <label class="summary-picker">
      Ver agente
      <select id="summary-agent-select">
        ${agents.map((agent) => `
          <option value="${escapeHtml(agent.id)}" ${agent.id === selectedId ? 'selected' : ''}>${escapeHtml(agent.name)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

export function renderResumenView(container) {
  const state = getState();
  const user = currentUser();
  const admin = isAdminUser();
  const weekKey = state.visibleWeek;
  const selectedId = admin
    ? (container.dataset.summaryAgentId || user?.id || state.agents.ids[0])
    : user?.id;

  if (!selectedId) {
    container.innerHTML = `
      <div class="view-header">
        <h2>Mi horario</h2>
        <p class="view-subtitle">Selecciona tu usuario en la barra lateral.</p>
      </div>
    `;
    return;
  }

  const agent = state.agents.byId[selectedId];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>${admin && selectedId !== user?.id ? `Resumen — ${escapeHtml(agent.name)}` : 'Mi horario'}</h2>
        <p class="view-subtitle">${admin ? 'Consulta el resumen semanal y solicitudes de cualquier agente.' : 'Tu semana actual sin buscar en la grilla.'}</p>
      </div>
      ${admin ? renderAgentPicker(selectedId) : ''}
    </div>

    <div class="summary-hero panel">
      <div>
        <p class="summary-hero__label">Agente</p>
        <p class="summary-hero__name ${CATEGORY_CLASS[agent.category] || ''}">${escapeHtml(agent.name)}</p>
      </div>
      <span class="category-pill ${CATEGORY_CLASS[agent.category]} is-active">${agent.category}</span>
    </div>

    ${renderWeekSummary(selectedId, weekKey)}

    <section class="panel">
      <h3>Solicitudes</h3>
      ${renderRequestsList(selectedId)}
    </section>
  `;

  if (admin) {
    container.querySelector('#summary-agent-select')?.addEventListener('change', (event) => {
      container.dataset.summaryAgentId = event.target.value;
      renderResumenView(container);
    });
  }
}
