/** Navigation config — desktop tabs, mobile bottom (max 5), mobile top scroll, “Más” drawer. */

export const NAV_PAGES = {
  horario: { id: 'horario', label: 'Horario semanal', short: 'Horario', emoji: '📅' },
  resumen: { id: 'resumen', label: 'Mi horario', short: 'Mi semana', emoji: '👤' },
  solicitudes: { id: 'solicitudes', label: 'Solicitudes', short: 'Solicitudes', emoji: '📝' },
  dashboard: { id: 'dashboard', label: 'Dashboard', short: 'Dashboard', emoji: '⚙️' },
  equipo: { id: 'equipo', label: 'Equipo', short: 'Equipo', emoji: '👥' },
  forecast: { id: 'forecast', label: 'Forecast', short: 'Forecast', emoji: '📈' },
  excepciones: { id: 'excepciones', label: 'Excepciones', short: 'Excepciones', emoji: '🚫' },
  metas: { id: 'metas', label: 'Metas mensuales', short: 'Metas', emoji: '🎯' },
  seguimiento: { id: 'seguimiento', label: 'Seguimiento anual', short: 'Seguimiento', emoji: '📊' },
};

export const MORE_PAGE_IDS = ['equipo', 'forecast', 'excepciones', 'metas', 'seguimiento'];

export function isMobileLayout() {
  return window.matchMedia('(max-width: 960px)').matches;
}

export function isCompactPhone() {
  return window.matchMedia('(max-width: 480px)').matches;
}

export function desktopNavIds(isAdmin) {
  if (isAdmin) {
    return ['horario', 'resumen', 'solicitudes', 'dashboard', 'metas', 'equipo', 'forecast', 'excepciones', 'seguimiento'];
  }
  return ['horario', 'resumen', 'metas', 'solicitudes'];
}

export function mobileBottomNavIds(isAdmin) {
  if (isAdmin) {
    return ['horario', 'resumen', 'solicitudes', 'dashboard', 'more'];
  }
  return ['horario', 'resumen', 'metas', 'solicitudes'];
}

export function mobileTopNavIds(isAdmin) {
  if (isAdmin) {
    return ['horario', 'resumen', 'metas', 'solicitudes', 'dashboard', 'equipo', 'forecast', 'excepciones', 'seguimiento'];
  }
  return ['horario', 'resumen', 'metas', 'solicitudes'];
}

export function isMorePage(pageId) {
  return MORE_PAGE_IDS.includes(pageId);
}

export function bottomNavActiveId(pageId, isAdmin) {
  if (!isAdmin) return pageId;
  if (isMorePage(pageId)) return 'more';
  return pageId;
}
