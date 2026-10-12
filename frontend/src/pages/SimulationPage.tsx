import { useMemo, useState, type FormEvent } from 'react';
import { CommonFields } from '../components/CommonFields';
import { BarChart, type BarSeries } from '../components/Charts';
import { EmptyState, Metric, RunButton, TvdNote, sortedEntries } from '../components/Common';
import { ErrorBanner, ValidationSummary } from '../components/ErrorBanner';
import { Field } from '../components/Field';
import { useRequest } from '../hooks/useRequest';
import { runSimulation } from '../services/api';
import { SIMULATION_NOISE_MODES, type CircuitInfo, type SimulationNoiseMode, type SimulationRequest, type SimulationResponse } from '../types/api';
import { MODE_PARAM_HINT, modeColor, modeLabel, num4, pct } from '../utils/format';
import { parseCommon, type CommonForm, type Errors } from '../utils/validation';

export function SimulationPage({ form, setForm, circuits }: { form: CommonForm; setForm: (f: CommonForm) => void; circuits: CircuitInfo[] }) {
  const [noiseMode, setNoiseMode] = useState<SimulationNoiseMode>('ideal');
  const [includeIdeal, setIncludeIdeal] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const { state, run } = useRequest((signal, body: SimulationRequest) => runSimulation(body, signal));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = parseCommon(form, circuits, true);
    setErrors(parsed.errors);
    if (!parsed.value) return;
    const v = parsed.value;
    void run({
      circuit: v.circuit,
      n_qubits: v.n_qubits,
      shots: v.shots,
      noise_mode: noiseMode,
      noise: v.noise,
      // custom_layers must only be sent for the custom circuit (contract §4)
      ...(v.circuit === 'custom' && v.custom_layers !== undefined ? { custom_layers: v.custom_layers } : {}),
      include_ideal_reference: includeIdeal,
    });
  };

  return (
    <div className="page">
      <form className="panel" onSubmit={submit} noValidate>
        <h2>Run a simulation</h2>
        <CommonFields form={form} onChange={setForm} errors={errors} circuits={circuits} withCircuit />
        <div className="grid">
          <Field label="Noise mode" htmlFor="noise-mode" hint={MODE_PARAM_HINT[noiseMode]}>
            <select id="noise-mode" value={noiseMode} onChange={(e) => setNoiseMode(e.target.value as SimulationNoiseMode)}>
              {SIMULATION_NOISE_MODES.map((m) => <option key={m} value={m}>{modeLabel(m)}</option>)}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={includeIdeal} onChange={(e) => setIncludeIdeal(e.target.checked)} />
            <span>Include ideal reference<small>Needed for TVD on noisy runs</small></span>
          </label>
        </div>
        <ValidationSummary errors={errors} />
        <RunButton loading={state.status === 'loading'} label="Run simulation" />
      </form>

      <section className="results" aria-live="polite">
        {state.status === 'idle' && <EmptyState>Choose a circuit and run it to see counts, probabilities and TVD.</EmptyState>}
        {state.status === 'loading' && <EmptyState><span className="spinner big" aria-hidden />Waiting for the simulator…</EmptyState>}
        {state.status === 'error' && <ErrorBanner error={state.error} onRetry={() => submit()} />}
        {state.status === 'success' && <SimulationResult r={state.data} />}
      </section>
    </div>
  );
}

function SimulationResult({ r }: { r: SimulationResponse }) {
  const [showAll, setShowAll] = useState(false);
  const noisy = r.noise_mode !== 'ideal';
  const hasIdeal = r.ideal_probabilities !== null;

  const series: BarSeries[] = useMemo(() => {
    const s: BarSeries[] = [{ key: 'primary', label: noisy ? `${modeLabel(r.noise_mode)} (noisy)` : 'Ideal', color: noisy ? modeColor(r.noise_mode) : modeColor('ideal'), data: r.probabilities }];
    if (noisy && r.ideal_probabilities) s.unshift({ key: 'ideal', label: 'Ideal reference', color: modeColor('ideal'), data: r.ideal_probabilities });
    return s;
  }, [r, noisy]);

  const rows = useMemo(() => sortedEntries(r.counts), [r.counts]);
  const visible = showAll ? rows : rows.slice(0, 16);
  const tvd = r.metrics.distribution_distance;

  return (
    <>
      <div className="metrics">
        <Metric label="TVD (total variation distance)" value={tvd === null ? '—' : num4(tvd)} hint="Distance between the primary distribution and the sampled ideal reference" />
        {r.metrics.success_probability !== null && <Metric label="Success probability" value={pct(r.metrics.success_probability)} />}
        <Metric label="Circuit depth" value={r.circuit_depth} />
        <Metric label="Gate count" value={r.gate_count} />
        <Metric label="Shots" value={r.shots.toLocaleString()} />
        <Metric label="Qubits" value={r.n_qubits} />
        <Metric label="Noise mode" value={modeLabel(r.noise_mode)} />
        {r.custom_layers !== null && <Metric label="Layers" value={r.custom_layers} />}
      </div>

      {noisy && !hasIdeal && (
        <div className="banner info" role="status">Ideal reference was not requested for this run, so the comparison bars and TVD are unavailable.</div>
      )}

      <BarChart title="Outcome probabilities" series={series} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bitstring <small>(q[{r.n_qubits - 1}]…q[0])</small></th>
              <th className="num">Counts</th>
              <th className="num">Probability</th>
              {hasIdeal && <th className="num">Ideal probability</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(([b, c]) => (
              <tr key={b}>
                <td className="mono">{b}</td>
                <td className="num mono">{c.toLocaleString()}</td>
                <td className="num mono">{pct(r.probabilities[b] ?? 0, 3)}</td>
                {hasIdeal && <td className="num mono">{pct(r.ideal_probabilities?.[b] ?? 0, 3)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 16 && (
          <button type="button" className="btn ghost small" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show top 16' : `Show all ${rows.length} outcomes`}</button>
        )}
      </div>

      <TvdNote />
      <p className="muted small-text mono">run {r.run_id} · simulator {r.metadata.simulator} · {r.metadata.status}</p>
    </>
  );
}
