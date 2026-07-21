import {
  aggregateMonthlyDistribution,
  countWeeksInMonth,
  currentMonthKey,
  listAvailableMonthKeys,
  monthKeyLabel,
  shiftMonthKey,
} from '../../domain/monthlyDistribution.js';
import { getState } from '../store.js';

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

function statCell(value, warn = false) {
  return `<td class="monthly-distribution-table__num ${warn ? 'monthly-distribution-table__num--warn' : ''}">${value}</td>`;
}

function monthNavButton(id, label, disabled) {
  return `<button type="button" id="${id}" class="btn-secondary btn-secondary--sm monthly-distribution__nav-btn" ${disabled ? 'disabled' : ''} aria-label="${label}">${label}</button>`;
}

export function renderMonthlyDistributionView(container) {
  const state = getState();
  const availableMonths = listAvailableMonthKeys(state.distributionSnapshots);
  const defaultMonth = currentMonthKey();
  let selectedMonth = container.dataset.monthKey || defaultMonth;
  if (!availableMonths.includes(selectedMonth)) {
    selectedMonth = availableMonths.at(-1) || defaultMonth;
  }

  const monthIndex = availableMonths.indexOf(selectedMonth);
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < availableMonths.length - 1;

  const rows = aggregateMonthlyDistribution(selectedMonth, {
    snapshots: state.distributionSnapshots,
    schedules: state.schedules,
    forecasts: state.forecasts,
    morningWbdMap: state.morningWbdMap,
    agentsById: state.agents.byId,
    exceptions: state.exceptions,
  });

  const weekCount = countWeeksInMonth(selectedMonth, state.distributionSnapshots, state.forecasts);
  const hasData = rows.some((row) => row.assignedDays > 0 || row.vacation > 0);

  container.innerHTML = `
    <section class="monthly-distribution monthly-distribution--compact panel">
      <div class="monthly-distribution__toolbar">
        <div class="monthly-distribution__title">
          <h2>Acumulado mensual</h2>
          <p class="monthly-distribution__hint">Días por agente · desde semana vigente</p>
        </div>
        ${monthNavButton('monthly-distribution-prev', '←', !canGoPrev)}
        <div class="monthly-distribution__month">
          <strong>${escapeHtml(monthKeyLabel(selectedMonth))}</strong>
          <span class="monthly-distribution__meta">${weekCount} sem · ${rows.length} ag.</span>
        </div>
        ${monthNavButton('monthly-distribution-next', '→', !canGoNext)}
      </div>

      ${!hasData ? `
        <p class="empty-state empty-state--compact">Sin datos acumulados para este mes todavía.</p>
      ` : `
        <div class="table-wrap monthly-distribution__table-wrap">
          <table class="simple-table monthly-distribution-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Cat</th>
                <th>S</th>
                <th>L</th>
                <th>Ci</th>
                <th>Ab</th>
                <th>W</th>
                <th>5:30</th>
                <th>PO</th>
                <th>Off</th>
                <th>Vac</th>
                <th>Tot</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td class="monthly-distribution-table__name">${escapeHtml(row.agent.name)}</td>
                  <td><span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span></td>
                  ${statCell(row.sala, row.sala >= 16)}
                  ${statCell(row.lobby, row.lobby >= 16)}
                  ${statCell(row.cierre)}
                  ${statCell(row.abre)}
                  ${statCell(row.wbdMorning)}
                  ${statCell(row.wbdEvening)}
                  ${statCell(row.posibleOff, row.posibleOff >= 8)}
                  ${statCell(row.off, row.off >= 8)}
                  ${statCell(row.vacation)}
                  ${statCell(row.assignedDays)}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;

  container.querySelector('#monthly-distribution-prev')?.addEventListener('click', () => {
    if (!canGoPrev) return;
    container.dataset.monthKey = availableMonths[monthIndex - 1];
    renderMonthlyDistributionView(container);
  });

  container.querySelector('#monthly-distribution-next')?.addEventListener('click', () => {
    if (!canGoNext) return;
    container.dataset.monthKey = availableMonths[monthIndex + 1];
    renderMonthlyDistributionView(container);
  });
}

export function shiftSelectedMonth(container, delta) {
  const state = getState();
  const availableMonths = listAvailableMonthKeys(state.distributionSnapshots);
  const current = container.dataset.monthKey || currentMonthKey();
  const next = shiftMonthKey(current, delta);
  if (!availableMonths.includes(next)) return false;
  container.dataset.monthKey = next;
  return true;
}
