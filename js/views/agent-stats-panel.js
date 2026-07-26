import {
  RATIO_METRICS,
  buildAgentStatsSnapshot,
  buildJulyMonthCatchupEntry,
  datesInWeek,
  defaultStatsDate,
  formatMetricLine,
  getDailyEntry,
  isJulyBulkCatchupActive,
  isJulyDailyRegistrationOpen,
  JULY_BULK_CATCHUP,
  mondayOfIsoDate,
} from '../../domain/agentSalesStats.js';
import { getAgentMonthGoals, progressTone } from '../../domain/monthlyGoals.js';
import { monthKeyFromIsoDate } from '../../domain/agentSalesStats.js';
import { getState } from '../store.js';
import { saveAgentDailySales, saveJulyMonthCatchup } from '../actions/agentSalesStats.js';
import { clearStatsFormDraft } from './agent-stats-form-draft.js';
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

function formatDayChip(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const weekday = date.toLocaleString('es-DO', { weekday: 'short' }).replace('.', '');
  const day = date.getDate();
  return `${weekday} ${day}`;
}

function dayHasEntry(entry) {
  if (!entry) return false;
  if (entry.Certs) return true;
  return RATIO_METRICS.some((metric) => (entry[metric] || []).some((value) => Number(value) > 0));
}

