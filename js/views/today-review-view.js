import { buildTodayReview } from '../../domain/todayReview.js';
import { getState } from '../store.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSummaryChip(label, count, tone = 'warn') {
  if (!count) return '';
  return `
    <span class="review-summary__chip review-summary__chip--${tone}">
      <strong>${count}</strong> ${escapeHtml(label)}
    </span>
  `;
}

function renderSection(title, count, body, emptyText) {
  if (!title) return '';
  return `
    <section class="review-section panel">
      <div class="review-section__head">
        <h3>${escapeHtml(title)}</h3>
        ${count ? `<span class="review-section__count">${count}</span>` : ''}
      </div>
      ${count ? body : `<p class="review-section__empty">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
}

function bindNavigation(container, onNavigate) {
  if (!onNavigate) return;
  container.querySelectorAll('[data-nav-page]').forEach((button) => {
    button.addEventListener('click', () => {
      onNavigate(button.dataset.navPage);
    });
  });
}

export function renderTodayReviewView(container, onNavigate) {
  const review = buildTodayReview(getState());
  const { summary, scheduleMeta } = review;

  const chips = [
    renderSummaryChip('solicitudes', summary.pendingRequests),
    renderSummaryChip('planificación', summary.workflowUrgent),
    renderSummaryChip('sin asignar', summary.unassignedAgents),
    renderSummaryChip('vacaciones', summary.upcomingVacations),
    renderSummaryChip('metas', summary.goalsIncomplete),
  ].filter(Boolean).join('');

  const pendingBody = `
    <ul class="review-list">
      ${review.pendingRequests.map((item) => `
        <li>
          <button type="button" class="review-item" data-nav-page="${escapeHtml(item.navPage)}">
            <span class="review-item__main">
              <strong>${escapeHtml(item.agentName)}</strong>
              <span>${escapeHtml(item.type)}</span>
            </span>
            <span class="review-item__meta">
              <span class="status-pill status-pill--pending">${escapeHtml(item.status)}</span>
              <span>${escapeHtml(item.dateLabel)}</span>
            </span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  const workflowBody = `
    <ul class="review-list">
      ${review.workflowReminders.map((item) => `
        <li>
          <button type="button" class="review-item ${item.urgent ? 'review-item--warn' : 'review-item--ok'}" data-nav-page="${escapeHtml(item.navPage)}">
            <span class="review-item__main">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.subtitle)}</span>
            </span>
            ${item.complete ? '<span class="review-item__tag review-item__tag--ok">Listo</span>' : '<span class="review-item__tag">Pendiente</span>'}
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  const unassignedBody = `
    <ul class="review-list">
      ${review.unassigned.map((group) => `
        <li>
          <button type="button" class="review-item review-item--warn" data-nav-page="${escapeHtml(group.navPage)}">
            <span class="review-item__main">
              <strong>${escapeHtml(group.dayLabel)}</strong>
              <span>Próxima semana</span>
            </span>
            <span class="review-item__meta review-item__meta--names">${escapeHtml(group.agents.join(', '))}</span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  const vacationsBody = `
    <ul class="review-list">
      ${review.upcomingVacations.map((item) => `
        <li>
          <button type="button" class="review-item" data-nav-page="${escapeHtml(item.navPage)}">
            <span class="review-item__main">
              <strong>${escapeHtml(item.agentName)}</strong>
              <span>${escapeHtml(item.fromLabel)} → ${escapeHtml(item.untilLabel)}</span>
            </span>
            <span class="review-item__meta">
              <span class="review-item__tag">${escapeHtml(item.startsLabel)}</span>
            </span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  const goalsBody = `
    <ul class="review-list">
      ${review.goalsIncomplete.map((item) => `
        <li>
          <button type="button" class="review-item" data-nav-page="${escapeHtml(item.navPage)}">
            <span class="review-item__main">
              <strong>${escapeHtml(item.agentName)}</strong>
              <span>${escapeHtml(item.month)} · ${escapeHtml(item.reasons.join(' · '))}</span>
            </span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  const scheduleSection = scheduleMeta.showWorkflow
    ? renderSection(
      scheduleMeta.workflowTitle,
      review.workflowReminders.length,
      workflowBody,
      'Sin tareas de planificación hoy.',
    )
    : scheduleMeta.showUnassigned
      ? renderSection(
        scheduleMeta.unassignedTitle,
        review.unassigned.length,
        unassignedBody,
        'Todos tienen posición en la próxima semana.',
      )
      : (scheduleMeta.quietNote ? `
        <section class="review-section panel">
          <p class="review-section__empty">${escapeHtml(scheduleMeta.quietNote)}</p>
        </section>
      ` : '');

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Qué revisar hoy</h2>
        <p class="view-subtitle">${escapeHtml(review.dateLabel)} · Pendientes operativos del día</p>
      </div>
    </div>

    ${review.allClear ? `
      <section class="review-hero review-hero--ok panel">
        <p class="review-hero__title">Todo al día</p>
        <p class="review-hero__text">No hay solicitudes abiertas, tareas de planificación urgentes, huecos en el horario, vacaciones próximas ni metas incompletas.</p>
      </section>
    ` : `
      <section class="review-hero review-hero--warn panel">
        <p class="review-hero__title">${summary.total} pendiente${summary.total === 1 ? '' : 's'}</p>
        <div class="review-summary">${chips}</div>
      </section>
    `}

    ${renderSection(
      'Solicitudes por aprobar',
      summary.pendingRequests,
      pendingBody,
      'Sin solicitudes pendientes.',
    )}

    ${scheduleSection}

    ${renderSection(
      'Vacaciones en los próximos 7 días',
      summary.upcomingVacations,
      vacationsBody,
      'Nadie entra en vacaciones esta semana.',
    )}

    ${renderSection(
      review.goalMonth ? `Metas ${review.goalMonth} incompletas` : 'Metas del mes',
      summary.goalsIncomplete,
      goalsBody,
      review.goalMonth
        ? 'Todas las metas del mes tienen meta de certificados y avances registrados.'
        : 'El seguimiento de metas inicia en agosto.',
    )}
  `;

  bindNavigation(container, onNavigate);
}
