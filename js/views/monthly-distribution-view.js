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

function hasDistributionWarn(row) {
  return row.sala >= 16 || row.lobby >= 16 || row.posibleOff >= 8 || row.off >= 8;
}

function statPart(label, value, warn = false) {
  return `<span class="agent-stat ${warn ? 'agent-stat--warn' : ''}">${label}: <b>${value}</b></span>`;
}

function renderSummaryLine(row) {
  return [
    statPart('Sala', row.sala, row.sala >= 16),
    statPart('Lobby', row.lobby, row.lobby >= 16),
    statPart('Cierre', row.cierre),
    statPart('Apertura', row.abre),
    statPart('WBD', row.wbdMorning),
    statPart('WBD 5:30', row.wbdEvening),
    statPart('PO', row.posibleOff, row.posibleOff >= 8),
    statPart('Off', row.off, row.off >= 8),
    statPart('Vac', row.vacation),
  ].join('<span class="agent-stat-sep">/</span>');
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
    <div class="view-header">
      <div>
        <h2>Acumulado mensual</h2>
        <p class="view-subtitle">Días por agente en el mes (sala, lobby, WBD, off, vacaciones). El seguimiento inicia desde la semana vigente.</p>
      </div>
    </div>

    <section class="monthly-distribution panel">
      <div class="monthly-distribution__toolbar">
        ${monthNavButton('monthly-distribution-prev', '← Anterior', !canGoPrev)}
        <div class="monthly-distribution__month">
          <strong>${escapeHtml(monthKeyLabel(selectedMonth))}</strong>
          <span class="monthly-distribution__meta">${weekCount} semana${weekCount === 1 ? '' : 's'} · ${rows.length} agentes</span>
        </div>
        ${monthNavButton('monthly-distribution-next', 'Siguiente →', !canGoNext)}
      </div>

      ${!hasData ? `
        <p class="empty-state">Sin datos acumulados para este mes todavía. Se registran al guardar el horario semanal.</p>
      ` : `
        <div class="agent-stat-grid">
          ${rows.map((row) => `
            <article class="agent-stat-card ${hasDistributionWarn(row) ? 'agent-stat-card--warn' : ''}">
              <header class="agent-stat-card__head">
                <strong class="agent-stat-card__name">${escapeHtml(row.agent.name)}</strong>
                <span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span>
              </header>
              <p class="agent-stat-card__line">${renderSummaryLine(row)}</p>
              <p class="monthly-distribution__days">Días asignados: <b>${row.assignedDays}</b></p>
            </article>
          `).join('')}
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
