import { useCallback, useEffect, useState } from 'react';
import { MockBanner } from './components/Common';
import { ErrorBanner } from './components/ErrorBanner';
import { API_BASE_URL, ApiError, getCircuits, getHealth, isAbortError, USE_MOCKS } from './services/api';
import type { CircuitInfo, HealthResponse } from './types/api';
import { DepthSweepPage } from './pages/DepthSweepPage';
import { NoiseComparisonPage } from './pages/NoiseComparisonPage';
import { SimulationPage } from './pages/SimulationPage';
import { defaultCommonForm, FALLBACK_CIRCUITS, type CommonForm } from './utils/validation';

type Tab = 'overview' | 'simulate' | 'compare' | 'depth' | 'learn';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'simulate', label: 'Simulation' },
  { id: 'compare', label: 'Noise comparison' },
  { id: 'depth', label: 'Depth sweep' },
  { id: 'learn', label: 'Learning lab' },
];

type Health = { status: 'loading' } | { status: 'ok' | 'degraded'; data: HealthResponse } | { status: 'down'; error: ApiError };

function toApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError('unknown', e instanceof Error ? e.message : 'Unexpected error');
}

export function App() {
  const [tab, setTab] = useState<Tab>('simulate');
  const [form, setForm] = useState<CommonForm>(defaultCommonForm);
  const [circuits, setCircuits] = useState<CircuitInfo[]>(FALLBACK_CIRCUITS);
  const [circuitsError, setCircuitsError] = useState<ApiError | null>(null);
  const [health, setHealth] = useState<Health>({ status: 'loading' });

  const load = useCallback((signal?: AbortSignal) => {
    setHealth({ status: 'loading' });
    getHealth(signal)
      .then((data) => setHealth({ status: data.status === 'ok' ? 'ok' : 'degraded', data }))
      .catch((e) => { if (!isAbortError(e)) setHealth({ status: 'down', error: toApiError(e) }); });
    getCircuits(signal)
      .then((res) => {
        if (!Array.isArray(res?.circuits) || res.circuits.length === 0) throw new ApiError('unknown', 'The circuit catalogue was empty.');
        setCircuits(res.circuits);
        setCircuitsError(null);
      })
      .catch((e) => { if (!isAbortError(e)) setCircuitsError(toApiError(e)); });
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  // If the catalogue changes (or loads) and the selected circuit is missing, fall back to the first one.
  useEffect(() => {
    if (!circuits.some((c) => c.id === form.circuit)) setForm((f) => ({ ...f, circuit: circuits[0].id }));
  }, [circuits, form.circuit]);

  const pageProps = { form, setForm, circuits };

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden><circle cx="16" cy="16" r="4.5" fill="currentColor" /><ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 16 16)" /><ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 16 16)" /></svg>
          <div>
            <h1>Quantum System Simulation Platform</h1>
            <p>V2 · API contract v1.0.0</p>
          </div>
        </div>
        <button type="button" className={`pill ${health.status}`} onClick={() => load()} title={`Backend: ${USE_MOCKS ? 'mock data' : API_BASE_URL} — click to re-check`}>
          <i className="dot" />
          {health.status === 'loading' && 'Checking backend…'}
          {health.status === 'ok' && `Backend OK · ${health.data.simulator}`}
          {health.status === 'degraded' && `Backend degraded · simulator ${health.data.simulator}`}
          {health.status === 'down' && 'Backend unreachable'}
        </button>
      </header>

      <MockBanner />
      <section className="welcome-strip">
        <div><span className="eyebrow">QUANTUM EXPERIMENT WORKSPACE</span><p>Configure an experiment, inspect measurement distributions, and understand how noise changes outcomes.</p></div>
        <div className="welcome-badges"><span>Qiskit Aer</span><span>API v1.0.0</span><span>Local experiments</span></div>
      </section>

      <nav className="tabs" role="tablist" aria-label="Analysis type">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <main>
        {health.status === 'degraded' && (
          <div className="banner warn" role="status">The backend reports <code>status: degraded</code> (simulator: <code>{health.data.simulator}</code>). Simulations may fail.</div>
        )}
        {health.status === 'down' && <ErrorBanner error={health.error} onRetry={() => load()} />}
        {circuitsError && health.status !== 'down' && <ErrorBanner error={circuitsError} onRetry={() => load()} />}
        {circuitsError && <p className="muted small-text">Using the built-in circuit list from the API contract until the catalogue loads.</p>}

        {tab === 'overview' && <OverviewPage onStart={() => setTab('simulate')} />}
        {tab === 'learn' && <LearningPage onExplore={() => setTab('simulate')} />}
        {tab === 'simulate' && <SimulationPage {...pageProps} />}
        {tab === 'compare' && <NoiseComparisonPage {...pageProps} />}
        {tab === 'depth' && <DepthSweepPage {...pageProps} />}
      </main>

      <footer>Results are shown exactly as returned by the API. Backend validation is authoritative. Educational notes are explanatory and do not alter simulation results.</footer>
    </div>
  );
}


