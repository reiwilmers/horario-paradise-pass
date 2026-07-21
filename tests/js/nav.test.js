import { describe, expect, it } from 'vitest';
import {
  desktopNavIds,
  mobileBottomNavIds,
  mobileTopNavIds,
  bottomNavActiveId,
  isMorePage,
} from '../../js/nav.js';

describe('nav', () => {
  it('returns agent nav without admin pages', () => {
    expect(desktopNavIds(false)).toEqual(['horario', 'resumen', 'metas', 'solicitudes']);
    expect(mobileBottomNavIds(false)).toEqual(['horario', 'resumen', 'metas', 'solicitudes']);
  });

  it('returns admin bottom nav with more slot', () => {
    expect(mobileBottomNavIds(true)).toEqual(['horario', 'resumen', 'solicitudes', 'dashboard', 'more']);
  });

  it('maps secondary admin pages to more tab', () => {
    expect(isMorePage('equipo')).toBe(true);
    expect(bottomNavActiveId('forecast', true)).toBe('more');
    expect(bottomNavActiveId('dashboard', true)).toBe('dashboard');
  });

  it('includes all admin pages in desktop and top nav', () => {
    const desktop = desktopNavIds(true);
    expect(desktop).toContain('seguimiento');
    expect(desktop).toContain('metas');
    expect(mobileTopNavIds(true).length).toBeGreaterThan(5);
  });

  it('keeps metas in admin more drawer on mobile bottom nav', () => {
    expect(isMorePage('metas')).toBe(true);
    expect(mobileBottomNavIds(true)).not.toContain('metas');
  });
});
