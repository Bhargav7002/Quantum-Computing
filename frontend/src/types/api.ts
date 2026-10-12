/**
 * TypeScript types for the Quantum Simulation API, v1.0.0.
 * Source of truth: docs/api-contract.md. Keep the two in sync.
 * Property names and enum values are copied exactly from the contract.
 */

// ---- Enums ---------------------------------------------------------------

export type CircuitId = 'bell' | 'ghz' | 'qft_like' | 'custom';

/** Accepted by POST /api/simulation/run as `noise_mode`. */
export type SimulationNoiseMode =
  | 'ideal'
  | 'depolarizing'
  | 'bit_flip'
  | 'thermal'
  | 'readout'
  | 'combined';

/** Accepted inside `noise_modes` for noise-comparison and depth-sweep ("ideal" is NOT allowed). */
export type ComparisonNoiseMode = Exclude<SimulationNoiseMode, 'ideal'>;

export const CIRCUIT_IDS: readonly CircuitId[] = ['bell', 'ghz', 'qft_like', 'custom'];
export const SIMULATION_NOISE_MODES: readonly SimulationNoiseMode[] = [
  'ideal',
  'depolarizing',
  'bit_flip',
  'thermal',
  'readout',
  'combined',
];
export const COMPARISON_NOISE_MODES: readonly ComparisonNoiseMode[] = [
  'depolarizing',
  'bit_flip',
  'thermal',
  'readout',
  'combined',
];

// ---- Shared --------------------------------------------------------------

/** Bitstring -> value (counts or probabilities). Order is q[n-1]_to_q[0]. */
export type CountMap = Record<string, number>;
export type ProbabilityMap = Record<string, number>;

/** All fields optional; omitted fields use backend defaults. */
export interface NoiseConfig {
  p1?: number;
  p2?: number;
  p_readout?: number;
  t1_us?: number;
  t2_us?: number;
  gate_1_us?: number;
  gate_2_us?: number;
}

export const DEFAULT_NOISE: Required<NoiseConfig> = {
  p1: 0.001,
  p2: 0.01,
  p_readout: 0.01,
  t1_us: 100.0,
  t2_us: 80.0,
  gate_1_us: 0.05,
  gate_2_us: 0.3,
};

// ---- GET /api/health -----------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'degraded' | string;
  service: string;
  version: string;
  simulator: 'qiskit_aer' | 'unavailable' | string;
}

// ---- GET /api/circuits ---------------------------------------------------

export interface CircuitInfo {
  id: CircuitId;
  label: string;
  description: string;
  min_qubits: number;
  max_qubits: number;
  supports_custom_layers: boolean;
  /** Present only when supports_custom_layers is true. */
  min_layers?: number;
  max_layers?: number;
}

export interface CircuitCatalogueResponse {
  circuits: CircuitInfo[];
}

// ---- POST /api/simulation/run -------------------------------------------

export interface SimulationRequest {
  circuit: CircuitId;
  n_qubits: number;
  shots?: number;
  noise_mode?: SimulationNoiseMode;
  noise?: NoiseConfig;
  /** Only allowed for circuit === 'custom'. Omit otherwise. */
  custom_layers?: number | null;
  include_ideal_reference?: boolean;
}

export interface SimulationMetrics {
  /** Total variation distance (0..1). null when no ideal reference was requested. */
  distribution_distance: number | null;
  success_probability: number | null;
}

export interface SimulationMetadata {
  simulator: string;
  metric_definition: string;
  status: string;
}

export interface SimulationResponse {
  run_id: string;
  circuit: CircuitId;
  n_qubits: number;
  shots: number;
  noise_mode: SimulationNoiseMode;
  custom_layers: number | null;
  circuit_depth: number;
  gate_count: number;
  bitstring_order: string;
  counts: CountMap;
  probabilities: ProbabilityMap;
  ideal_counts: CountMap | null;
  ideal_probabilities: ProbabilityMap | null;
  metrics: SimulationMetrics;
  metadata: SimulationMetadata;
}

// ---- POST /api/analysis/noise-comparison --------------------------------

export interface NoiseComparisonRequest {
  circuit: CircuitId;
  n_qubits: number;
  shots?: number;
  noise?: NoiseConfig;
  custom_layers?: number | null;
  /** 1-5 unique modes; defaults to all five. */
  noise_modes?: ComparisonNoiseMode[];
}

export interface NoiseComparisonResult {
  noise_mode: ComparisonNoiseMode;
  counts: CountMap;
  probabilities: ProbabilityMap;
  distribution_distance: number;
}

export interface NoiseComparisonResponse {
  circuit: CircuitId;
  n_qubits: number;
  shots: number;
  bitstring_order: string;
  ideal_probabilities: ProbabilityMap;
  results: NoiseComparisonResult[];
  metric_definition: string;
}

// ---- POST /api/analysis/depth-sweep -------------------------------------

export interface DepthSweepRequest {
  n_qubits: number;
  shots?: number;
  noise?: NoiseConfig;
  /** 1-10 unique integers, each 1-10, ascending. Default [1..6]. */
  depths?: number[];
  /** 1-5 unique modes; default ["combined"]. */
  noise_modes?: ComparisonNoiseMode[];
}

export interface DepthSweepResult {
  depth: number;
  noise_mode: ComparisonNoiseMode;
  ideal_probabilities: ProbabilityMap;
  noisy_probabilities: ProbabilityMap;
  distribution_distance: number;
}

export interface DepthSweepResponse {
  n_qubits: number;
  shots: number;
  noise_modes: ComparisonNoiseMode[];
  metric_definition: string;
  results: DepthSweepResult[];
}

// ---- Errors --------------------------------------------------------------

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

/** Known codes today: VALIDATION_ERROR, REQUEST_ERROR (both 422), SIMULATION_ERROR (500). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
}
