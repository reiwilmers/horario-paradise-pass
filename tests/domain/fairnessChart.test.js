import { describe, expect, it } from 'vitest';
import {
  computeFairnessChart,
  fairnessDeviationThreshold,
  fairnessTone,
  formatFairnessDelta,
} from '../../domain/fairnessChart.js';

describe('fairnessChart domain', () => {
  const monthRows = [
    { agentId: 'a', agent: { name: 'Ana', category: 'MA' }, sala: 10, lobby: 4, off: 2, vacation: 0, assignedDays: 16 },
    { agentId: 'b', agent: { name: 'Berno', category: 'TOP' }, sala: 6, lobby: 8, off: 2, vacation: 1, assignedDays: 17 },
    { agentId: 'c', agent: { name: 'Carlos', category: 'MB' }, sala: 8, lobby: 6, off: 2, vacation: 0, assignedDays: 16 },
  ];

  it('computes team averages and metric sections', () => {
    const chart = computeFairnessChart(monthRows);
    expect(chart.hasData).toBe(true);
    expect(chart.agentCount).toBe(3);
    expect(chart.averages.sala).toBe(8);
    expect(chart.averages.lobby).toBe(6);
    expect(chart.metricSections).toHaveLength(4);
  });

  it('flags high and low deviations from average', () => {
    expect(fairnessDeviationThreshold(8)).toBe(2);
    expect(fairnessTone(3, 8)).toBe('high');
    expect(fairnessTone(-3, 8)).toBe('low');
    expect(fairnessTone(1, 8)).toBe('neutral');
    expect(fairnessTone(3, 2)).toBe('high');
  });

  it('sorts rows by value descending within each metric', () => {
    const chart = computeFairnessChart(monthRows);
    const salaRows = chart.metricSections.find((section) => section.key === 'sala').rows;
    expect(salaRows[0].agent.name).toBe('Ana');
    expect(salaRows.at(-1).agent.name).toBe('Berno');
  });

  it('formats delta labels', () => {
    expect(formatFairnessDelta(2)).toBe('+2');
    expect(formatFairnessDelta(-1.5)).toBe('-1.5');
    expect(formatFairnessDelta(0)).toBe('±0');
  });

  it('returns empty chart when no active rows', () => {
    const chart = computeFairnessChart([
      { agentId: 'x', agent: { name: 'X' }, sala: 0, lobby: 0, off: 0, vacation: 0, assignedDays: 0 },
    ]);
    expect(chart.hasData).toBe(false);
    expect(chart.agentCount).toBe(0);
  });
});
