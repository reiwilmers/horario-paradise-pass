import {
  aggregateMonthlyDistribution,
  countWeeksInMonth,
  currentMonthKey,
  listAvailableMonthKeys,
  monthKeyLabel,
} from '../../domain/monthlyDistribution.js';
import {
  computeFairnessChart,
  formatFairnessDelta,
} from '../../domain/fairnessChart.js';
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

function monthNavButton(id, label, disabled) {
  return `<button type="button" id="${id}" class="btn-secondary btn-secondary--sm monthly-distribution__nav-btn" ${disabled ? 'disabled' : ''} aria-label="${label}">${label}</button>`;
}

function renderMetricSection(section) {
  return `
    <section class="fairness-metric panel">
      <header class="fairness-metric__head">
        <h3>${escapeHtml(section.label)}</h3>
        <p class="fairness-metric__avg">Promedio equipo: <strong>${section.average.toFixed(1)}</strong> días</p>
      </header>
      <div class="fairness-metric__rows">
        ${section.rows.map((row) => `
          <div class="fairness-row fairness-row--${row.tone}">
            <div class="fairness-row__label">
              <strong>${escapeHtml(row.agent.name)}</strong>
              <span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span>
            </div>
            <div class="fairness-row__chart" aria-hidden="true">
              <div class="fairness-row__track">
                <span class="fairness-row__bar" style="width: ${row.barWidthPct}%"></span>
                <span class="fairness-row__avg-marker" style="left: ${row.avgMarkerPct}%"></span>
              </div>
            </div>
            <div class="fairness-row__stats">
              <strong>${row.value}</strong>
              <span class="fairness-delta fairness-delta--${row.tone}">${formatFairnessDelta(row.delta)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export function renderFairnessChartView(container) {
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

  const monthRows = aggregateMonthlyDistribution(selectedMonth, {
    snapshots: state.distributionSnapshots,
    schedules: state.schedules,
    forecasts: state.forecasts,
    morningWbdMap: state.morningWbdMap,
    agentsById: state.agents.byId,
    exceptions: state.exceptions,
  });

  const chart = computeFairnessChart(monthRows);
  const weekCount = countWeeksInMonth(selectedMonth, state.distributionSnapshots, state.forecasts);

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Equilibrio por agente</h2>
        <p class="view-subtitle">Compara días del mes vs el promedio del equipo. La línea vertical marca el promedio; resaltamos quien va muy arriba o abajo.</p>
      </div>
    </div>

    <section class="fairness-chart distribution-panel panel">
      <div class="monthly-distribution__toolbar">
        ${monthNavButton('fairness-chart-prev', '← Anterior', !canGoPrev)}
        <div class="monthly-distribution__month">
          <strong>${escapeHtml(monthKeyLabel(selectedMonth))}</strong>
          <span class="monthly-distribution__meta">${weekCount} semana${weekCount === 1 ? '' : 's'} · ${chart.agentCount} agentes</span>
        </div>
        ${monthNavButton('fairness-chart-next', 'Siguiente →', !canGoNext)}
      </div>

      <div class="fairness-chart__legend">
        <span class="fairness-legend-item"><span class="fairness-legend-dot fairness-legend-dot--avg"></span> Promedio equipo</span>
        <span class="fairness-legend-item"><span class="fairness-legend-dot fairness-legend-dot--high"></span> Por encima del promedio</span>
        <span class="fairness-legend-item"><span class="fairness-legend-dot fairness-legend-dot--low"></span> Por debajo del promedio</span>
      </div>

      ${!chart.hasData ? `
        <p class="empty-state">Sin datos acumulados para este mes todavía. Se registran al guardar el horario semanal.</p>
      ` : `
        <div class="fairness-chart__grid">
          ${chart.metricSections.map(renderMetricSection).join('')}
        </div>
      `}
    </section>
  `;

  container.querySelector('#fairness-chart-prev')?.addEventListener('click', () => {
    if (!canGoPrev) return;
    container.dataset.monthKey = availableMonths[monthIndex - 1];
    renderFairnessChartView(container);
  });

  container.querySelector('#fairness-chart-next')?.addEventListener('click', () => {
    if (!canGoNext) return;
    container.dataset.monthKey = availableMonths[monthIndex + 1];
    renderFairnessChartView(container);
  });
}
