/**
 * Client-side input checks for usability only (contract §11): the backend
 * stays authoritative. Limits mirror docs/api-contract.md §5-§8.
 */
import type { CircuitId, CircuitInfo, NoiseConfig } from '../types/api';
import { DEFAULT_NOISE } from '../types/api';

export const LIMITS = {
  qubits: { min: 1, max: 8 },
  shots: { min: 1, max: 100_000, default: 2000 },
  layers: { min: 1, max: 10 },
  depths: { min: 1, max: 10 },
  prob: { min: 0, max: 1 },
  t: { max: 1_000_000 },
  gate: { max: 100_000 },
} as const;

/** Used only if GET /api/circuits cannot be reached; values copied from contract §4. */
export const FALLBACK_CIRCUITS: CircuitInfo[] = [
  { id: 'bell', label: 'Bell', description: 'Creates a Bell pair on qubits 0 and 1; extra qubits are initialized to |1> by the original implementation.', min_qubits: 2, max_qubits: 8, supports_custom_layers: false },
  { id: 'ghz', label: 'GHZ', description: 'Creates a multi-qubit GHZ state.', min_qubits: 2, max_qubits: 8, supports_custom_layers: false },
  { id: 'qft_like', label: 'QFT-like', description: 'Compact interference circuit; omits the final swaps of a full QFT.', min_qubits: 1, max_qubits: 8, supports_custom_layers: false },
  { id: 'custom', label: 'Custom layered', description: 'Parameterized RY/RZ rotations and nearest-neighbor entangling layers.', min_qubits: 1, max_qubits: 8, supports_custom_layers: true, min_layers: 1, max_layers: 10 },
];

/** Form values are kept as strings so users can type freely; parsed on submit. */
export interface NoiseForm {
  p1: string;
  p2: string;
  p_readout: string;
  t1_us: string;
  t2_us: string;
  gate_1_us: string;
  gate_2_us: string;
}

export interface CommonForm {
  circuit: CircuitId;
  nQubits: string;
  shots: string;
  layers: string;
  noise: NoiseForm;
}

export const defaultNoiseForm = (): NoiseForm => ({
  p1: String(DEFAULT_NOISE.p1),
  p2: String(DEFAULT_NOISE.p2),
  p_readout: String(DEFAULT_NOISE.p_readout),
  t1_us: String(DEFAULT_NOISE.t1_us),
  t2_us: String(DEFAULT_NOISE.t2_us),
  gate_1_us: String(DEFAULT_NOISE.gate_1_us),
  gate_2_us: String(DEFAULT_NOISE.gate_2_us),
});

export const defaultCommonForm = (): CommonForm => ({
  circuit: 'bell',
  nQubits: '2',
  shots: String(LIMITS.shots.default),
  layers: '3',
  noise: defaultNoiseForm(),
});

export type Errors = Record<string, string>;

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseIntInRange(raw: string, min: number, max: number, label: string): { value?: number; error?: string } {
  const n = parseNumber(raw);
  if (n === null) return { error: `${label} is required and must be a number.` };
  if (!Number.isInteger(n)) return { error: `${label} must be a whole number.` };
  if (n < min || n > max) return { error: `${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.` };
  return { value: n };
}

export function parseNoise(f: NoiseForm): { noise?: NoiseConfig; errors: Errors } {
  const errors: Errors = {};
  const out: Required<NoiseConfig> = { ...DEFAULT_NOISE };

  const prob = (key: 'p1' | 'p2' | 'p_readout', label: string) => {
    const n = parseNumber(f[key]);
    if (n === null) errors[key] = `${label} must be a number.`;
    else if (n < 0 || n > 1) errors[key] = `${label} must be between 0 and 1.`;
    else out[key] = n;
  };
  const positive = (key: 't1_us' | 't2_us' | 'gate_1_us' | 'gate_2_us', label: string, max: number) => {
    const n = parseNumber(f[key]);
    if (n === null) errors[key] = `${label} must be a number.`;
    else if (n <= 0 || n > max) errors[key] = `${label} must be greater than 0 and at most ${max.toLocaleString()}.`;
    else out[key] = n;
  };

  prob('p1', 'p1');
  prob('p2', 'p2');
  prob('p_readout', 'p_readout');
  positive('t1_us', 'T1', LIMITS.t.max);
  positive('t2_us', 'T2', LIMITS.t.max);
  positive('gate_1_us', 'gate_1_us', LIMITS.gate.max);
  positive('gate_2_us', 'gate_2_us', LIMITS.gate.max);

  if (!errors.t1_us && !errors.t2_us && out.t2_us > 2 * out.t1_us) {
    errors.t2_us = 'T2 must be at most 2 × T1.';
  }
  return Object.keys(errors).length ? { errors } : { noise: out, errors };
}

export interface ParsedCommon {
  circuit: CircuitId;
  n_qubits: number;
  shots: number;
  /** Defined only for circuits that support layers. */
  custom_layers?: number;
  noise: NoiseConfig;
}

/**
 * Validate the shared form. `withCircuit=false` is used by the depth sweep,
 * which always sweeps the built-in `custom` circuit and takes depths instead.
 */
export function parseCommon(
  f: CommonForm,
  circuits: CircuitInfo[],
  withCircuit: boolean,
): { value?: ParsedCommon; errors: Errors } {
  const errors: Errors = {};
  const info = circuits.find((c) => c.id === f.circuit);
  const minQ = withCircuit ? info?.min_qubits ?? LIMITS.qubits.min : LIMITS.qubits.min;
  const maxQ = withCircuit ? info?.max_qubits ?? LIMITS.qubits.max : LIMITS.qubits.max;

  const q = parseIntInRange(f.nQubits, minQ, maxQ, 'Qubits');
  if (q.error) {
    const raw = Number(f.nQubits);
    errors.nQubits =
      withCircuit && info && minQ > 1 && Number.isInteger(raw) && raw < minQ
        ? `${info.label} needs at least ${minQ} qubits.`
        : q.error;
  }
  const s = parseIntInRange(f.shots, LIMITS.shots.min, LIMITS.shots.max, 'Shots');
  if (s.error) errors.shots = s.error;

  let layers: number | undefined;
  if (withCircuit && info?.supports_custom_layers) {
    const l = parseIntInRange(f.layers, info.min_layers ?? LIMITS.layers.min, info.max_layers ?? LIMITS.layers.max, 'Layers');
    if (l.error) errors.layers = l.error;
    else layers = l.value;
  }

  const n = parseNoise(f.noise);
  Object.assign(errors, Object.fromEntries(Object.entries(n.errors).map(([k, v]) => [`noise.${k}`, v])));

  if (Object.keys(errors).length || q.value === undefined || s.value === undefined || !n.noise) return { errors };
  return {
    errors,
    value: {
      circuit: withCircuit ? f.circuit : 'custom',
      n_qubits: q.value,
      shots: s.value,
      ...(layers !== undefined ? { custom_layers: layers } : {}),
      noise: n.noise,
    },
  };
}
