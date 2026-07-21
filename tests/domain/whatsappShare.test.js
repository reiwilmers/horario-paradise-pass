import { describe, expect, it } from 'vitest';
import { emptyWeekDays } from '../../domain/schedule.js';
import { buildWhatsAppDayText, defaultWhatsAppShareDay } from '../../domain/whatsappShare.js';

describe('whatsappShare', () => {
  const agentsById = {
    berno: { id: 'berno', name: 'Berno', active: true },
    rei: { id: 'rei', name: 'Rei', active: true },
    sebas: { id: 'sebas', name: 'Sebas', active: true },
    yohelvi: { id: 'yohelvi', name: 'Yohelvi', active: true },
    arturo: { id: 'arturo', name: 'Arturo', active: true },
    lau: { id: 'lau', name: 'Lau', active: true },
    sam: { id: 'sam', name: 'Sam', active: true },
    jc: { id: 'jc', name: 'JC', active: true },
    alexis: { id: 'alexis', name: 'Alexis', active: true },
  };

  it('builds sala and lobby sections with tags for one day', () => {
    const days = emptyWeekDays();
    days.Lunes = {
      ...days.Lunes,
      '8:50AM': ['berno', 'rei'],
      'Cierre Sala': ['sebas'],
      '7:00AM': ['yohelvi'],
      '8AM': ['arturo'],
      '9AM': ['lau'],
      'Posible Off': ['alexis'],
      'Cierre Lobby': ['sam'],
      'WBD 5:30PM': ['jc'],
    };
    const text = buildWhatsAppDayText({
      day: 'Lunes',
      schedule: { days },
      agentsById,
      morningWbdMap: { Lunes: ['arturo', 'lau'] },
      salaOpportunities: '12',
      lobbyOpportunities: '18',
    });

    expect(text).toContain('SALA  12 OPORTUNIDADES');
    expect(text).toContain('@Berno');
    expect(text).toContain('@Sebas 🔒');
    expect(text).toContain('LOBBY  18 OPORTUNIDADES');
    expect(text).toContain('@Yohelvi 7am');
    expect(text).toContain('@Arturo 📞');
    expect(text).toContain('@Lau 📞');
    expect(text).toContain('@Alexis');
    expect(text).toContain('@Sam🔒');
    expect(text).toContain('@JC 5:30 pm 📞');
  });

  it('defaults whatsapp day to tomorrow in the visible week', () => {
    const day = defaultWhatsAppShareDay('current', [
      { date: '2026-07-20' },
      { date: '2026-07-21' },
      { date: '2026-07-22' },
      { date: '2026-07-23' },
      { date: '2026-07-24' },
      { date: '2026-07-25' },
      { date: '2026-07-26' },
    ], new Date('2026-07-20T20:00:00'));
    expect(day).toBe('Martes');
  });
});
