/**
 * Single place for all backend calls (contract §11).
 * Components must never call fetch() directly.
 */
import type {
  ApiErrorDetail,
  CircuitCatalogueResponse,
  DepthSweepRequest,
  DepthSweepResponse,
  HealthResponse,
  NoiseComparisonRequest,
  NoiseComparisonResponse,
  SimulationRequest,
  SimulationResponse,
} from '../types/api';
import { mockApi } from '../mocks/mockApi';

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

/** TEMPORARY: when true, calls are answered by src/mocks/mockApi.ts. */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true';

const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Error categories the UI distinguishes (contract §9, §11):
 *  - validation: HTTP 422 (VALIDATION_ERROR / REQUEST_ERROR)
 *  - server:     HTTP 5xx (SIMULATION_ERROR)
 *  - network:    backend down, timeout, CORS rejection -> no JSON body
 *  - unknown:    any other / unparseable response
 */
export type ApiErrorKind = 'validation' | 'server' | 'network' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details: ApiErrorDetail[];

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; code?: string; details?: ApiErrorDetail[] } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details ?? [];
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Defensively pull details out of an unknown error body. */
function parseErrorBody(body: unknown): { code?: string; message?: string; details: ApiErrorDetail[] } {
  if (!isRecord(body)) return { details: [] };

  // Contract envelope: { error: { code, message, details: [{field, message}] } }
  if (isRecord(body.error)) {
    const e = body.error;
    const details: ApiErrorDetail[] = Array.isArray(e.details)
      ? e.details.flatMap((d): ApiErrorDetail[] =>
          isRecord(d) && typeof d.message === 'string'
            ? [{ field: typeof d.field === 'string' ? d.field : undefined, message: d.message }]
            : [],
        )
      : [];
    return {
      code: typeof e.code === 'string' ? e.code : undefined,
      message: typeof e.message === 'string' ? e.message : undefined,
      details,
    };
  }

  // FastAPI's stock shape, in case a handler is not registered: { detail: [...] | "text" }
  if (typeof body.detail === 'string') return { message: body.detail, details: [] };
  if (Array.isArray(body.detail)) {
    const details = body.detail.flatMap((d): ApiErrorDetail[] => {
      if (!isRecord(d) || typeof d.msg !== 'string') return [];
      const loc = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : undefined;
      return [{ field: loc || undefined, message: d.msg }];
    });
    return { details };
  }
  return { details: [] };
}

async function request<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method,
      headers: init.body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) {
      throw new ApiError('network', `The backend did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    if (isAbortError(e)) throw e; // cancelled by the caller; not a user-facing error
    throw new ApiError(
      'network',
      `Could not reach the backend at ${API_BASE_URL}. Check that it is running and that CORS allows this origin.`,
    );
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onCallerAbort);
  }

  let parsed: unknown = undefined;
  let text = '';
  try {
    text = await res.text();
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined; // non-JSON body
  }

  if (!res.ok) {
    const { code, message, details } = parseErrorBody(parsed);
    if (res.status === 422) {
      throw new ApiError('validation', message ?? 'The request was rejected as invalid.', {
        status: res.status,
        code,
        details,
      });
    }
    if (res.status >= 500) {
      throw new ApiError('server', message ?? 'The backend failed to complete the request.', {
        status: res.status,
        code,
        details,
      });
    }
    throw new ApiError('unknown', message ?? `Unexpected response from the backend (HTTP ${res.status}).`, {
      status: res.status,
      code,
      details,
    });
  }

  if (parsed === undefined) {
    throw new ApiError('unknown', 'The backend returned an empty or non-JSON response.', { status: res.status });
  }
  return parsed as T;
}

// ---- Endpoints -----------------------------------------------------------

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  if (USE_MOCKS) return mockApi.getHealth();
  return request('/api/health', { method: 'GET', signal });
}

export function getCircuits(signal?: AbortSignal): Promise<CircuitCatalogueResponse> {
  if (USE_MOCKS) return mockApi.getCircuits();
  return request('/api/circuits', { method: 'GET', signal });
}

export function runSimulation(body: SimulationRequest, signal?: AbortSignal): Promise<SimulationResponse> {
  if (USE_MOCKS) return mockApi.runSimulation(body);
  return request('/api/simulation/run', { method: 'POST', body, signal });
}

export function runNoiseComparison(
  body: NoiseComparisonRequest,
  signal?: AbortSignal,
): Promise<NoiseComparisonResponse> {
  if (USE_MOCKS) return mockApi.runNoiseComparison(body);
  return request('/api/analysis/noise-comparison', { method: 'POST', body, signal });
}

export function runDepthSweep(body: DepthSweepRequest, signal?: AbortSignal): Promise<DepthSweepResponse> {
  if (USE_MOCKS) return mockApi.runDepthSweep(body);
  return request('/api/analysis/depth-sweep', { method: 'POST', body, signal });
}
