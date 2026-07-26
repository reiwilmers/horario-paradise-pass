import {
  RATIO_METRICS,
  buildAgentStatsSnapshot,
  datesInWeek,
  defaultStatsDate,
  formatMetricLine,
  getDailyEntry,
  mondayOfIsoDate,
} from '../../domain/agentSalesStats.js';
import { getAgentMonthGoals, progressTone } from '../../domain/monthlyGoals.js';
import { monthKeyFromIsoDate } from '../../domain/agentSalesStats.js';
import { getState } from '../store.js';
import { saveAgentDailySales } from '../actions/agentSalesStats.js';
import { requestCoachFeedback, saveAgentReflection } from '../actions/coachFeedback.js';
import { clearStatsFormDraft } from './agent-stats-form-draft.js';
import { downloadScheduleImage } from '../utils/scheduleExport.js';
import { showError } from '../utils/toast.js';

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
      <p class="agent-stats__week-days-label">Editar otro día (semana y mes se recalculan solos)</p>
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

function renderCoachFeedbackCard(agentName, isoDate, entry) {
  if (!entry?.coachFeedback) return '';
  return `
    <div class="agent-coach-share panel" data-coach-share-card="1">
      <p class="agent-coach-share__brand">COACH PARADISE PASS</p>
      <p class="agent-coach-share__name">${escapeHtml(agentName.toUpperCase())}</p>
      <p class="agent-coach-share__date">${escapeHtml(formatShareDate(isoDate))}${entry.scenario ? ` · ${escapeHtml(entry.scenario)}` : ''}</p>
      ${entry.reflection ? `
        <div class="agent-coach-share__case">
          <p class="agent-coach-share__label">Caso del vendedor</p>
          <p class="agent-coach-share__text">${escapeHtml(entry.reflection)}</p>
        </div>
      ` : ''}
      <div class="agent-coach-share__feedback">${escapeHtml(entry.coachFeedback)}</div>
    </div>
  `;
}