function OverviewPage({ onStart }: { onStart: () => void }) {
  return <div className="content-page">
    <section className="hero-panel"><div className="hero-copy"><span className="eyebrow">WELCOME TO THE LAB</span><h2>Explore quantum circuits.<br/><em>Measure the difference.</em></h2><p>Run a simulation, compare noise models, and investigate how circuit depth relates to distribution distance—all through the existing API.</p><button className="btn primary" onClick={onStart}>Open simulation studio <span aria-hidden>→</span></button></div><CircuitIllustration /></section>
    <div className="feature-grid">
      <article className="feature-card"><span className="feature-number">01</span><h3>Simulation</h3><p>Choose a supported circuit, configure qubits and shots, then inspect measured counts and probabilities.</p><span className="feature-tag">Run experiments</span></article>
      <article className="feature-card"><span className="feature-number">02</span><h3>Noise comparison</h3><p>Compare noisy distributions against the ideal sampled reference using Total Variation Distance.</p><span className="feature-tag">Compare models</span></article>
      <article className="feature-card"><span className="feature-number">03</span><h3>Depth sweep</h3><p>Study how changing custom circuit layer depth affects the difference between ideal and noisy distributions.</p><span className="feature-tag">Explore depth</span></article>
    </div>
    <section className="explainer-card"><div><span className="eyebrow">THE WORKFLOW</span><h2>From circuit to evidence</h2></div><div className="workflow"><div><b>1</b><strong>Configure</strong><small>Choose circuit, qubits, shots and noise.</small></div><i>→</i><div><b>2</b><strong>Simulate</strong><small>The backend executes the requested experiment.</small></div><i>→</i><div><b>3</b><strong>Inspect</strong><small>Read counts, probabilities, metrics and charts.</small></div></div></section>
  </div>;
}

function LearningPage({ onExplore }: { onExplore: () => void }) {
  const [open, setOpen] = useState('tvd');
  const topics = [{id:'qubits',title:'Qubits and measurement',body:'A qubit is a quantum two-level system. Measurement in the computational basis produces a classical bit (0 or 1). Repeating a circuit for many shots estimates the outcome probability distribution.'},{id:'noise',title:'Noise models',body:'Noise models approximate unwanted changes during gates, while readout error represents mistakes when measuring. Different models affect the output distribution in different ways; no single ordering is guaranteed for every circuit.'},{id:'tvd',title:'Total Variation Distance (TVD)',body:'TVD = ½ Σx |P(x) − Q(x)|. It ranges from 0 to 1: zero means identical distributions, and one means the distributions have disjoint probability support. With finite shots, sampling variation can contribute to the observed distance.'},{id:'depth',title:'Circuit depth and layers',body:'Circuit depth describes sequential layers of operations. The depth-sweep endpoint evaluates the built-in custom layered circuit at selected depths. TVD is not guaranteed to increase monotonically as depth changes.'}];
  return <div className="content-page learning-page"><section className="page-heading"><span className="eyebrow">QUICK REFERENCE</span><h2>Quantum Learning Lab</h2><p>Short explanations for interpreting the experiments in this platform.</p></section><div className="learning-layout"><div className="topic-list">{topics.map((t,i)=><button key={t.id} className={open===t.id?'topic active':'topic'} onClick={()=>setOpen(t.id)}><span>0{i+1}</span>{t.title}<b>{open===t.id?'−':'+'}</b></button>)}</div><article className="topic-detail"><span className="eyebrow">CONCEPT GUIDE</span><h3>{topics.find(t=>t.id===open)?.title}</h3><p>{topics.find(t=>t.id===open)?.body}</p>{open==='tvd'&&<div className="formula">TVD(P,Q) = ½ ∑<sub>x</sub> |P(x) − Q(x)|</div>}<button className="btn primary" onClick={onExplore}>Try it in the simulation studio →</button></article></div><p className="muted small-text learning-disclaimer">Learning content is explanatory only; it does not modify request payloads, backend calculations, or API contract behaviour.</p></div>;
}

function CircuitIllustration() {
 return <div className="circuit-art" aria-label="Illustrative two-qubit circuit diagram"><div className="circuit-caption">CIRCUIT CONCEPT <span>illustrative</span></div><div className="wire-row"><b>q₀</b><div className="wire"><span className="gate">H</span><span className="connector"></span><span className="control-dot"></span><span className="end-gate">X</span></div></div><div className="wire-row"><b>q₁</b><div className="wire"><span className="gate ghost-gate"> </span><span className="connector"></span><span className="target">⊕</span><span className="end-gate ghost-gate"> </span></div></div><div className="circuit-foot">Hadamard + controlled-X · Bell-state concept</div></div>;
}
