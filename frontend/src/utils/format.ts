import type { ComparisonNoiseMode, SimulationNoiseMode } from '../types/api';

export const MODE_LABELS: Record<SimulationNoiseMode, string> = {
  ideal: 'Ideal',
  depolarizing: 'Depolarizing',
  bit_flip: 'Bit flip',
  thermal: 'Thermal relaxation',
  readout: 'Readout error',
  combined: 'Combined',
};

export const MODE_COLORS: Record<SimulationNoiseMode, string> = {
  ideal: '#8ea0b8',
  depolarizing: '#5aa9ff',
  bit_flip: '#ffb454',
  thermal: '#ff6b8b',
  readout: '#9be564',
  combined: '#c792ea',
};

export const modeLabel = (m: SimulationNoiseMode | ComparisonNoiseMode) => MODE_LABELS[m] ?? m;
export const modeColor = (m: SimulationNoiseMode | ComparisonNoiseMode) => MODE_COLORS[m] ?? '#39d0c3';

export const pct = (p: number, digits = 2) => `${(p * 100).toFixed(digits)}%`;
export const num4 = (n: number) => n.toFixed(4);

/** Which noise parameters actually influence each mode (contract §5 note). */
export const MODE_PARAM_HINT: Record<SimulationNoiseMode, string> = {
  ideal: 'No noise is applied; noise parameters are ignored.',
  depolarizing: 'Uses p1 and p2.',
  bit_flip: 'Uses p1 and p2 (bit-flip errors).',
  thermal: 'Uses T1, T2 and the gate durations.',
  readout: 'Uses p_readout.',
  combined: 'Uses depolarizing, thermal-relaxation and readout parameters together.',
};

/** Round a max value up to a "nice" axis limit. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const steps = [0.02, 0.04, 0.08, 0.2, 0.4, 0.8, 1];
  return steps.find((s) => s >= v) ?? 1;
}
