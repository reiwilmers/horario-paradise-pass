import { REQUEST_TYPES } from '../../domain/constants.js';
import { normalizeRequestDateRange } from '../../domain/requests.js';
import { getState, currentUser, isAdminUser } from '../store.js';
import { createRequest, visibleRequests, updateRequestStatus } from '../actions/requests.js';

/** @type {{ type?: string, from?: string, until?: string, reason?: string } | null} */
let requestFormDraft = null;

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

function readRequestFormDraft(form) {
  if (!form) return null;
  const data = new FormData(form);
  return {
    type: String(data.get('type') || ''),
    from: String(data.get('from') || ''),
    until: String(data.get('until') || ''),
    reason: String(data.get('reason') || ''),
  };
}

function hasRequestFormDraft(draft) {
  if (!draft) return false;
  return Boolean(draft.from || draft.until || draft.reason);
}

function applyRequestFormDraft(form, draft) {
  if (!form || !draft) return;
  const typeEl = form.querySelector('[name="type"]');
  const fromEl = form.querySelector('[name="from"]');
  const untilEl = form.querySelector('[name="until"]');
  const reasonEl = form.querySelector('[name="reason"]');
  if (typeEl && draft.type) typeEl.value = draft.type;
  if (fromEl && draft.from) fromEl.value = draft.from;
  if (untilEl && draft.until) untilEl.value = draft.until;
  if (reasonEl && draft.reason) reasonEl.value = draft.reason;
  syncRequestDateInputs(form);
}

function syncRequestDateInputs(form) {
  const fromEl = form.querySelector('[name="from"]');
  const untilEl = form.querySelector('[name="until"]');
  if (!fromEl || !untilEl) return;

  const from = fromEl.value;
  if (from) {
    untilEl.min = from;
    if (untilEl.value && untilEl.value < from) untilEl.value = from;
  } else {
    untilEl.removeAttribute('min');
  }
}

function isRequestFormBusy(container) {
  const form = container.querySelector('[data-request-form="1"]');
  if (!form) return false;
  const activeEl = document.activeElement;
  if (activeEl && form.contains(activeEl)) return true;
  return hasRequestFormDraft(requestFormDraft);
}

function renderRequestRows(requests, agentsById, admin) {
  return requests.length ? requests.map((request) => {
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
  }).join('') : `<tr><td colspan="${admin ? 6 : 5}">Sin solicitudes este mes.</td></tr>`;
}

function renderRequestInboxPanel(requests, agentsById, admin) {
  return `
    <div class="panel" data-request-inbox="1">
      <h3>Bandeja (${requests.length})</h3>
      <div class="table-wrap">
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
        <tbody data-request-inbox-body="1">
          ${renderRequestRows(requests, agentsById, admin)}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function updateRequestInbox(container, requests, agentsById, admin) {
  const panel = container.querySelector('[data-request-inbox="1"]');
  if (!panel) return;
  const heading = panel.querySelector('h3');
  if (heading) heading.textContent = `Bandeja (${requests.length})`;
  const body = panel.querySelector('[data-request-inbox-body="1"]');
  if (body) body.innerHTML = renderRequestRows(requests, agentsById, admin);
  bindRequestInboxActions(container);
}

export function renderSolicitudesView(container) {
  const user = currentUser();
  const admin = isAdminUser();
  const requests = visibleRequests();
  const agentsById = getState().agents.byId;
  const existingForm = container.querySelector('[data-request-form="1"]');

  if (existingForm) {
    requestFormDraft = readRequestFormDraft(existingForm);
  }

  if (isRequestFormBusy(container)) {
    updateRequestInbox(container, requests, agentsById, admin);
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Solicitudes</h2>
        <p class="view-subtitle">${admin ? 'Pendientes siempre visibles. Aprueba o rechaza solicitudes de cualquier mes.' : 'Tus solicitudes pendientes y las del mes en curso.'}</p>
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
      <p class="empty-state">Selecciona tu usuario arriba para crear solicitudes.</p>
    `}

    ${renderRequestInboxPanel(requests, agentsById, admin)}
  `;

  const form = container.querySelector('[data-request-form="1"]');
  applyRequestFormDraft(form, requestFormDraft);
  bindSolicitudesView(container);
}

function bindRequestInboxActions(container) {
  container.querySelectorAll('[data-approve]').forEach((btn) => {
    if (btn.dataset.boundApprove) return;
    btn.dataset.boundApprove = '1';
    btn.addEventListener('click', async () => {
      await updateRequestStatus(btn.dataset.approve, 'Aprobada');
    });
  });

  container.querySelectorAll('[data-reject]').forEach((btn) => {
    if (btn.dataset.boundReject) return;
    btn.dataset.boundReject = '1';
    btn.addEventListener('click', async () => {
      await updateRequestStatus(btn.dataset.reject, 'Rechazada');
    });
  });
}

function bindSolicitudesView(container) {
  const form = container.querySelector('[data-request-form="1"]');
  if (form) {
    const persistDraft = () => {
      requestFormDraft = readRequestFormDraft(form);
    };

    form.addEventListener('input', persistDraft);
    form.addEventListener('change', persistDraft);

    const fromEl = form.querySelector('[name="from"]');
    const untilEl = form.querySelector('[name="until"]');
    fromEl?.addEventListener('change', () => {
      syncRequestDateInputs(form);
      persistDraft();
    });
    untilEl?.addEventListener('change', () => {
      if (fromEl?.value && untilEl.value && untilEl.value < fromEl.value) {
        untilEl.value = fromEl.value;
      }
      persistDraft();
    });
    syncRequestDateInputs(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const dates = normalizeRequestDateRange(data.get('from'), data.get('until'));
      await createRequest({
        type: data.get('type'),
        from: dates.from,
        until: dates.until,
        date: dates.from,
        reason: data.get('reason'),
      });
      requestFormDraft = null;
      form.reset();
      untilEl?.removeAttribute('min');
    });
  }

  bindRequestInboxActions(container);
}
