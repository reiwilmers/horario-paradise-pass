import { computeWeeklyDistribution } from '../../domain/distribution.js';
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
  return row.sala >= 4 || row.lobby >= 4 || row.posibleOff >= 2 || row.off >= 2;
}

function statPart(label, value, warn = false) {
  return `<span class="agent-stat ${warn ? 'agent-stat--warn' : ''}">${label}: <b>${value}</b></span>`;
}

function renderSummaryLine(row) {
  return [
    statPart('Sala', row.sala, row.sala >= 4),
    statPart('Lobby', row.lobby, row.lobby >= 4),
    statPart('Cierre', row.cierre),
    statPart('Apertura', row.abre),
    statPart('WBD', row.wbdMorning),
    statPart('WBD 5:30', row.wbdEvening),
    statPart('PO', row.posibleOff, row.posibleOff >= 2),
    statPart('Off', row.off, row.off >= 2),
  ].join('<span class="agent-stat-sep">/</span>');
}

export function renderDistributionPanel(weekKey) {
  const state = getState();
  const rows = computeWeeklyDistribution(
    state.schedules[weekKey].days,
    state.agents.byId,
    state.morningWbdMap,
  );

  return `
    <section class="distribution-panel panel">
      <div class="distribution-panel__head">
        <div>
          <h3>Indicadores de la semana</h3>
          <p class="view-subtitle">Resumen por agente antes de publicar el horario.</p>
        </div>
        <p class="distribution-panel__count">${rows.length} agentes</p>
      </div>
      <div class="agent-stat-grid">
        ${rows.map((row) => `
          <article class="agent-stat-card ${hasDistributionWarn(row) ? 'agent-stat-card--warn' : ''}">
            <header class="agent-stat-card__head">
              <strong class="agent-stat-card__name">${escapeHtml(row.agent.name)}</strong>
              <span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span>
            </header>
            <p class="agent-stat-card__line">${renderSummaryLine(row)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}
