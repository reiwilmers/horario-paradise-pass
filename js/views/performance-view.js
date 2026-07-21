import {
  MONTH_KEYS,
  computeAgentLevelInsight,
  computeMonthStats,
  highlightClass,
  isAgentOnVacationInMonth,
  visibleMonthKeys,
} from '../../domain/performance.js';
import { getState } from '../store.js';
import { setSalesValue } from '../actions/performance.js';

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

function formatPct(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

function renderVacationCell(isVacation) {
  if (!isVacation) return '';
  return '<span class="performance-vac-tag">VAC</span>';
}

function renderMobileMonthPanel(agents, month, monthData, stats, year, requests, agentsById, visibleMonths) {
  return `
    <section class="performance-mobile panel">
      <label class="performance-mobile__picker">
        Mes
        <select id="performance-month-select">
          ${visibleMonths.map((key) => `<option value="${key}" ${key === month ? 'selected' : ''}>${key}</option>`).join('')}
        </select>
      </label>
      <p class="performance-mobile__avg">Promedio ${month}: <strong>${stats.average || '—'}</strong></p>
      <div class="performance-mobile__list">
        ${agents.map((agent) => {
          const value = monthData[agent.id];
          const hasValue = value != null && value !== '';
          const onVacation = isAgentOnVacationInMonth(agent.id, month, year, requests);
          const cellClass = onVacation
            ? 'performance-cell--vacation'
            : (hasValue ? highlightClass(value, stats) : '');
          const insight = computeAgentLevelInsight(agent, {
            monthData,
            visibleMonths: visibleMonthKeys(new Date(), year),
            year,
            requests,
            agentsById,
          });
          return `
          <article class="performance-mobile__row ${cellClass}">
            <div>
              <strong>${escapeHtml(agent.name)}</strong>
              <span class="category-pill ${CATEGORY_CLASS[agent.category]} is-active">${agent.category}</span>
            </div>
            <div class="performance-mobile__inputs">
              ${onVacation ? renderVacationCell(true) : `
                <input class="performance-input" type="number" min="0" inputmode="numeric"
                  data-sales-input="1" data-month="${month}" data-agent-id="${escapeHtml(agent.id)}"
                  value="${hasValue ? escapeHtml(value) : ''}" placeholder="—" aria-label="Certificados ${escapeHtml(agent.name)}" />
                <span class="performance-pct">${hasValue ? formatPct(stats.pctByAgent[agent.id]) : '—'}</span>
              `}
              ${cellClass === 'performance-cell--max' ? '<span class="performance-badge performance-badge--max">▲ Top</span>' : ''}
              ${cellClass === 'performance-cell--min' ? '<span class="performance-badge performance-badge--min">▼ Bajo</span>' : ''}
            </div>
            <p class="performance-mobile__insight ${insight.trendClass}">${escapeHtml(insight.trendLabel)}</p>
            ${insight.suggestion ? `<p class="performance-mobile__suggestion">${escapeHtml(insight.suggestion)}</p>` : ''}
          </article>
        `;
        }).join('')}
      </div>
    </section>
  `;
}

export function renderPerformanceView(container) {
  const state = getState();
  const year = state.salesTracking.year;
  const yearKey = String(year);
  const monthData = state.salesTracking.byYear[yearKey] || {};
  const agentsById = state.agents.byId;
  const requests = state.requests;
  const agents = state.agents.ids
    .map((id) => state.agents.byId[id])
    .filter((agent) => agent.active);

  const visibleMonths = visibleMonthKeys(new Date(), year);
  const selectedMonth = container.dataset.performanceMonth || visibleMonths.at(-1) || 'ENE';

  const monthStats = Object.fromEntries(
    visibleMonths.map((month) => [month, computeMonthStats(monthData[month] || {})]),
  );

  const annualTotals = Object.fromEntries(
    agents.map((agent) => {
      const total = visibleMonths.reduce((sum, month) => {
        if (isAgentOnVacationInMonth(agent.id, month, year, requests)) return sum;
        const value = Number(monthData[month]?.[agent.id]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      return [agent.id, total];
    }),
  );
  const annualStats = computeMonthStats(annualTotals);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Seguimiento anual</h2>
        <p class="view-subtitle">Certificados por mes hasta ${visibleMonths.at(-1) || '—'}. El % compara contra el promedio del mes. VAC = vacaciones aprobadas.</p>
      </div>
      <p class="performance-year">${year}</p>
    </div>

    ${renderMobileMonthPanel(
      agents,
      selectedMonth,
      monthData[selectedMonth] || {},
      monthStats[selectedMonth] || computeMonthStats({}),
      year,
      requests,
      agentsById,
      visibleMonths,
    )}

    <div class="performance-desktop panel">
      <div class="table-wrap performance-scroll">
        <table class="simple-table performance-table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Cat.</th>
              ${visibleMonths.map((month) => `<th colspan="2">${month}</th>`).join('')}
              <th colspan="2">Anual</th>
              <th>Nivel</th>
            </tr>
            <tr>
              <th colspan="2"></th>
              ${visibleMonths.map(() => '<th>Cant.</th><th>%</th>').join('')}
              <th>Total</th><th>%</th>
              <th>Tendencia / sugerencia</th>
            </tr>
          </thead>
          <tbody>
            ${agents.map((agent) => {
              const insight = computeAgentLevelInsight(agent, {
                monthData,
                visibleMonths,
                year,
                requests,
                agentsById,
              });
              return `
              <tr>
                <td class="performance-name">${escapeHtml(agent.name)}</td>
                <td><span class="category-pill ${CATEGORY_CLASS[agent.category]} is-active">${agent.category}</span></td>
                ${visibleMonths.map((month) => {
                  const stats = monthStats[month];
                  const value = monthData[month]?.[agent.id];
                  const hasValue = value != null && value !== '';
                  const onVacation = isAgentOnVacationInMonth(agent.id, month, year, requests);
                  const cellClass = onVacation
                    ? 'performance-cell--vacation'
                    : (hasValue ? highlightClass(value, stats) : '');
                  return `
                  <td class="performance-cell ${cellClass}">
                    ${onVacation ? renderVacationCell(true) : `
                      <input class="performance-input" type="number" min="0" inputmode="numeric"
                        data-sales-input="1" data-month="${month}" data-agent-id="${escapeHtml(agent.id)}"
                        value="${hasValue ? escapeHtml(value) : ''}" placeholder="—" />
                    `}
                  </td>
                  <td class="performance-pct">${onVacation ? 'VAC' : (hasValue ? formatPct(stats.pctByAgent[agent.id]) : '—')}</td>
                `;
                }).join('')}
                <td class="performance-cell ${highlightClass(annualTotals[agent.id], annualStats)}">${annualTotals[agent.id] || 0}</td>
                <td class="performance-pct">${formatPct(annualStats.pctByAgent[agent.id])}</td>
                <td class="performance-insight">
                  <span class="performance-trend ${insight.trendClass}">${escapeHtml(insight.trendLabel)}</span>
                  ${insight.suggestion ? `<span class="performance-suggestion">${escapeHtml(insight.suggestion)}</span>` : ''}
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><strong>Promedio mes</strong></td>
              ${visibleMonths.map((month) => `<td colspan="2">${monthStats[month].average || '—'}</td>`).join('')}
              <td colspan="2">${annualStats.average || '—'}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#performance-month-select')?.addEventListener('change', (event) => {
    container.dataset.performanceMonth = event.target.value;
    renderPerformanceView(container);
  });

  container.querySelectorAll('[data-sales-input="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const raw = input.value.trim();
      const value = raw === '' ? null : Number(raw);
      await setSalesValue(input.dataset.month, input.dataset.agentId, Number.isFinite(value) ? value : null);
      renderPerformanceView(container);
    });
  });
}
