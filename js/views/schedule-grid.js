import { DAYS } from '../../domain/constants.js';
import {
  SCHEDULE_ROWS,
  isGeneralClose,
} from '../../domain/blocks.js';
import { getState, activeAgents } from '../store.js';
import {
  placeAgent,
  removeAgent,
  moveAgent,
  startDrag,
  endDrag,
} from '../actions/schedule.js';
import {
  isMorningWbd,
  showMorningWbdToggle,
  toggleMorningWbd,
} from '../actions/wbd.js';

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

function renderAgentChip(agent, { day, block, weekKey, canEdit, morningWbd }) {
  const wbdToggle = canEdit && showMorningWbdToggle(block) && agent.morningWbdEligible;
  return `
    <div
      class="agent-chip ${canEdit ? 'is-draggable' : ''}"
      draggable="${canEdit ? 'true' : 'false'}"
      data-agent-id="${escapeHtml(agent.id)}"
      data-day="${escapeHtml(day)}"
      data-block="${escapeHtml(block)}"
      data-week="${escapeHtml(weekKey)}"
    >
      <span class="agent-chip__name">${escapeHtml(agent.name)}</span>
      ${morningWbd ? '<span class="wbd-badge">WBD</span>' : ''}
      ${wbdToggle ? `
        <label class="wbd-toggle" title="WBD ${escapeHtml(agent.name)}">
          <input type="checkbox" data-wbd-toggle="1" data-day="${escapeHtml(day)}" data-agent-id="${escapeHtml(agent.id)}" ${morningWbd ? 'checked' : ''} />
          WBD
        </label>` : ''}
      ${canEdit ? `<button type="button" class="agent-chip__remove" data-remove="1" aria-label="Quitar">×</button>` : ''}
    </div>
  `;
}

function renderCell(day, row, weekKey, canEdit) {
  const state = getState();
  const schedule = state.schedules[weekKey];
  const agentsById = state.agents.byId;
  const morningWbdIds = new Set(state.morningWbdMap[day] || []);
  const block = row.key;
  const agents = (schedule.days[day]?.[block] || []).filter((id) => agentsById[id]?.active);
  const emptySlots = Math.max(0, row.capacity - agents.length);
  const general = isGeneralClose(day, block);
  const tone = general ? 'general' : row.tone;

  const agentHtml = agents.map((agentId) => {
    const agent = agentsById[agentId];
    if (!agent) return '';
    return renderAgentChip(agent, {
      day,
      block,
      weekKey,
      canEdit,
      morningWbd: morningWbdIds.has(agentId) && showMorningWbdToggle(block),
    });
  }).join('');

  const emptyHtml = Array.from({ length: emptySlots }).map(() => (
    '<div class="empty-slot">Espacio libre</div>'
  )).join('');

  const addHtml = canEdit ? `
    <div class="add-agent-control">
      <select class="add-agent-select" data-add-select="1" data-day="${escapeHtml(day)}" data-block="${escapeHtml(block)}" aria-label="Agregar agente">
        ${activeAgents().map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`).join('')}
      </select>
      <button type="button" class="btn-add" data-add-btn="1" data-week="${escapeHtml(weekKey)}" data-day="${escapeHtml(day)}" data-block="${escapeHtml(block)}" title="Agregar">+</button>
    </div>
  ` : '';

  return `
    <div
      class="schedule-cell tone-${tone}"
      data-drop-cell="1"
      data-day="${escapeHtml(day)}"
      data-block="${escapeHtml(block)}"
      data-week="${escapeHtml(weekKey)}"
    >
      <div class="schedule-cell__inner">
        ${general ? '<span class="general-tag">General</span>' : ''}
        ${agentHtml}
        ${emptyHtml}
        ${addHtml}
      </div>
    </div>
  `;
}

export function renderScheduleGrid({ weekKey, headers, canEdit = false, title = '' }) {
  const headerCells = DAYS.map((day, index) => (
    `<div class="schedule-grid__head-cell">${escapeHtml(headers[index] || day)}</div>`
  )).join('');

  const rows = SCHEDULE_ROWS.map((row) => {
    if (row.type === 'section') {
      return `
        <div class="schedule-grid__row schedule-grid__row--section tone-${row.tone}">
          <div class="schedule-grid__label">${escapeHtml(row.label)}</div>
          ${DAYS.map(() => '<div class="schedule-grid__section-spacer"></div>').join('')}
        </div>
      `;
    }
    const label = `
      <div class="schedule-grid__label tone-${row.tone}">
        ${row.section ? `<span class="schedule-grid__section">${escapeHtml(row.section)}</span>` : ''}
        <span class="schedule-grid__block">${escapeHtml(row.label)}</span>
        ${row.visualTime ? `<span class="schedule-grid__meta">Hora visual: ${escapeHtml(row.visualTime)}</span>` : ''}
        <span class="schedule-grid__meta">${row.capacity} espacios</span>
      </div>
    `;
    const cells = DAYS.map((day) => renderCell(day, row, weekKey, canEdit)).join('');
    return `<div class="schedule-grid__row">${label}${cells}</div>`;
  }).join('');

  return `
    <section class="schedule-panel">
      ${title ? `<h2 class="schedule-panel__title">${escapeHtml(title)}</h2>` : ''}
      <div class="schedule-scroll">
        <div class="schedule-grid">
          <div class="schedule-grid__head">
            <div class="schedule-grid__head-label">Area / horario</div>
            ${headerCells}
          </div>
          ${rows}
        </div>
      </div>
    </section>
  `;
}

export function bindScheduleGrid(root, { canEdit = false } = {}) {
  if (!root) return;

  root.querySelectorAll('[data-remove="1"]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const chip = btn.closest('.agent-chip');
      if (!chip) return;
      await removeAgent(
        chip.dataset.week,
        chip.dataset.day,
        chip.dataset.block,
        chip.dataset.agentId,
      );
    });
  });

  root.querySelectorAll('[data-add-btn="1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const select = root.querySelector(
        `[data-add-select="1"][data-day="${btn.dataset.day}"][data-block="${btn.dataset.block}"]`,
      );
      if (!select?.value) return;
      await placeAgent(btn.dataset.week, btn.dataset.day, btn.dataset.block, select.value);
    });
  });

  root.querySelectorAll('[data-wbd-toggle="1"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const weekKey = getState().visibleWeek;
      const ok = await toggleMorningWbd(input.dataset.day, input.dataset.agentId, input.checked, weekKey);
      if (!ok?.ok) input.checked = !input.checked;
    });
  });

  if (!canEdit) return;

  root.querySelectorAll('.agent-chip.is-draggable').forEach((chip) => {
    chip.addEventListener('dragstart', (event) => {
      startDrag(chip.dataset.week, chip.dataset.day, chip.dataset.block, chip.dataset.agentId);
      event.dataTransfer?.setData('text/plain', chip.dataset.agentId);
    });
    chip.addEventListener('dragend', () => endDrag());
  });

  root.querySelectorAll('[data-drop-cell="1"]').forEach((cell) => {
    cell.addEventListener('dragover', (event) => {
      event.preventDefault();
      cell.classList.add('is-drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('is-drag-over'));
    cell.addEventListener('drop', async (event) => {
      event.preventDefault();
      cell.classList.remove('is-drag-over');
      const dragged = getState().ui.dragged;
      await moveAgent(cell.dataset.week, cell.dataset.day, cell.dataset.block, dragged);
    });
  });
}

export { CATEGORY_CLASS };
