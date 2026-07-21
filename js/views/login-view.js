import { getState } from '../store.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function passwordHint(agent) {
  const collab = String(agent?.collaboratorNumber || '').trim();
  return collab
    ? 'Usa tu número de colaborador'
    : '1234 si aún no tienes número asignado';
}

export function renderLoginView(container, { remembered, onSubmit }) {
  const agents = getState().agents.ids
    .map((id) => getState().agents.byId[id])
    .filter((agent) => agent.active);

  const defaultAgentId = remembered.agentId || agents[0]?.id || '';

  container.innerHTML = `
    <div class="login-layout">
      <section class="login-hero" aria-hidden="true">
        <div class="login-hero__content">
          <p class="login-hero__brand">Paradise Pass Punta Cana</p>
          <h1 class="login-hero__title">Horario semanal</h1>
          <p class="login-hero__text">Acceso operativo para agentes, supervisores y gerencia.</p>
        </div>
      </section>

      <section class="login-panel-wrap">
        <form class="login-panel" data-login-form="1">
          <div class="login-panel__brand">
            <div class="brand-mark brand-mark--lg">PP</div>
            <h2>Acceso operativo</h2>
            <p class="view-subtitle">Elige quién eres e ingresa tu clave.</p>
          </div>

          <label class="login-field">
            Agente
            <select class="field-select" name="agentId" required>
              ${agents.map((agent) => `
                <option value="${escapeHtml(agent.id)}" ${agent.id === defaultAgentId ? 'selected' : ''}>
                  ${escapeHtml(agent.name)}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="login-field">
            Contraseña
            <input
              class="field-input"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="1234 o número de colaborador"
              value="${remembered.rememberPassword ? escapeHtml(remembered.password) : ''}"
              required
            />
          </label>

          <p class="login-hint" id="login-password-hint"></p>

          <div class="login-checks">
            <label class="login-check">
              <input type="checkbox" name="rememberUser" ${remembered.rememberUser ? 'checked' : ''} />
              Recordarme
            </label>
            <label class="login-check">
              <input type="checkbox" name="rememberPassword" ${remembered.rememberPassword ? 'checked' : ''} />
              Recordar contraseña
            </label>
          </div>

          <p class="login-error hidden" data-login-error="1"></p>

          <button type="submit" class="btn-primary login-submit">Entrar</button>
        </form>
      </section>
    </div>
  `;

  const form = container.querySelector('[data-login-form="1"]');
  const agentSelect = form.querySelector('[name="agentId"]');
  const rememberPassword = form.querySelector('[name="rememberPassword"]');
  const rememberUser = form.querySelector('[name="rememberUser"]');
  const hint = form.querySelector('#login-password-hint');
  const errorEl = form.querySelector('[data-login-error="1"]');

  function updateHint() {
    const agent = getState().agents.byId[agentSelect.value];
    hint.textContent = passwordHint(agent);
  }

  updateHint();
  agentSelect.addEventListener('change', updateHint);

  rememberPassword.addEventListener('change', () => {
    if (rememberPassword.checked) rememberUser.checked = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.add('hidden');
    const data = new FormData(form);
    const result = await onSubmit({
      agentId: data.get('agentId'),
      password: data.get('password'),
      rememberUser: data.get('rememberUser') === 'on',
      rememberPassword: data.get('rememberPassword') === 'on',
    });
    if (!result?.ok) {
      errorEl.textContent = result?.message || 'No se pudo iniciar sesión.';
      errorEl.classList.remove('hidden');
    }
  });
}
