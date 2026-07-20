import { FORECAST_LEVELS } from '../../domain/forecast.js';
import { weekRangeLabel } from '../../domain/forecast.js';
import { getState, setForecastEditWeek } from '../store.js';
import {
  updateForecastCell,
  updateForecastSettings,
  forecastRowMetrics,
} from '../actions/forecast.js';
import { generateScheduleForWeek } from '../actions/generate.js';
import { persistForecastEditWeek } from '../actions/persist.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderForecastTable(weekKey, rows, settings) {
  return `
    <div class="table-wrap panel">
    <table class="forecast-table simple-table">
      <thead>
        <tr>
          <th>Día</th>
          <th>Fecha</th>
          <th>Salidas totales</th>
          <th>Salidas reales</th>
          <th>Lobby sugerido</th>
          <th>Nivel</th>
          <th>Nota</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, index) => {
    const metrics = forecastRowMetrics(row, settings);
    const lobby = row.lobby !== '' && row.lobby != null ? row.lobby : metrics.lobbySuggested;
    return `
          <tr>
            <td>${escapeHtml(row.day)}</td>
            <td>${escapeHtml(row.date || '—')}</td>
            <td>
              <input
                class="field-input forecast-input"
                type="number"
                min="0"
                data-forecast-cell="total"
                data-index="${index}"
                value="${escapeHtml(row.total)}"
                placeholder="0"
              />
            </td>
            <td class="forecast-readonly">${metrics.realExits || '—'}</td>
            <td>
              <input
                class="field-input forecast-input"
                type="number"
                min="0"
                data-forecast-cell="lobby"
                data-index="${index}"
                value="${escapeHtml(lobby)}"
                placeholder="${metrics.lobbySuggested || 0}"
              />
            </td>
            <td>
              <select class="field-select" data-forecast-cell="level" data-index="${index}">
                ${FORECAST_LEVELS.map((level) => `
                  <option value="${level}" ${row.level === level ? 'selected' : ''}>${level}</option>
                `).join('')}
              </select>
            </td>
            <td>
              <input
                class="field-input forecast-input forecast-input--note"
                data-forecast-cell="note"
                data-index="${index}"
                value="${escapeHtml(row.note || '')}"
                placeholder="Nota operativa"
              />
            </td>
          </tr>
        `;
  }).join('')}
      </tbody>
    </table>
    </div>
  `;
}

export function renderForecastView(container) {
  const state = getState();
  const weekKey = state.forecastEditWeek;
  const rows = state.forecasts[weekKey] || [];
  const settings = state.forecastSettings;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Forecast</h2>
        <p class="view-subtitle">
          Edita salidas y genera el horario. Semana visible en Horario: <strong>${escapeHtml(state.visibleWeek)}</strong> (independiente).
        </p>
      </div>
      <div class="forecast-actions">
        <div class="week-switch" role="group" aria-label="Semana forecast">
          <button type="button" class="week-switch__btn ${weekKey === 'current' ? 'is-active' : ''}" data-forecast-week="current">Actual</button>
          <button type="button" class="week-switch__btn ${weekKey === 'next' ? 'is-active' : ''}" data-forecast-week="next">Próxima</button>
        </div>
        <button type="button" class="btn-primary" data-generate-schedule="1">Generar horario</button>
      </div>
    </div>

    <p class="forecast-range">${escapeHtml(weekRangeLabel(weekKey))}</p>

    <div class="forecast-settings">
      <label>
        % calificación
        <input class="field-input" type="number" min="0" max="1" step="0.01" data-setting="qualificationPercent" value="${settings.qualificationPercent ?? 0.6}" />
      </label>
      <label>
        Shots / agente
        <input class="field-input" type="number" min="1" data-setting="shotsPerAgent" value="${settings.shotsPerAgent ?? 15}" />
      </label>
    </div>

    ${renderForecastTable(weekKey, rows, settings)}

    <div class="forecast-footnote">
      <p>Las salidas reales y lobby sugerido se recalculan con los ajustes de arriba. WBD mañana usa <code>morningWbdEligible</code>; tarde usa WBD 5:30PM.</p>
    </div>
  `;

  bindForecastView(container, weekKey);
}

function bindForecastView(container, weekKey) {
  container.querySelectorAll('[data-forecast-week]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextWeek = btn.dataset.forecastWeek || 'current';
      setForecastEditWeek(nextWeek);
      await persistForecastEditWeek();
    });
  });

  container.querySelectorAll('[data-forecast-cell]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'change';
    input.addEventListener(eventName, async () => {
      const index = Number(input.dataset.index);
      const field = input.dataset.forecastCell;
      let value = input.value;
      if (field === 'total' || field === 'lobby') {
        value = value === '' ? '' : Number(value);
      }
      await updateForecastCell(weekKey, index, field, value);
    });
  });

  container.querySelectorAll('[data-setting]').forEach((input) => {
    input.addEventListener('change', async () => {
      const field = input.dataset.setting;
      const value = field === 'qualificationPercent'
        ? Number(input.value)
        : Number(input.value);
      await updateForecastSettings({ [field]: value });
    });
  });

  container.querySelector('[data-generate-schedule="1"]')?.addEventListener('click', async () => {
    const btn = container.querySelector('[data-generate-schedule="1"]');
    if (btn) btn.disabled = true;
    try {
      await generateScheduleForWeek(weekKey);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
