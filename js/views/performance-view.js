import { MONTH_KEYS, computeMonthStats, highlightClass } from '../../domain/performance.js';
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

export function renderPerformanceView(container) {
  const state = getState();
  const year = state.salesTracking.year;
  const yearKey = String(year);
  const monthData = state.salesTracking.byYear[yearKey] || {};
  const agents = state.agents.ids
    .map((id) => state.agents.byId[id])
    .filter((agent) => agent.active);

  const monthStats = Object.fromEntries(
    MONTH_KEYS.map((month) => [month, computeMonthStats(monthData[month] || {})]),
  );

  const annualTotals = Object.fromEntries(
    agents.map((agent) => {
      const total = MONTH_KEYS.reduce((sum, month) => {
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
        <p class="view-subtitle">Certificados por mes. El % compara contra el promedio del mes. Verde = más ventas, rojo = menos.</p>
      </div>
      <p class="performance-year">${year}</p>
    </div>

    <div class="performance-scroll panel">
      <table class="simple-table performance-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Cat.</th>
            ${MONTH_KEYS.map((month) => `
              <th colspan="2">${month}</th>
            `).join('')}
            <th colspan="2">Anual</th>
          </tr>
          <tr>
            <th colspan="2"></th>
            ${MONTH_KEYS.map(() => '<th>Cant.</th><th>%</th>').join('')}
            <th>Total</th><th>%</th>
          </tr>
        </thead>
        <tbody>
          ${agents.map((agent) => `
            <tr>
              <td class="performance-name">${escapeHtml(agent.name)}</td>
              <td><span class="category-pill ${CATEGORY_CLASS[agent.category]} is-active">${agent.category}</span></td>
              ${MONTH_KEYS.map((month) => {
    const stats = monthStats[month];
    const value = monthData[month]?.[agent.id];
    const hasValue = value != null && value !== '';
    const cellClass = hasValue ? highlightClass(value, stats) : '';
    return `
                <td class="performance-cell ${cellClass}">
                  <input
                    class="performance-input"
                    type="number"
                    min="0"
                    data-sales-input="1"
                    data-month="${month}"
                    data-agent-id="${escapeHtml(agent.id)}"
                    value="${hasValue ? escapeHtml(value) : ''}"
                    placeholder="—"
                  />
                </td>
                <td class="performance-pct">${hasValue ? formatPct(stats.pctByAgent[agent.id]) : '—'}</td>
              `;
  }).join('')}
              <td class="performance-cell ${highlightClass(annualTotals[agent.id], annualStats)}">${annualTotals[agent.id] || 0}</td>
              <td class="performance-pct">${formatPct(annualStats.pctByAgent[agent.id])}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>Promedio mes</strong></td>
            ${MONTH_KEYS.map((month) => `
              <td colspan="2">${monthStats[month].average || '—'}</td>
            `).join('')}
            <td colspan="2">${annualStats.average || '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  container.querySelectorAll('[data-sales-input="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const raw = input.value.trim();
      const value = raw === '' ? null : Number(raw);
      await setSalesValue(input.dataset.month, input.dataset.agentId, Number.isFinite(value) ? value : null);
      renderPerformanceView(container);
    });
  });
}
