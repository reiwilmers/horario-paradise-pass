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
import { getState, currentUser, isAdminUser } from '../store.js';
import { saveAgentMonthGoals, updateCommitmentActual } from '../actions/monthlyGoals.js';

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

function renderGoalsForm(agentId, month, record, certActual, canEditGoals) {
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
      <div class="goal-actions">
        <button type="button" class="btn-primary" data-save-goals="1" data-agent-id="${escapeHtml(agentId)}" data-month="${escapeHtml(month)}">
          Guardar metas del mes
        </button>
      </div>
    ` : ''}
  `;
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
  const certActual = state.salesTracking.byYear[yearKey]?.[selectedMonth]?.[selectedId];
  const certActualByMonth = Object.fromEntries(
    months.map((month) => [month, state.salesTracking.byYear[yearKey]?.[month]?.[selectedId]]),
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

    ${months.length ? renderGoalsForm(selectedId, selectedMonth, record, certActual, admin) : `
      <section class="panel">
        <p class="empty-state">Las metas mensuales inician en <strong>agosto</strong>. Ya puedes preparar metas de AGO desde ahora.</p>
      </section>
    `}
  `;

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
    });
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