function renderReflectionSection({ entry, editable, agentId }) {
  if (!editable && !entry.reflection && !entry.coachFeedback) return '';

  return `
    <div class="agent-stats__reflection panel">
      <div class="agent-stats__reflection-head">
        <h4>Coach del día</h4>
        <p class="view-subtitle">Describe qué pasó en tus shots. El Coach te responde aquí mismo — luego screenshot del feedback para WhatsApp Stats.</p>
      </div>
      ${entry.coachFeedback ? '<p class="agent-stats__coach-status">Feedback del Coach listo. Toma screenshot de la tarjeta de abajo.</p>' : ''}
      ${editable ? `
        <label class="goal-field">
          Escenario
          <select class="field-input" data-stats-scenario="1">
            <option value="" ${!entry.scenario ? 'selected' : ''}>Seleccionar…</option>
            <option value="SALA" ${entry.scenario === 'SALA' ? 'selected' : ''}>SALA</option>
            <option value="LOBBY" ${entry.scenario === 'LOBBY' ? 'selected' : ''}>LOBBY</option>
          </select>
        </label>
        <label class="goal-field">
          Reflexión del día
          <textarea class="field-input agent-stats__reflection-input" rows="3" data-stats-reflection="1" placeholder="Ej. No vendí el primer shot porque me dijeron que no viajan tan seguido…">${escapeHtml(entry.reflection || '')}</textarea>
        </label>
        <div class="agent-stats__actions">
          <button type="button" class="btn-secondary" data-save-reflection="1" data-agent-id="${escapeHtml(agentId)}">Guardar reflexión</button>
          <button type="button" class="btn-primary" data-request-coach-feedback="1" data-agent-id="${escapeHtml(agentId)}">Obtener feedback del Coach</button>
        </div>
      ` : entry.reflection ? `
        <p class="agent-stats__reflection-read">${escapeHtml(entry.reflection)}</p>
      ` : ''}
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
          <p class="view-subtitle">Todo en un solo lugar: números, stats, Coach y screenshots para WhatsApp Stats.</p>
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
          ${renderRecentDaysStrip(isoDate, agentId, state.agentSalesStats)}
          <div class="agent-stats__entry-grid">
            ${renderMetricInputs('entry', entry, true)}
          </div>
          <p class="agent-stats__entry-note">Si un cliente canceló, abre el día donde registraste la venta y ajusta los números. Semana y mes se actualizan automáticamente.</p>
          <div class="agent-stats__actions">
            <button type="button" class="btn-primary" data-save-agent-stats="1" data-agent-id="${escapeHtml(agentId)}">Guardar día</button>
          </div>
        </div>
      ` : ''}

      ${renderShareCard(agentName, snapshot)}

      <div class="agent-stats__share-actions">
        <p class="agent-stats__share-hint">Screenshot de stats → WhatsApp Stats.</p>
        <button type="button" class="btn-secondary" data-download-agent-stats="1">Descargar imagen stats</button>
      </div>

      ${renderReflectionSection({ entry, editable, agentId })}
      ${renderCoachFeedbackCard(agentName, isoDate, entry)}
      ${entry.coachFeedback ? `
        <div class="agent-stats__share-actions">
          <p class="agent-stats__share-hint">Screenshot del feedback del Coach → WhatsApp Stats.</p>
          <button type="button" class="btn-secondary" data-download-coach-feedback="1">Descargar imagen Coach</button>
        </div>
      ` : ''}
    </section>
  `;
}

function readEntryFromForm(container, prefix = 'entry', existing = {}) {
  const entry = {};
  for (const metric of RATIO_METRICS) {
    entry[metric] = [0, 1, 2].map((index) => {
      const raw = container.querySelector(`[data-stats-part="${prefix}-${metric}-${index}"]`)?.value?.trim();
      return raw === '' ? 0 : Number(raw);
    });
  }
  const certsRaw = container.querySelector(`[data-stats-certs="${prefix}"]`)?.value?.trim();
  entry.Certs = certsRaw === '' ? 0 : Number(certsRaw);
  entry.reflection = container.querySelector('[data-stats-reflection="1"]')?.value?.trim() || '';
  entry.scenario = container.querySelector('[data-stats-scenario="1"]')?.value?.trim() || '';
  entry.coachOpenedAt = existing.coachOpenedAt || '';
  entry.coachFeedback = existing.coachFeedback || '';
  entry.coachFeedbackAt = existing.coachFeedbackAt || '';
  return entry;
}

function readReflectionFromForm(root) {
  return {
    reflection: root.querySelector('[data-stats-reflection="1"]')?.value?.trim() || '',
    scenario: root.querySelector('[data-stats-scenario="1"]')?.value?.trim() || '',
  };
}

export function bindAgentStatsPanel(container, { onSaved } = {}) {
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  const notifySaved = (options = {}) => onSaved?.(options);

  root.querySelector('[data-save-agent-stats="1"]')?.addEventListener('click', async (event) => {
    const agentId = event.currentTarget.dataset.agentId;
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const existing = getDailyEntry(getState().agentSalesStats, isoDate, agentId);
    await saveAgentDailySales(agentId, isoDate, readEntryFromForm(root, 'entry', existing));
    notifySaved({ agentId, isoDate });
  });

  root.querySelector('[data-save-reflection="1"]')?.addEventListener('click', async (event) => {
    const agentId = event.currentTarget.dataset.agentId;
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const existing = getDailyEntry(getState().agentSalesStats, isoDate, agentId);
    await saveAgentReflection(agentId, isoDate, readEntryFromForm(root, 'entry', existing));
    notifySaved({ agentId, isoDate });
  });

  root.querySelector('[data-download-agent-stats="1"]')?.addEventListener('click', async () => {
    const card = root.querySelector('[data-stats-share-card="1"]');
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const agentName = card?.querySelector('.agent-stats-share__name')?.textContent?.trim() || 'stats';
    const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-${isoDate}.png`;
    await downloadScheduleImage(card, filename);
  });

  root.querySelector('[data-download-coach-feedback="1"]')?.addEventListener('click', async () => {
    const card = root.querySelector('[data-coach-share-card="1"]');
    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const agentName = card?.querySelector('.agent-coach-share__name')?.textContent?.trim() || 'coach';
    const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-coach-${isoDate}.png`;
    await downloadScheduleImage(card, filename);
  });

  root.querySelector('[data-request-coach-feedback="1"]')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    const agentId = btn.dataset.agentId;
    if (!agentId) return;

    const isoDate = root.querySelector('[data-stats-date="1"]')?.value || defaultStatsDate();
    const existing = getDailyEntry(getState().agentSalesStats, isoDate, agentId);
    const { reflection, scenario } = readReflectionFromForm(root);
    if (reflection.length < 20) {
      showError('Describe tu caso con al menos 20 caracteres antes de pedir feedback.');
      return;
    }

    const entry = readEntryFromForm(root, 'entry', existing);
    btn.disabled = true;
    btn.textContent = 'Generando feedback…';
    try {
      await requestCoachFeedback(agentId, isoDate, { reflection, scenario, entry });
      clearStatsFormDraft(agentId, isoDate);
      notifySaved({ agentId, isoDate, scrollToCoach: true });
    } catch (error) {
      showError(error.message || 'No se pudo obtener feedback del Coach.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Obtener feedback del Coach';
    }
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
