import { CATEGORIES, DAYS, PRIORITY_AREAS } from '../../domain/constants.js';
import { countSpecialRules, ruleSummary } from '../../domain/agents.js';
import { getState } from '../store.js';
import {
  saveAgent,
  setAgentCategory,
  setAgentRules,
  setAgentCollaboratorNumber,
  setAgentActive,
  setAgentWbdFlags,
} from '../actions/agents.js';

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

function renderCategoryPills(agentId, current) {
  return CATEGORIES.map((category) => `
    <button
      type="button"
      class="category-pill ${CATEGORY_CLASS[category]} ${category === current ? 'is-active' : ''}"
      data-category-pill="1"
      data-agent-id="${escapeHtml(agentId)}"
      data-category="${category}"
    >${category}</button>
  `).join('');
}

function renderDayMulti(name, agentId, field, selected = []) {
  return `
    <select multiple class="field-select field-select--multi" data-rule-multi="1" data-agent-id="${escapeHtml(agentId)}" data-field="${field}" aria-label="${escapeHtml(name)}">
      ${DAYS.map((day) => `<option value="${day}" ${selected.includes(day) ? 'selected' : ''}>${day}</option>`).join('')}
    </select>
  `;
}

function renderAgentOptions(agentId, field, selectedId = '') {
  const agents = getState().agents.ids
    .map((id) => getState().agents.byId[id])
    .filter((agent) => agent.id !== agentId);
  return `
    <select class="field-select" data-rule-select="1" data-agent-id="${escapeHtml(agentId)}" data-field="${field}">
      <option value="">— Ninguno —</option>
      ${agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedId ? 'selected' : ''}>${escapeHtml(agent.name)}</option>`).join('')}
    </select>
  `;
}

function renderCannotShareMulti(agentId, selected = []) {
  const agents = getState().agents.ids
    .map((id) => getState().agents.byId[id])
    .filter((agent) => agent.id !== agentId);
  return `
    <select multiple class="field-select field-select--multi" data-rule-multi="1" data-agent-id="${escapeHtml(agentId)}" data-field="cannotShareAreaWith">
      ${agents.map((agent) => `<option value="${agent.id}" ${selected.includes(agent.id) ? 'selected' : ''}>${escapeHtml(agent.name)}</option>`).join('')}
    </select>
  `;
}

function renderAgentCard(agent) {
  const rules = agent.rules || {};
  const specialCount = countSpecialRules(agent);
  return `
    <article class="team-card ${agent.active ? '' : 'team-card--inactive'}" data-agent-card="${agent.id}">
      <header class="team-card__head">
        <div>
          <h3 class="team-card__name">${escapeHtml(agent.name)}</h3>
          <p class="team-card__meta">#${escapeHtml(agent.collaboratorNumber || 'sin número')}</p>
        </div>
        <label class="team-toggle">
          <input type="checkbox" data-active-toggle="1" data-agent-id="${agent.id}" ${agent.active ? 'checked' : ''} />
          Activo
        </label>
      </header>

      <div class="team-card__section">
        <p class="team-card__label">Categoría</p>
        <div class="category-pills">${renderCategoryPills(agent.id, agent.category)}</div>
      </div>

      <div class="team-card__section team-card__wbd">
        <label class="team-toggle">
          <input type="checkbox" data-wbd-flag="morningWbdEligible" data-agent-id="${agent.id}" ${agent.morningWbdEligible ? 'checked' : ''} />
          WBD mañana (7/8/9AM)
        </label>
        <label class="team-toggle">
          <input type="checkbox" data-wbd-flag="eveningWbdEligible" data-agent-id="${agent.id}" ${agent.eveningWbdEligible ? 'checked' : ''} />
          WBD 5:30PM
        </label>
      </div>

      <div class="team-card__section">
        <label class="team-card__label" for="collab-${agent.id}">Número colaborador</label>
        <input id="collab-${agent.id}" class="field-input" data-collab-input="1" data-agent-id="${agent.id}" value="${escapeHtml(agent.collaboratorNumber || '')}" placeholder="Ej. 1001" />
      </div>

      <details class="team-rules" ${specialCount ? 'open' : ''}>
        <summary>
          Reglas especiales
          <span class="team-rules__badge">${escapeHtml(ruleSummary(agent))}</span>
        </summary>
        <div class="team-rules__grid">
          <label>Prioridad
            <select class="field-select" data-rule-select="1" data-agent-id="${agent.id}" data-field="priorityArea">
              ${PRIORITY_AREAS.map((area) => `<option value="${area}" ${rules.priorityArea === area ? 'selected' : ''}>${area}</option>`).join('')}
            </select>
          </label>
          <label>Máx. sala / semana
            <input class="field-input" type="number" min="0" data-rule-number="1" data-agent-id="${agent.id}" data-field="maxSalaPerWeek" value="${rules.maxSalaPerWeek ?? ''}" placeholder="—" />
          </label>
          <label>Máx. lobby / semana
            <input class="field-input" type="number" min="0" data-rule-number="1" data-agent-id="${agent.id}" data-field="maxLobbyPerWeek" value="${rules.maxLobbyPerWeek ?? ''}" placeholder="—" />
          </label>
          <label class="team-check"><input type="checkbox" data-rule-check="1" data-agent-id="${agent.id}" data-field="lobbyWeekdaysOnly9AM" ${rules.lobbyWeekdaysOnly9AM ? 'checked' : ''} /> Lobby L–V solo 9AM</label>
          <label class="team-check"><input type="checkbox" data-rule-check="1" data-agent-id="${agent.id}" data-field="noOpening7Weekdays" ${rules.noOpening7Weekdays ? 'checked' : ''} /> No abrir 7:00 L–V</label>
          <label class="team-check"><input type="checkbox" data-rule-check="1" data-agent-id="${agent.id}" data-field="noLobbyCloseWeekdays" ${rules.noLobbyCloseWeekdays ? 'checked' : ''} /> No cierre lobby L–V</label>
          <label class="team-check"><input type="checkbox" data-rule-check="1" data-agent-id="${agent.id}" data-field="brazilMarket" ${rules.brazilMarket ? 'checked' : ''} /> Mercado Brasil</label>
          <label>Pareja Brasil ${renderAgentOptions(agent.id, 'brazilPairId', rules.brazilPairId || '')}</label>
          <label>Off fijos ${renderDayMulti('Off fijos', agent.id, 'fixedOffDays', rules.fixedOffDays || [])}</label>
          <label>Posible Off fijos ${renderDayMulti('Posible Off fijos', agent.id, 'fixedPossibleOffDays', rules.fixedPossibleOffDays || [])}</label>
          <label>No compartir área con ${renderCannotShareMulti(agent.id, rules.cannotShareAreaWith || [])}</label>
        </div>
      </details>
    </article>
  `;
}

export function renderEquipoView(container) {
  const state = getState();
  const agents = state.agents.ids.map((id) => state.agents.byId[id]);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Equipo</h2>
        <p class="view-subtitle">Cambia categoría con un clic. WBD y reglas especiales se guardan al instante.</p>
      </div>
    </div>
    <div class="team-grid">
      ${agents.map((agent) => renderAgentCard(agent)).join('')}
    </div>
  `;

  bindEquipoView(container);
}

