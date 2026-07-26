import {
  RATIO_METRICS,
  SALES_METRIC_KEYS,
  buildAgentStatsSnapshot,
  defaultStatsDate,
  formatMetricLine,
  getDailyEntry,
} from '../../domain/agentSalesStats.js';
import { getAgentMonthGoals, progressTone } from '../../domain/monthlyGoals.js';
import { monthKeyFromIsoDate } from '../../domain/agentSalesStats.js';
import { getState } from '../store.js';
import { saveAgentDailySales } from '../actions/agentSalesStats.js';
import { downloadScheduleImage } from '../utils/scheduleExport.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recordBadge(status) {
  if (status === 'beat') return '<span class="agent-stats__record agent-stats__record--beat">Nuevo record</span>';
  if (status === 'tie') return '<span class="agent-stats__record agent-stats__record--tie">Empató record</span>';
  return '';
}

function renderMetricInputs(prefix, entry, editable) {
  const ratioFields = RATIO_METRICS.map((metric) => {
    const parts = entry?.[metric] || [0, 0, 0];
    if (!editable) {
      return `<div class="agent-stats__metric"><span>${metric}</span><strong>${escapeHtml(formatMetricLine(metric, { [metric]: parts })) || '—'}</strong></div>`;
    }
    return `
      <label class="agent-stats__metric">
        <span>${metric}</span>
        <span class="agent-stats__parts">
          <input class="field-input" type="number" min="0" inputmode="numeric" data-stats-part="${prefix}-${metric}-0" value="${parts[0] || ''}" placeholder="0" />
          <input class="field-input" type="number" min="0" inputmode="numeric" data-stats-part="${prefix}-${metric}-1" value="${parts[1] || ''}" placeholder="0" />
          <input class="field-input" type="number" min="0" inputmode="numeric" data-stats-part="${prefix}-${metric}-2" value="${parts[2] || ''}" placeholder="0" />
        </span>
      </label>
    `;
  }).join('');

  const certs = entry?.Certs || 0;
  const certsField = editable ? `
    <label class="agent-stats__metric">
      <span>Certs</span>
      <input class="field-input" type="number" min="0" inputmode="numeric" data-stats-certs="${prefix}" value="${certs || ''}" placeholder="0" />
    </label>
  ` : `<div class="agent-stats__metric"><span>Certs</span><strong>${certs || '—'}</strong></div>`;

  return ratioFields + certsField;
}

function formatShareDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDate();
  const month = date.toLocaleString('es-DO', { month: 'short' }).replace('.', '').toUpperCase();
  return `${day} ${month}`;
}

function renderShareSection(label, rollup) {
  const lines = SALES_METRIC_KEYS.map((metric) => {
    const value = formatMetricLine(metric, rollup, metric !== 'Certs');
    return `<p class="agent-stats-share__line">${metric} = ${escapeHtml(value)}</p>`;
  }).join('');
  return `
    <div class="agent-stats-share__section">
      <p class="agent-stats-share__label">${escapeHtml(label)}</p>
      ${lines}
    </div>
  `;
}

function renderShareCard(agentName, snapshot) {
  return `
    <div class="agent-stats-share panel" data-stats-share-card="1">
      <p class="agent-stats-share__name">${escapeHtml(agentName.toUpperCase())}</p>
      <p class="agent-stats-share__date">${escapeHtml(formatShareDate(snapshot.isoDate))}</p>
      ${renderShareSection('DÍA', snapshot.day)}
      ${renderShareSection('SEMANA', snapshot.week)}
      ${renderShareSection('MES', snapshot.month)}
      ${snapshot.certGoal ? `<p class="agent-stats-share__meta">Meta ${snapshot.certGoal}</p>` : ''}
    </div>
  `;
}

