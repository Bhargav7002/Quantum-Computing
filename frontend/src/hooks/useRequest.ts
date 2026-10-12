import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../services/api';

export type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError };

/**
 * Runs an async API call with loading / success / error state.
 * A newer run() aborts the previous one, so a slow earlier response can
 * never overwrite a newer result; unmounting aborts too.
 */
export function useRequest<A extends unknown[], T>(fn: (signal: AbortSignal, ...args: A) => Promise<T>) {
  const [state, setState] = useState<RequestState<T>>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: A) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading' });
    try {
      const data = await fnRef.current(controller.signal, ...args);
      if (controllerRef.current === controller) setState({ status: 'success', data });
    } catch (e) {
      if (isAbortError(e) || controller.signal.aborted) return;
      const error = e instanceof ApiError ? e : new ApiError('unknown', e instanceof Error ? e.message : 'Unexpected error');
      if (controllerRef.current === controller) setState({ status: 'error', error });
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, run, reset };
}
