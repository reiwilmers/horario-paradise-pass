import { getState, isAdminUser } from '../store.js';
import { visibleExceptions, saveManualException, deactivateException } from '../actions/exceptions.js';
import { syncApprovedPipeline } from '../actions/approved.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderExcepcionesView(container) {
  const admin = isAdminUser();
  const exceptions = visibleExceptions();
  const agentsById = getState().agents.byId;

  if (!admin) {
    container.innerHTML = `
      <div class="view-header">
        <h2>Excepciones</h2>
        <p class="view-subtitle">Solo SUP/GTE pueden ver y editar excepciones operativas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Excepciones</h2>
        <p class="view-subtitle">Reglas temporales que afectan generador y dashboard. Mes en curso.</p>
      </div>
      <button type="button" class="btn-secondary" data-resync-approved="1">Reaplicar aprobadas</button>
    </div>

    <form class="request-form panel" data-exception-form="1">
      <h3>Nueva excepción manual</h3>
      <div class="request-form__grid">
        <label>Agente
          <select class="field-select" name="agentId" required>
            ${getState().agents.ids.map((id) => {
    const agent = agentsById[id];
    return `<option value="${escapeHtml(id)}">${escapeHtml(agent.name)} (${agent.category})</option>`;
  }).join('')}
          </select>
        </label>
        <label>Tipo
          <select class="field-select" name="type" required>
            <option value="OFF_SOLICITADO">Off solicitado</option>
            <option value="POSIBLE_OFF_SOLICITADO">Posible off</option>
            <option value="VACACIONES">Vacaciones</option>
            <option value="PERMISO">Permiso</option>
          </select>
        </label>
        <label>Desde<input class="field-input" type="date" name="from" required /></label>
        <label>Hasta<input class="field-input" type="date" name="until" /></label>
        <label class="request-form__full">Detalle<input class="field-input" name="detail" placeholder="Detalle operativo" /></label>
      </div>
      <button type="submit" class="btn-primary">Guardar excepción</button>
    </form>

    <div class="panel">
      <h3>Activas (${exceptions.filter((e) => e.active !== false).length})</h3>
      <table class="simple-table request-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Tipo</th>
            <th>Rango</th>
            <th>Detalle</th>
            <th>Estado</th>
            <th>Origen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${exceptions.length ? exceptions.map((exception) => {
    const agent = agentsById[exception.agentId];
    return `
            <tr>
              <td>${escapeHtml(agent?.name || exception.agentId)}</td>
              <td>${escapeHtml(exception.type)}</td>
              <td>${escapeHtml(exception.from)} — ${escapeHtml(exception.until || exception.from)}</td>
              <td>${escapeHtml(exception.detail || '—')}</td>
              <td>${escapeHtml(exception.status)}</td>
              <td>${exception.createdFromRequest ? 'Solicitud' : 'Manual'}</td>
              <td>
                ${exception.active !== false ? `<button type="button" class="btn-small btn-small--bad" data-deactivate="${escapeHtml(exception.id)}">Desactivar</button>` : '—'}
              </td>
            </tr>
          `;
  }).join('') : '<tr><td colspan="7">Sin excepciones este mes.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  bindExcepcionesView(container);
}

function bindExcepcionesView(container) {
  container.querySelector('[data-exception-form="1"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await saveManualException({
      agentId: data.get('agentId'),
      type: data.get('type'),
      from: data.get('from'),
      until: data.get('until') || data.get('from'),
      detail: data.get('detail'),
      status: 'Activa',
      active: true,
    });
    await syncApprovedPipeline();
    event.currentTarget.reset();
  });

  container.querySelector('[data-resync-approved="1"]')?.addEventListener('click', async () => {
    await syncApprovedPipeline();
  });

  container.querySelectorAll('[data-deactivate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deactivateException(btn.dataset.deactivate);
      await syncApprovedPipeline();
    });
  });
}
