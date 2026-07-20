import { REQUEST_TYPES } from '../../domain/constants.js';
import { getState, currentUser, isAdminUser } from '../store.js';
import { createRequest, visibleRequests, updateRequestStatus } from '../actions/requests.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusClass(status = '') {
  const value = status.toLowerCase();
  if (value.includes('aprob')) return 'status-pill status-pill--ok';
  if (value.includes('rechaz')) return 'status-pill status-pill--bad';
  if (value.includes('fuera')) return 'status-pill status-pill--warn';
  return 'status-pill status-pill--pending';
}

export function renderSolicitudesView(container) {
  const user = currentUser();
  const admin = isAdminUser();
  const requests = visibleRequests();
  const agentsById = getState().agents.byId;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Solicitudes</h2>
        <p class="view-subtitle">${admin ? 'Bandeja del mes en curso. Aprueba o rechaza solicitudes.' : 'Tus solicitudes del mes en curso.'}</p>
      </div>
    </div>

    ${user ? `
      <form class="request-form panel" data-request-form="1">
        <h3>Nueva solicitud</h3>
        <div class="request-form__grid">
          <label>Tipo
            <select class="field-select" name="type" required>
              ${REQUEST_TYPES.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}
            </select>
          </label>
          <label>Desde
            <input class="field-input" type="date" name="from" required />
          </label>
          <label>Hasta
            <input class="field-input" type="date" name="until" />
          </label>
          <label class="request-form__full">Motivo
            <input class="field-input" name="reason" placeholder="Motivo operativo" required />
          </label>
        </div>
        <button type="submit" class="btn-primary">Enviar solicitud</button>
      </form>
    ` : `
      <p class="view-subtitle">Selecciona tu usuario en la barra lateral para crear solicitudes.</p>
    `}

    <div class="panel">
      <h3>Bandeja (${requests.length})</h3>
      <table class="simple-table request-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Tipo</th>
            <th>Fechas</th>
            <th>Motivo</th>
            <th>Estado</th>
            ${admin ? '<th>Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${requests.length ? requests.map((request) => {
    const agent = agentsById[request.applicantId];
    return `
            <tr data-request-id="${escapeHtml(request.id)}">
              <td>${escapeHtml(agent?.name || request.applicantId)}</td>
              <td>${escapeHtml(request.type)}</td>
              <td>${escapeHtml(request.from)}${request.until && request.until !== request.from ? ` — ${escapeHtml(request.until)}` : ''}</td>
              <td>${escapeHtml(request.reason || '—')}</td>
              <td><span class="${statusClass(request.status)}">${escapeHtml(request.status)}</span></td>
              ${admin ? `
                <td class="request-actions">
                  ${request.status === 'Pendiente' || request.status === 'Fuera de tiempo' ? `
                    <button type="button" class="btn-small btn-small--ok" data-approve="${escapeHtml(request.id)}">Aprobar</button>
                    <button type="button" class="btn-small btn-small--bad" data-reject="${escapeHtml(request.id)}">Rechazar</button>
                  ` : '—'}
                </td>
              ` : ''}
            </tr>
          `;
  }).join('') : '<tr><td colspan="6">Sin solicitudes este mes.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  bindSolicitudesView(container);
}

function bindSolicitudesView(container) {
  container.querySelector('[data-request-form="1"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await createRequest({
      type: data.get('type'),
      from: data.get('from'),
      until: data.get('until') || data.get('from'),
      date: data.get('from'),
      reason: data.get('reason'),
    });
    form.reset();
  });

  container.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await updateRequestStatus(btn.dataset.approve, 'Aprobada');
    });
  });

  container.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await updateRequestStatus(btn.dataset.reject, 'Rechazada');
    });
  });
}
