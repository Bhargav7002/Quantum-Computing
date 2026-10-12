import type { ReactNode } from 'react';
import { USE_MOCKS } from '../services/api';

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="metric" title={hint}>
      <span className="metric-label">{label}</span>
      <span className="metric-value mono">{value}</span>
    </div>
  );
}

export function TvdNote() {
  return (
    <p className="muted small-text">
      TVD = total variation distance, ½·Σ|P(x) − Q(x)|, from 0 (identical) to 1. The ideal reference is
      <em> sampled</em> with the same number of shots, so TVD includes finite-shot sampling variation and can differ between runs.
      Bitstrings are ordered q[n-1] … q[0] (leftmost bit = highest-index qubit).
    </p>
  );
}

export function MockBanner() {
  if (!USE_MOCKS) return null;
  return (
    <div className="banner mock" role="status">
      <strong>TEMPORARY MOCK DATA</strong> — these numbers are generated in the browser and are not real simulation results.
      Set <code>VITE_USE_MOCKS=false</code> in <code>.env</code> to use the backend.
    </div>
  );
}

export function RunButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" className="btn primary" disabled={loading}>
      {loading ? <><span className="spinner" aria-hidden />Running…</> : label}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function sortedEntries(map: Record<string, number>): [string, number][] {
  return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