function renderRecentDaysStrip(isoDate, agentId, stats) {
  const weekDates = datesInWeek(mondayOfIsoDate(isoDate));
  return `
    <div class="agent-stats__week-days">
      <p class="agent-stats__week-days-label">Cambiar día de la semana</p>
      <div class="agent-stats__week-days-row">
        ${weekDates.map((dayIso) => {
          const entry = getDailyEntry(stats, dayIso, agentId);
          const active = dayIso === isoDate ? ' is-active' : '';
          const hasData = dayHasEntry(entry) ? ' has-data' : '';
          return `
            <button type="button" class="agent-stats__day-chip${active}${hasData}" data-stats-day="${escapeHtml(dayIso)}">
              ${escapeHtml(formatDayChip(dayIso))}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
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
  const lines = ['SALA', 'LR', 'OA', 'LG', 'LB', 'Certs'].map((metric) => {
    const value = formatMetricLine(metric, rollup, metric !== 'Certs');
    return `<p class="agent-stats-share__line"><span>${metric}</span><span>${escapeHtml(value ? `= ${value}` : '=')}</span></p>`;
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
    <div class="agent-stats-share" data-stats-share-card="1">
      <p class="agent-stats-share__name">${escapeHtml(agentName.toUpperCase())}</p>
      <p class="agent-stats-share__date">${escapeHtml(formatShareDate(snapshot.isoDate))}</p>
      ${renderShareSection('DÍA', snapshot.day)}
      ${renderShareSection('SEMANA', snapshot.week)}
      ${renderShareSection('MES', snapshot.month)}
      ${snapshot.certGoal ? `<p class="agent-stats-share__meta">Meta ${snapshot.certGoal}</p>` : ''}
    </div>
  `;
}

function renderJulyMonthCatchupSection(agentId, stats, editable) {
  if (!editable || !isJulyBulkCatchupActive()) return '';
  const entry = buildJulyMonthCatchupEntry(stats, agentId);
  return `
    <details class="agent-stats__july-bulk" open data-july-bulk="1">
      <summary>Totales de julio (1 al 26)</summary>
      <p class="agent-stats__entry-note">Un solo registro con tus números <strong>acumulados del mes</strong> hasta hoy. Desde el <strong>27 de julio</strong> usas <strong>Registrar día</strong> abajo.</p>
      <div class="agent-stats__entry-grid">
        ${renderMetricInputs('july-month', entry, true)}
      </div>
      <div class="agent-stats__actions">
        <button type="button" class="btn-primary" data-save-july-month="1" data-agent-id="${escapeHtml(agentId)}">Guardar totales de julio</button>
      </div>
    </details>
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
  const dailyOpen = isJulyDailyRegistrationOpen(isoDate);
  const catchupActive = isJulyBulkCatchupActive();

  return `
    <div class="agent-stats" data-agent-stats="1">

      <section class="agent-stats__section panel" data-stats-section="entry">
        <div class="agent-stats__section-head">
          <h3>Registrar día</h3>
          ${editable && dailyOpen ? `
            <label class="agent-stats__date">
              Fecha
              <input class="field-input" type="date" data-stats-date="1" value="${escapeHtml(isoDate)}" min="${catchupActive ? escapeHtml(JULY_BULK_CATCHUP.dailyStartDate) : ''}" />
            </label>
          ` : `<p class="agent-stats__date-label">${escapeHtml(isoDate)}</p>`}
        </div>
        ${renderJulyMonthCatchupSection(agentId, state.agentSalesStats, editable)}
        ${editable && dailyOpen ? `
          ${renderRecentDaysStrip(isoDate, agentId, state.agentSalesStats)}
          <div class="agent-stats__entry-grid">
            ${renderMetricInputs('entry', entry, true)}
          </div>
          <p class="agent-stats__entry-note">Si un cliente canceló, corrige el día donde registraste la venta.</p>
          <div class="agent-stats__actions">
            <button type="button" class="btn-primary" data-save-agent-stats="1" data-agent-id="${escapeHtml(agentId)}">Guardar día</button>
          </div>
        ` : catchupActive ? `
          <p class="agent-stats__entry-note agent-stats__entry-note--info">El registro diario abre el <strong>27 de julio</strong>. Hoy completa los totales del mes arriba.</p>
        ` : renderMetricInputs('entry', entry, false)}
      </section>

      <section class="agent-stats__section panel" data-stats-section="share">
        <h3>Stats</h3>
        ${snapshot.certGoal ? `
          <div class="agent-stats__goal">
            <div class="agent-stats__goal-head">
              <p>Meta mensual: <strong>${snapshot.certGoal}</strong></p>
              <p>${snapshot.monthCerts}/${snapshot.certGoal} certificados (${snapshot.progressPct ?? 0}%)</p>
            </div>
            <div class="goal-kr__bar" aria-hidden="true">
              <span class="goal-kr__bar-fill goal-kr__bar-fill--${progressTone(snapshot.progressPct)}" style="width: ${snapshot.progressPct ?? 0}%"></span>
            </div>
            <p class="agent-stats__pace">
              ${snapshot.certsRemaining ? `Te faltan <strong>${snapshot.certsRemaining}</strong> certificados.` : 'Meta mensual cumplida.'}
              ${snapshot.dailyPaceNeeded ? ` Ritmo: <strong>${snapshot.dailyPaceNeeded}</strong> cert/día.` : ''}
            </p>
          </div>
        ` : ''}
        <div class="agent-stats__records">
          <span>Record día ${recordBadge(snapshot.beatRecord.day)}</span>
          <span>Record semana ${recordBadge(snapshot.beatRecord.week)}</span>
          <span>Record mes ${recordBadge(snapshot.beatRecord.month)}</span>
        </div>
        ${renderShareCard(agentName, snapshot)}
        <div class="agent-stats__share-actions">
          <p class="agent-stats__share-hint">Screenshot → WhatsApp Stats.</p>
          <button type="button" class="btn-secondary" data-download-agent-stats="1">Descargar imagen stats</button>
        </div>
      </section>

    </div>
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

  const notifySaved = (options = {}) => onSaved?.(options);

  root.querySelector('[data-save-agent-stats="1"]')?.addEventListener('click', async (event) => {
    const agentId = event.currentTarget.dataset.agentId;
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    await saveAgentDailySales(agentId, isoDate, readEntryFromForm(root, 'entry'));
    notifySaved({ agentId, isoDate });
  });

  root.querySelector('[data-save-july-month="1"]')?.addEventListener('click', async (event) => {
    const agentId = event.currentTarget.dataset.agentId;
    await saveJulyMonthCatchup(agentId, readEntryFromForm(root, 'july-month'));
    notifySaved({ agentId, isoDate: JULY_BULK_CATCHUP.dailyStartDate });
  });

  root.querySelector('[data-download-agent-stats="1"]')?.addEventListener('click', async () => {
    const card = root.querySelector('[data-stats-share-card="1"]');
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const agentName = card?.querySelector('.agent-stats-share__name')?.textContent?.trim() || 'stats';
    const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-${isoDate}.png`;
    await downloadScheduleImage(card, filename);
  });
}

export function bindStatsPanelExtras(container, { onDateChange } = {}) {
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  root.querySelectorAll('[data-stats-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextDate = button.dataset.statsDay;
      if (!nextDate) return;
      onDateChange?.(nextDate);
    });
  });
}

export function defaultAgentStatsDate() {
  return defaultStatsDate();
}
