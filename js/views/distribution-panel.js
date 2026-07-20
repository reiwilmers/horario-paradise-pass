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

function warnClass(value, threshold) {
  return value >= threshold ? 'distribution-warn' : '';
}

export function renderDistributionPanel(weekKey) {
  const state = getState();
  const rows = computeWeeklyDistribution(state.schedules[weekKey].days, state.agents.byId);

  const cards = rows.map((row) => `
    <article class="distribution-card ${row.sala >= 4 || row.lobby >= 4 ? 'distribution-card--warn' : ''}">
      <header class="distribution-card__head">
        <strong>${escapeHtml(row.agent.name)}</strong>
        <span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span>
      </header>
      <div class="distribution-card__stats">
        <span>Sala <b class="${warnClass(row.sala, 4)}">${row.sala}</b></span>
        <span>Lobby <b class="${warnClass(row.lobby, 4)}">${row.lobby}</b></span>
        <span>P.Off <b class="${warnClass(row.posibleOff, 2)}">${row.posibleOff}</b></span>
        <span>Off <b class="${warnClass(row.off, 2)}">${row.off}</b></span>
        <span>C.Sala <b>${row.cierreSala}</b></span>
        <span>Abre <b>${row.abre}</b></span>
        <span>C.Lobby <b>${row.cierreLobby}</b></span>
      </div>
    </article>
  `).join('');

  return `
    <section class="distribution-panel panel">
      <h3>Indicadores de la semana</h3>
      <p class="view-subtitle">Revisa rápido sala, lobby, off y cierres antes de publicar.</p>
      <div class="distribution-cards">${cards}</div>
      <div class="table-wrap distribution-scroll distribution-table-wrap">
        <table class="distribution-table simple-table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Cat.</th>
              <th>Sala</th>
              <th>Lobby</th>
              <th>P.Off</th>
              <th>Off</th>
              <th>C.Sala</th>
              <th>Abre</th>
              <th>C.Lobby</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="distribution-name">${escapeHtml(row.agent.name)}</td>
                <td><span class="category-pill ${CATEGORY_CLASS[row.agent.category]} is-active">${row.agent.category}</span></td>
                <td class="${warnClass(row.sala, 4)}">${row.sala}</td>
                <td class="${warnClass(row.lobby, 4)}">${row.lobby}</td>
                <td class="${warnClass(row.posibleOff, 2)}">${row.posibleOff}</td>
                <td class="${warnClass(row.off, 2)}">${row.off}</td>
                <td>${row.cierreSala}</td>
                <td>${row.abre}</td>
                <td>${row.cierreLobby}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