export function renderAgentStatsPanel({ agentId, agentName, isoDate, editable = true }) {
  const state = getState();
  const goals = getAgentMonthGoals(
    state.monthlyGoals,
    state.monthlyGoals.year,
    monthKeyFromIsoDate(isoDate),
    agentId,
  );
  const snapshot = buildAgentStatsSnapshot({
    stats: state.agentSalesStats,
    agentId,
    isoDate,
    goals,
    year: state.agentSalesStats.year,
  });
  const entry = getDailyEntry(state.agentSalesStats, isoDate, agentId);

  return `
    <section class="agent-stats panel" data-agent-stats="1">
      <div class="agent-stats__head">
        <div>
          <h3>Mis resultados</h3>
          <p class="view-subtitle">Registra tus números diarios. Al guardar, toma screenshot de la tarjeta y envíala al grupo de WhatsApp.</p>
        </div>
        ${editable ? `
          <label class="agent-stats__date">
            Fecha
            <input class="field-input" type="date" data-stats-date="1" value="${escapeHtml(isoDate)}" />
          </label>
        ` : `<p class="agent-stats__date-label">${escapeHtml(isoDate)}</p>`}
      </div>

      ${snapshot.certGoal ? `
        <div class="agent-stats__goal panel">
          <div class="agent-stats__goal-head">
            <p>Meta mensual: <strong>${snapshot.certGoal}</strong></p>
            <p>${snapshot.monthCerts}/${snapshot.certGoal} certificados (${snapshot.progressPct ?? 0}%)</p>
          </div>
          <div class="goal-kr__bar" aria-hidden="true">
            <span class="goal-kr__bar-fill goal-kr__bar-fill--${progressTone(snapshot.progressPct)}" style="width: ${snapshot.progressPct ?? 0}%"></span>
          </div>
          <p class="agent-stats__pace">
            ${snapshot.certsRemaining ? `Te faltan <strong>${snapshot.certsRemaining}</strong> certificados.` : 'Meta mensual cumplida.'}
            ${snapshot.dailyPaceNeeded ? ` Ritmo sugerido: <strong>${snapshot.dailyPaceNeeded}</strong> cert/día.` : ''}
          </p>
        </div>
      ` : '<p class="view-subtitle">Sin meta de certificados definida para este mes.</p>'}

      <div class="agent-stats__records">
        <span>Record día ${recordBadge(snapshot.beatRecord.day)}</span>
        <span>Record semana ${recordBadge(snapshot.beatRecord.week)}</span>
        <span>Record mes ${recordBadge(snapshot.beatRecord.month)}</span>
      </div>

      ${editable ? `
        <div class="agent-stats__entry panel">
          <h4>Registrar día</h4>
          <div class="agent-stats__entry-grid">
            ${renderMetricInputs('entry', entry, true)}
          </div>
          <div class="agent-stats__actions">
            <button type="button" class="btn-primary" data-save-agent-stats="1" data-agent-id="${escapeHtml(agentId)}">Guardar día</button>
          </div>
        </div>
      ` : ''}

      ${renderShareCard(agentName, snapshot)}

      <div class="agent-stats__share-actions">
        <p class="agent-stats__share-hint">Guarda tu día, toma screenshot de la tarjeta de arriba y compártela en el grupo de WhatsApp.</p>
        <button type="button" class="btn-secondary" data-download-agent-stats="1">Descargar imagen</button>
      </div>
    </section>
  `;
}

function readEntryFromForm(container, prefix = 'entry') {
  const entry = {};
  for (const metric of RATIO_METRICS) {
    entry[metric] = [0, 1, 2].map((index) => {
      const raw = container.querySelector(`[data-stats-part="${prefix}-${metric}-${index}"]`)?.value?.trim();
      return raw === '' ? 0 : Number(raw);
    });
  }
  const certsRaw = container.querySelector(`[data-stats-certs="${prefix}"]`)?.value?.trim();
  entry.Certs = certsRaw === '' ? 0 : Number(certsRaw);
  return entry;
}

export function bindAgentStatsPanel(container, { onSaved } = {}) {
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  root.querySelector('[data-save-agent-stats="1"]')?.addEventListener('click', async (event) => {
    const agentId = event.currentTarget.dataset.agentId;
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    await saveAgentDailySales(agentId, isoDate, readEntryFromForm(root));
    onSaved?.();
  });

  root.querySelector('[data-download-agent-stats="1"]')?.addEventListener('click', async () => {
    const card = root.querySelector('[data-stats-share-card="1"]');
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const agentName = card?.querySelector('.agent-stats-share__name')?.textContent?.trim() || 'stats';
    const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-${isoDate}.png`;
    await downloadScheduleImage(card, filename);
  });
}

export function defaultAgentStatsDate() {
  return defaultStatsDate();
}
