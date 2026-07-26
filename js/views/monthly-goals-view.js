import {
  COMMITMENT_SLOTS,
  OPPORTUNITY_SLOTS,
  buildMeasurableItems,
  computeAnnualGoalSummary,
  computeProgress,
  getAgentMonthGoals,
  goalTrackingMonthKeys,
  progressTone,
} from '../../domain/monthlyGoals.js';
import {
  RATIO_METRICS,
  buildAgentStatsSnapshot,
  buildPeriodRollup,
  datesInMonth,
  defaultStatsDate,
  formatMetricLine,
} from '../../domain/agentSalesStats.js';
import { getState, currentUser, isAdminUser } from '../store.js';
import { saveAgentMonthGoals, updateCommitmentActual } from '../actions/monthlyGoals.js';
import { viewHasFocusedInput } from '../utils/viewFormGuard.js';

/** @type {Record<string, string>} */
let goalsFormDraft = {};

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

function renderProgressBadge(progress) {
  if (progress == null) return '<span class="goal-kr__badge goal-kr__badge--neutral">—</span>';
  return `<span class="goal-kr__badge goal-kr__badge--${progressTone(progress)}">${progress}%</span>`;
}

function renderKeyResultCard({ label, actual, target, progress, editableActual = false, inputAttrs = '' }) {
  const safeProgress = progress ?? 0;
  return `
    <article class="goal-kr goal-kr--${progressTone(progress)}">
      <div class="goal-kr__head">
        <span class="goal-kr__dot"></span>
        <p class="goal-kr__label">${escapeHtml(label)}</p>
        ${renderProgressBadge(progress)}
      </div>
      <p class="goal-kr__value">
        ${editableActual ? `<input class="goal-kr__actual-input" type="number" min="0" step="1" ${inputAttrs} value="${actual ?? ''}" placeholder="0" />` : `<strong>${actual ?? 0}</strong>`}
        <span class="goal-kr__target">/ ${target ?? '—'}</span>
      </p>
      <div class="goal-kr__bar" aria-hidden="true">
        <span class="goal-kr__bar-fill" style="width: ${safeProgress}%"></span>
      </div>
    </article>
  `;
}