function bindEquipoView(container) {
  container.querySelectorAll('[data-category-pill="1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('is-active')) return;
      await setAgentCategory(btn.dataset.agentId, btn.dataset.category);
    });
  });

  container.querySelectorAll('[data-wbd-flag]').forEach((input) => {
    input.addEventListener('change', async () => {
      await setAgentWbdFlags(input.dataset.agentId, {
        [input.dataset.wbdFlag]: input.checked,
      });
    });
  });

  container.querySelectorAll('[data-active-toggle="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      await setAgentActive(input.dataset.agentId, input.checked);
    });
  });

  container.querySelectorAll('[data-collab-input="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      await setAgentCollaboratorNumber(input.dataset.agentId, input.value);
    });
  });

  container.querySelectorAll('[data-rule-select="1"]').forEach((select) => {
    select.addEventListener('change', async () => {
      const value = select.dataset.field === 'brazilPairId'
        ? (select.value || null)
        : select.value;
      await setAgentRules(select.dataset.agentId, { [select.dataset.field]: value });
    });
  });

  container.querySelectorAll('[data-rule-check="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      await setAgentRules(input.dataset.agentId, { [input.dataset.field]: input.checked });
    });
  });

  container.querySelectorAll('[data-rule-number="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const raw = input.value.trim();
      const value = raw === '' ? null : Number(raw);
      await setAgentRules(input.dataset.agentId, { [input.dataset.field]: Number.isFinite(value) ? value : null });
    });
  });

  container.querySelectorAll('[data-rule-multi="1"]').forEach((select) => {
    select.addEventListener('change', async () => {
      const values = [...select.selectedOptions].map((option) => option.value);
      await setAgentRules(select.dataset.agentId, { [select.dataset.field]: values });
    });
  });
}

export { CATEGORY_CLASS };
