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

export function renderDistributionPanel(weekKey) {
  const state = getState();
  const rows = computeWeeklyDistribution(state.schedules[weekKey].days, state.agents.byId);

  return `
    <section class="distribution-panel panel">
      <h3>Indicadores de la semana</h3>
      <p class="view-subtitle">Revisa rápido sala, lobby, off y cierres antes de publicar.</p>
      <div class="distribution-scroll">
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
                <td class="${row.sala >= 4 ? 'distribution-warn' : ''}">${row.sala}</td>
                <td class="${row.lobby >= 4 ? 'distribution-warn' : ''}">${row.lobby}</td>
                <td class="${row.posibleOff >= 2 ? 'distribution-warn' : ''}">${row.posibleOff}</td>
                <td class="${row.off >= 2 ? 'distribution-warn' : ''}">${row.off}</td>
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