function renderAnnualStrip(summary, months) {
  if (!months.length) {
    return '<p class="empty-state">Sin meses activos todavía. El seguimiento inicia en agosto.</p>';
  }
  return `
    <div class="goal-annual">
      <div class="goal-annual__score">
        <p class="goal-annual__label">Cumplimiento anual</p>
        <p class="goal-annual__value">${summary.average == null ? '—' : `${summary.average}%`}</p>
      </div>
      <div class="goal-annual__months">
        ${summary.months.map((entry) => `
          <div class="goal-month-pill goal-month-pill--${progressTone(entry.completion)}">
            <span>${entry.month}</span>
            <strong>${entry.completion}%</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRecordInputs(label, prefix, recordEntry) {
  const ratioFields = RATIO_METRICS.map((metric) => {
    const parts = recordEntry?.[metric] || [0, 0, 0];
    return `
      <label class="goal-field goal-field--compact">
        ${metric}
        <span class="agent-stats__parts">
          <input class="field-input" type="number" min="0" data-record-part="${prefix}-${metric}-0" value="${parts[0] || ''}" placeholder="0" />
          <input class="field-input" type="number" min="0" data-record-part="${prefix}-${metric}-1" value="${parts[1] || ''}" placeholder="0" />
          <input class="field-input" type="number" min="0" data-record-part="${prefix}-${metric}-2" value="${parts[2] || ''}" placeholder="0" />
        </span>
      </label>
    `;
  }).join('');
  return `
    <article class="goal-record panel">
      <h4>${escapeHtml(label)}</h4>
      <div class="goal-record__grid">
        ${ratioFields}
        <label class="goal-field goal-field--compact">
          Certs
          <input class="field-input" type="number" min="0" data-record-certs="${prefix}" value="${recordEntry?.Certs || ''}" placeholder="0" />
        </label>
      </div>
    </article>
  `;
}

function readRecordsFromForm(container) {
  const readEntry = (prefix) => {
    const entry = {};
    for (const metric of RATIO_METRICS) {
      entry[metric] = [0, 1, 2].map((index) => {
        const raw = container.querySelector(`[data-record-part="${prefix}-${metric}-${index}"]`)?.value?.trim();
        return raw === '' ? 0 : Number(raw);
      });
    }
    const certsRaw = container.querySelector(`[data-record-certs="${prefix}"]`)?.value?.trim();
    entry.Certs = certsRaw === '' ? 0 : Number(certsRaw);
    return entry;
  };
  return {
    daily: readEntry('daily'),
    weekly: readEntry('weekly'),
    monthly: readEntry('monthly'),
  };
}

function renderLiveStatsSummary(agentId, month, year, record, agentName) {
  const state = getState();
  const isoDate = defaultStatsDate();
  const goals = getAgentMonthGoals(state.monthlyGoals, year, month, agentId);
  const snapshot = buildAgentStatsSnapshot({
    stats: state.agentSalesStats,
    agentId,
    isoDate,
    goals: { ...goals, records: record },
    year,
  });
  return `
    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Avance actual (${month})</h3>
        <p class="view-subtitle">Suma automática desde Mi horario. Mes calendario vs semana lun-dom.</p>
      </div>
      <div class="agent-stats__rollup agent-stats__rollup--compact">
        <article class="agent-stats__block">
          <h4>Mes · Certs ${snapshot.month.Certs || 0}${record.monthly?.Certs ? ` / record ${record.monthly.Certs}` : ''}</h4>
          <p class="agent-stats__line"><span>SALA</span><strong>${escapeHtml(formatMetricLine('SALA', snapshot.month)) || '—'}</strong></p>
          <p class="agent-stats__line"><span>LR</span><strong>${escapeHtml(formatMetricLine('LR', snapshot.month)) || '—'}</strong></p>
        </article>
        <article class="agent-stats__block">
          <h4>Semana · Certs ${snapshot.week.Certs || 0}${record.weekly?.Certs ? ` / record ${record.weekly.Certs}` : ''}</h4>
          <p class="agent-stats__line"><span>LR</span><strong>${escapeHtml(formatMetricLine('LR', snapshot.week)) || '—'}</strong></p>
        </article>
        <article class="agent-stats__block">
          <h4>Hoy · Certs ${snapshot.day.Certs || 0}${record.daily?.Certs ? ` / record ${record.daily.Certs}` : ''}</h4>
        </article>
      </div>
    </section>
  `;
}

function renderGoalsForm(agentId, month, record, certActual, canEditGoals, year, agentName) {
  const measurable = buildMeasurableItems(record, certActual);
  const certItem = measurable.find((item) => item.id === 'cert');

  const certSection = canEditGoals ? `
    <article class="goal-kr goal-kr--neutral">
      <div class="goal-kr__head">
        <span class="goal-kr__dot"></span>
        <p class="goal-kr__label">Meta certificados mensuales</p>
      </div>
      <p class="goal-kr__value">
        <input class="goal-kr__actual-input" type="number" min="0" data-goal-field="certGoal" value="${record.certGoal ?? ''}" placeholder="Ej. 100" />
      </p>
    </article>
    ${certItem ? renderKeyResultCard(certItem) : ''}
  ` : (certItem ? renderKeyResultCard(certItem) : `
    <article class="goal-kr goal-kr--neutral goal-kr--empty">
      <p class="goal-kr__label">Certificados mensuales</p>
      <p class="view-subtitle">Sin meta definida para este mes.</p>
    </article>
  `);

  return `
    <div data-goals-form="1">
    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Resultados clave</h3>
        <p class="view-subtitle">Lo medible se calcula con avance real vs meta. Certificados se toman del seguimiento anual.</p>
      </div>
      <div class="goal-kr-grid">
        ${certSection}
      </div>
    </section>

    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Compromisos</h3>
        <p class="view-subtitle">Hasta 3 metas medibles del mes. Ej: gym 8 veces = 2 por semana.</p>
      </div>
      <div class="goal-kr-grid">
        ${record.commitments.map((commitment, index) => {
          if (canEditGoals) {
            return `
              <article class="goal-kr goal-kr--neutral">
                <label class="goal-field">
                  Compromiso ${index + 1}
                  <input class="field-input" data-commitment-label="${index}" value="${escapeHtml(commitment.label)}" placeholder="Ej. Ir al gym 2 veces por semana" />
                </label>
                <label class="goal-field">
                  Meta del mes
                  <input class="field-input" type="number" min="0" data-commitment-target="${index}" value="${commitment.target ?? ''}" placeholder="Ej. 8" />
                </label>
                <label class="goal-field">
                  Avance actual
                  <input class="field-input" type="number" min="0" data-commitment-actual="${index}" value="${commitment.actual ?? ''}" placeholder="0" />
                </label>
              </article>
            `;
          }
          if (!commitment.label || !commitment.target) {
            return `
              <article class="goal-kr goal-kr--neutral goal-kr--empty">
                <p class="goal-kr__label">Compromiso ${index + 1}</p>
                <p class="view-subtitle">Sin meta definida.</p>
              </article>
            `;
          }
          return renderKeyResultCard({
            label: commitment.label,
            actual: commitment.actual ?? 0,
            target: commitment.target,
            progress: computeProgress(commitment.actual, commitment.target),
            editableActual: true,
            inputAttrs: `data-commitment-progress="${index}" data-agent-id="${escapeHtml(agentId)}" data-month="${escapeHtml(month)}"`,
          });
        }).join('')}
      </div>
    </section>

    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Áreas de oportunidad</h3>
        <p class="view-subtitle">3 focos cualitativos para trabajar durante el mes.</p>
      </div>
      <div class="goal-opportunity-grid">
        ${record.opportunities.map((text, index) => `
          <article class="goal-opportunity">
            <p class="goal-opportunity__label">Área ${index + 1}</p>
            ${canEditGoals ? `
              <textarea class="field-input goal-opportunity__input" rows="3" data-opportunity-index="${index}" placeholder="Ej. Subir % de cierre">${escapeHtml(text)}</textarea>
            ` : `
              <p class="goal-opportunity__text">${text ? escapeHtml(text) : '—'}</p>
            `}
          </article>
        `).join('')}
      </div>
    </section>

    ${canEditGoals ? `
    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Records personales</h3>
        <p class="view-subtitle">Defínelos en la sesión de metas. El agente verá si los supera en Mi horario.</p>
      </div>
      <div class="goal-record-grid">
        ${renderRecordInputs('Record diario', 'daily', record.records?.daily)}
        ${renderRecordInputs('Record semanal', 'weekly', record.records?.weekly)}
        ${renderRecordInputs('Record mensual', 'monthly', record.records?.monthly)}
      </div>
    </section>
    ` : ''}

    ${canEditGoals ? renderLiveStatsSummary(agentId, month, year, record.records || {}, agentName) : ''}

    ${canEditGoals ? `
      <div class="goal-actions">
        <button type="button" class="btn-primary" data-save-goals="1" data-agent-id="${escapeHtml(agentId)}" data-month="${escapeHtml(month)}">
          Guardar metas del mes
        </button>
      </div>
    ` : ''}
    </div>
  `;
}

function goalsDraftKey(agentId, month, suffix) {
  return `${agentId}:${month}:${suffix}`;
}

function captureGoalsFormDraft(container, agentId, month) {
  if (!container || !agentId || !month) return;
  const certGoal = container.querySelector('[data-goal-field="certGoal"]')?.value ?? '';
  goalsFormDraft[goalsDraftKey(agentId, month, 'certGoal')] = certGoal;
  for (let index = 0; index < OPPORTUNITY_SLOTS; index += 1) {
    goalsFormDraft[goalsDraftKey(agentId, month, `opportunity-${index}`)] = (
      container.querySelector(`[data-opportunity-index="${index}"]`)?.value ?? ''
    );
    goalsFormDraft[goalsDraftKey(agentId, month, `commitment-label-${index}`)] = (
      container.querySelector(`[data-commitment-label="${index}"]`)?.value ?? ''
    );
    goalsFormDraft[goalsDraftKey(agentId, month, `commitment-target-${index}`)] = (
      container.querySelector(`[data-commitment-target="${index}"]`)?.value ?? ''
    );
    goalsFormDraft[goalsDraftKey(agentId, month, `commitment-actual-${index}`)] = (
      container.querySelector(`[data-commitment-actual="${index}"]`)?.value ?? ''
    );
  }
}

function restoreGoalsFormDraft(container, agentId, month) {
  if (!container || !agentId || !month) return;
  const certGoal = goalsFormDraft[goalsDraftKey(agentId, month, 'certGoal')];
  const certInput = container.querySelector('[data-goal-field="certGoal"]');
  if (certInput && certGoal != null) certInput.value = certGoal;
  for (let index = 0; index < OPPORTUNITY_SLOTS; index += 1) {
    const opportunity = container.querySelector(`[data-opportunity-index="${index}"]`);
    const label = container.querySelector(`[data-commitment-label="${index}"]`);
    const target = container.querySelector(`[data-commitment-target="${index}"]`);
    const actual = container.querySelector(`[data-commitment-actual="${index}"]`);
    const opportunityValue = goalsFormDraft[goalsDraftKey(agentId, month, `opportunity-${index}`)];
    const labelValue = goalsFormDraft[goalsDraftKey(agentId, month, `commitment-label-${index}`)];
    const targetValue = goalsFormDraft[goalsDraftKey(agentId, month, `commitment-target-${index}`)];
    const actualValue = goalsFormDraft[goalsDraftKey(agentId, month, `commitment-actual-${index}`)];
    if (opportunity && opportunityValue != null) opportunity.value = opportunityValue;
    if (label && labelValue != null) label.value = labelValue;
    if (target && targetValue != null) target.value = targetValue;
    if (actual && actualValue != null) actual.value = actualValue;
  }
}

function goalsFormHasDraft(agentId, month) {
  return Object.keys(goalsFormDraft).some((key) => key.startsWith(`${agentId}:${month}:`)
    && String(goalsFormDraft[key] || '').trim() !== '');
}

function clearGoalsFormDraft(agentId, month) {
  Object.keys(goalsFormDraft).forEach((key) => {
    if (key.startsWith(`${agentId}:${month}:`)) delete goalsFormDraft[key];
  });
}

function bindGoalsFormDraft(container, agentId, month) {
  const persistDraft = () => captureGoalsFormDraft(container, agentId, month);
  container.querySelectorAll('[data-goal-field], [data-opportunity-index], [data-commitment-label], [data-commitment-target], [data-commitment-actual]').forEach((input) => {
    input.addEventListener('input', persistDraft);
    input.addEventListener('change', persistDraft);
  });
}

function renderAgentPicker(selectedId) {
  const agents = getState().agents.ids
    .map((id) => getState().agents.byId[id])
    .filter((agent) => agent.active);

  return `
    <label class="summary-picker">
      Ver agente
      <select id="goals-agent-select">
        ${agents.map((agent) => `
          <option value="${escapeHtml(agent.id)}" ${agent.id === selectedId ? 'selected' : ''}>${escapeHtml(agent.name)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

export function renderMonthlyGoalsView(container) {
  const state = getState();
  const user = currentUser();
  const admin = isAdminUser();
  const year = state.monthlyGoals.year;
  const yearKey = String(year);
  const months = goalTrackingMonthKeys(new Date(), year);
  const selectedMonth = container.dataset.goalsMonth || months.at(-1) || 'AGO';
  const selectedId = admin
    ? (container.dataset.goalsAgentId || user?.id || state.agents.ids[0])
    : user?.id;

  if (!selectedId) {
    container.innerHTML = '<p class="empty-state">Inicia sesión para ver tus metas.</p>';
    return;
  }

  const agent = state.agents.byId[selectedId];
  const record = getAgentMonthGoals(state.monthlyGoals, year, selectedMonth, selectedId);
  const existingForm = container.querySelector('[data-goals-form="1"]');
  const sameFormContext = container.dataset.goalsRenderAgentId === selectedId
    && container.dataset.goalsRenderMonth === selectedMonth;
  if (existingForm) captureGoalsFormDraft(container, selectedId, selectedMonth);
  if (existingForm && sameFormContext && (viewHasFocusedInput(container) || goalsFormHasDraft(selectedId, selectedMonth))) {
    return;
  }
  container.dataset.goalsRenderAgentId = selectedId;
  container.dataset.goalsRenderMonth = selectedMonth;

  const monthRollup = buildPeriodRollup(
    state.agentSalesStats,
    selectedId,
    datesInMonth(selectedMonth, year),
  );
  const certActual = monthRollup.Certs || state.salesTracking.byYear[yearKey]?.[selectedMonth]?.[selectedId];
  const certActualByMonth = Object.fromEntries(
    months.map((month) => {
      const rollup = buildPeriodRollup(state.agentSalesStats, selectedId, datesInMonth(month, year));
      return [month, rollup.Certs || state.salesTracking.byYear[yearKey]?.[month]?.[selectedId]];
    }),
  );
  const annualSummary = computeAnnualGoalSummary(
    state.monthlyGoals,
    year,
    selectedId,
    months,
    certActualByMonth,
  );

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>${admin && selectedId !== user?.id ? `Metas — ${escapeHtml(agent.name)}` : 'Mis metas'}</h2>
        <p class="view-subtitle">Seguimiento mensual desde agosto. Lo medible se acumula para ver tu cumplimiento anual.</p>
      </div>
      <div class="view-actions">
        ${admin ? renderAgentPicker(selectedId) : ''}
        <label class="week-selector">
          Mes
          <select id="goals-month-select">
            ${months.map((month) => `
              <option value="${month}" ${month === selectedMonth ? 'selected' : ''}>${month}</option>
            `).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="summary-hero panel">
      <div>
        <p class="summary-hero__label">${selectedMonth} · ${year}</p>
        <p class="summary-hero__name ${CATEGORY_CLASS[agent.category] || ''}">${escapeHtml(agent.name)}</p>
      </div>
      <span class="category-pill ${CATEGORY_CLASS[agent.category]} is-active">${agent.category}</span>
    </div>

    <section class="goal-section panel">
      <div class="goal-section__head">
        <h3>Acumulado anual</h3>
        <p class="view-subtitle">Promedio de cumplimiento en los meses activos del año.</p>
      </div>
      ${renderAnnualStrip(annualSummary, months)}
    </section>

    ${months.length ? renderGoalsForm(selectedId, selectedMonth, record, certActual, admin, year, agent.name) : `
      <section class="panel">
        <p class="empty-state">Las metas mensuales inician en <strong>agosto</strong>. Ya puedes preparar metas de AGO desde ahora.</p>
      </section>
    `}
  `;

  restoreGoalsFormDraft(container, selectedId, selectedMonth);
  bindGoalsFormDraft(container, selectedId, selectedMonth);

  container.querySelector('#goals-agent-select')?.addEventListener('change', (event) => {
    container.dataset.goalsAgentId = event.target.value;
    renderMonthlyGoalsView(container);
  });

  container.querySelector('#goals-month-select')?.addEventListener('change', (event) => {
    container.dataset.goalsMonth = event.target.value;
    renderMonthlyGoalsView(container);
  });

  container.querySelector('[data-save-goals="1"]')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    const agentId = btn.dataset.agentId;
    const month = btn.dataset.month;
    const commitments = Array.from({ length: COMMITMENT_SLOTS }, (_, index) => {
      const label = container.querySelector(`[data-commitment-label="${index}"]`)?.value?.trim() || '';
      const targetRaw = container.querySelector(`[data-commitment-target="${index}"]`)?.value?.trim();
      const actualRaw = container.querySelector(`[data-commitment-actual="${index}"]`)?.value?.trim();
      const target = targetRaw === '' ? null : Number(targetRaw);
      const actual = actualRaw === '' ? null : Number(actualRaw);
      return {
        label,
        target: Number.isFinite(target) && target > 0 ? target : null,
        actual: Number.isFinite(actual) && actual >= 0 ? actual : null,
      };
    });
    const opportunities = Array.from({ length: OPPORTUNITY_SLOTS }, (_, index) => (
      container.querySelector(`[data-opportunity-index="${index}"]`)?.value?.trim() || ''
    ));
    const certRaw = container.querySelector('[data-goal-field="certGoal"]')?.value?.trim();
    const certGoal = certRaw === '' ? null : Number(certRaw);
    await saveAgentMonthGoals(agentId, month, {
      certGoal: Number.isFinite(certGoal) && certGoal > 0 ? certGoal : null,
      commitments,
      opportunities,
      records: readRecordsFromForm(container),
    });
    clearGoalsFormDraft(agentId, month);
  });

  container.querySelectorAll('[data-commitment-progress]').forEach((input) => {
    input.addEventListener('change', async () => {
      const raw = input.value.trim();
      const value = raw === '' ? null : Number(raw);
      await updateCommitmentActual(
        input.dataset.agentId,
        input.dataset.month,
        Number(input.dataset.commitmentProgress),
        Number.isFinite(value) ? value : null,
      );
    });
  });
}
