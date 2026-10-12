import { useMemo, useState, type FormEvent } from 'react';
import { BarChart, LineChart, type LineSeries } from '../components/Charts';
import { CommonFields } from '../components/CommonFields';
import { EmptyState, Metric, RunButton, TvdNote } from '../components/Common';
import { ErrorBanner, ValidationSummary } from '../components/ErrorBanner';
import { ChipGroup, Field } from '../components/Field';
import { useRequest } from '../hooks/useRequest';
import { runDepthSweep } from '../services/api';
import { COMPARISON_NOISE_MODES, type CircuitInfo, type ComparisonNoiseMode, type DepthSweepRequest, type DepthSweepResponse } from '../types/api';
import { modeColor, modeLabel, num4 } from '../utils/format';
import { LIMITS, parseCommon, type CommonForm, type Errors } from '../utils/validation';

const MODE_OPTIONS = COMPARISON_NOISE_MODES.map((m) => ({ value: m, label: modeLabel(m) }));
const DEPTH_OPTIONS = Array.from({ length: LIMITS.depths.max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

export function DepthSweepPage({ form, setForm, circuits }: { form: CommonForm; setForm: (f: CommonForm) => void; circuits: CircuitInfo[] }) {
  const [depths, setDepths] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [modes, setModes] = useState<ComparisonNoiseMode[]>(['combined']);
  const [errors, setErrors] = useState<Errors>({});
  const { state, run } = useRequest((signal, body: DepthSweepRequest) => runDepthSweep(body, signal));

  const toggleDepth = (d: number) => setDepths((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));
  const toggleMode = (m: ComparisonNoiseMode) =>
    setModes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : COMPARISON_NOISE_MODES.filter((x) => x === m || cur.includes(x))));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = parseCommon(form, circuits, false);
    const errs: Errors = { ...parsed.errors };
    if (depths.length < 1) errs.depths = 'Select at least one depth.';
    if (modes.length < 1) errs.modes = 'Select at least one noise mode.';
    setErrors(errs);
    if (!parsed.value || Object.keys(errs).length) return;
    void run({
      n_qubits: parsed.value.n_qubits,
      shots: parsed.value.shots,
      noise: parsed.value.noise,
      depths: [...depths].sort((a, b) => a - b), // contract: unique, ascending
      noise_modes: modes,
    });
  };

  return (
    <div className="page">
      <form className="panel" onSubmit={submit} noValidate>
        <h2>Circuit-depth sweep</h2>
        <p className="muted small-text">Sweeps the built-in <em>Custom layered</em> circuit over the selected layer depths.</p>
        <CommonFields form={form} onChange={setForm} errors={errors} circuits={circuits} withCircuit={false} />
        <Field label="Depths (layers)" error={errors.depths}>
          <ChipGroup ariaLabel="Depths" options={DEPTH_OPTIONS} selected={depths} onToggle={toggleDepth} />
        </Field>
        <Field label="Noise modes" error={errors.modes}>
          <ChipGroup ariaLabel="Noise modes" options={MODE_OPTIONS} selected={modes} onToggle={toggleMode} colorOf={modeColor} />
        </Field>
        <ValidationSummary errors={Object.fromEntries(Object.entries(errors).filter(([k]) => k !== 'depths' && k !== 'modes'))} />
        <RunButton loading={state.status === 'loading'} label="Run depth sweep" />
      </form>

      <section className="results" aria-live="polite">
        {state.status === 'idle' && <EmptyState>Select depths and noise modes to see how distance from ideal changes with circuit depth.</EmptyState>}
        {state.status === 'loading' && <EmptyState><span className="spinner big" aria-hidden />Running {depths.length * modes.length} simulations…</EmptyState>}
        {state.status === 'error' && <ErrorBanner error={state.error} onRetry={() => submit()} />}
        {state.status === 'success' && <SweepResult r={state.data} />}
      </section>
    </div>
  );
}

function SweepResult({ r }: { r: DepthSweepResponse }) {
  const depths = useMemo(() => [...new Set(r.results.map((x) => x.depth))].sort((a, b) => a - b), [r.results]);
  const [sel, setSel] = useState(0);

  const series: LineSeries[] = useMemo(
    () => r.noise_modes.map((m) => ({
      key: m,
      label: modeLabel(m),
      color: modeColor(m),
      points: r.results.filter((x) => x.noise_mode === m).map((x) => ({ x: x.depth, y: x.distribution_distance })),
    })),
    [r],
  );

  const cell = (d: number, m: ComparisonNoiseMode) => r.results.find((x) => x.depth === d && x.noise_mode === m);
  const picked = r.results[Math.min(sel, r.results.length - 1)];

  return (
    <>
      <div className="metrics">
        <Metric label="Qubits" value={r.n_qubits} />
        <Metric label="Shots" value={r.shots.toLocaleString()} />
        <Metric label="Depths" value={depths.join(', ')} />
        <Metric label="Noise modes" value={r.noise_modes.map(modeLabel).join(', ')} />
      </div>

      <LineChart title="TVD vs circuit depth" series={series} xLabel="Layers" yLabel="TVD" />
      <p className="muted small-text">TVD is not guaranteed to rise monotonically with depth; finite-shot sampling adds variation.</p>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Layers</th>{r.noise_modes.map((m) => <th key={m} className="num"><i className="dot" style={{ background: modeColor(m) }} />{modeLabel(m)}</th>)}</tr></thead>
          <tbody>
            {depths.map((d) => (
              <tr key={d}><td className="mono">{d}</td>{r.noise_modes.map((m) => <td key={m} className="num mono">{cell(d, m) ? num4(cell(d, m)!.distribution_distance) : '—'}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      {picked && (
        <>
          <Field label="Inspect distributions" htmlFor="inspect">
            <select id="inspect" value={Math.min(sel, r.results.length - 1)} onChange={(e) => setSel(Number(e.target.value))}>
              {r.results.map((x, i) => <option key={`${x.depth}-${x.noise_mode}`} value={i}>{`${x.depth} layer${x.depth > 1 ? 's' : ''} · ${modeLabel(x.noise_mode)} · TVD ${num4(x.distribution_distance)}`}</option>)}
            </select>
          </Field>
          <BarChart
            title={`Ideal vs ${modeLabel(picked.noise_mode)} at ${picked.depth} layer${picked.depth > 1 ? 's' : ''}`}
            maxBars={12}
            series={[
              { key: 'ideal', label: 'Ideal reference', color: modeColor('ideal'), data: picked.ideal_probabilities },
              { key: 'noisy', label: modeLabel(picked.noise_mode), color: modeColor(picked.noise_mode), data: picked.noisy_probabilities },
            ]}
          />
        </>
      )}
      <TvdNote />
    </>
  );
}
