import { useMemo, useState, type FormEvent } from 'react';
import { BarChart, TvdBars, type BarSeries } from '../components/Charts';
import { CommonFields } from '../components/CommonFields';
import { EmptyState, Metric, RunButton, TvdNote, sortedEntries } from '../components/Common';
import { ErrorBanner, ValidationSummary } from '../components/ErrorBanner';
import { ChipGroup } from '../components/Field';
import { useRequest } from '../hooks/useRequest';
import { runNoiseComparison } from '../services/api';
import { COMPARISON_NOISE_MODES, type CircuitInfo, type ComparisonNoiseMode, type NoiseComparisonRequest, type NoiseComparisonResponse } from '../types/api';
import { modeColor, modeLabel, num4, pct } from '../utils/format';
import { parseCommon, type CommonForm, type Errors } from '../utils/validation';

const MODE_OPTIONS = COMPARISON_NOISE_MODES.map((m) => ({ value: m, label: modeLabel(m) }));

export function NoiseComparisonPage({ form, setForm, circuits }: { form: CommonForm; setForm: (f: CommonForm) => void; circuits: CircuitInfo[] }) {
  const [modes, setModes] = useState<ComparisonNoiseMode[]>([...COMPARISON_NOISE_MODES]);
  const [errors, setErrors] = useState<Errors>({});
  const { state, run } = useRequest((signal, body: NoiseComparisonRequest) => runNoiseComparison(body, signal));

  const toggle = (m: ComparisonNoiseMode) =>
    setModes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : COMPARISON_NOISE_MODES.filter((x) => x === m || cur.includes(x))));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = parseCommon(form, circuits, true);
    const errs: Errors = { ...parsed.errors };
    if (modes.length < 1) errs.modes = 'Select at least one noise mode.';
    setErrors(errs);
    if (!parsed.value || Object.keys(errs).length) return;
    const v = parsed.value;
    void run({
      circuit: v.circuit,
      n_qubits: v.n_qubits,
      shots: v.shots,
      noise: v.noise,
      noise_modes: modes,
      ...(v.circuit === 'custom' && v.custom_layers !== undefined ? { custom_layers: v.custom_layers } : {}),
    });
  };

  return (
    <div className="page">
      <form className="panel" onSubmit={submit} noValidate>
        <h2>Compare noise models</h2>
        <CommonFields form={form} onChange={setForm} errors={errors} circuits={circuits} withCircuit />
        <p className="group-title">Noise modes to compare</p>
        <ChipGroup ariaLabel="Noise modes" options={MODE_OPTIONS} selected={modes} onToggle={toggle} colorOf={modeColor} />
        <ValidationSummary errors={errors} />
        <RunButton loading={state.status === 'loading'} label="Compare noise models" />
      </form>

      <section className="results" aria-live="polite">
        {state.status === 'idle' && <EmptyState>Pick the noise models to compare against the ideal reference.</EmptyState>}
        {state.status === 'loading' && <EmptyState><span className="spinner big" aria-hidden />Running {modes.length} noisy simulations…</EmptyState>}
        {state.status === 'error' && <ErrorBanner error={state.error} onRetry={() => submit()} />}
        {state.status === 'success' && <ComparisonResult r={state.data} />}
      </section>
    </div>
  );
}

function ComparisonResult({ r }: { r: NoiseComparisonResponse }) {
  const series: BarSeries[] = useMemo(
    () => [
      { key: 'ideal', label: 'Ideal reference', color: modeColor('ideal'), data: r.ideal_probabilities },
      ...r.results.map((x) => ({ key: x.noise_mode, label: modeLabel(x.noise_mode), color: modeColor(x.noise_mode), data: x.probabilities })),
    ],
    [r],
  );
  const ranked = useMemo(() => [...r.results].sort((a, b) => a.distribution_distance - b.distribution_distance), [r.results]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <>
      <div className="metrics">
        <Metric label="Circuit" value={r.circuit} />
        <Metric label="Qubits" value={r.n_qubits} />
        <Metric label="Shots" value={r.shots.toLocaleString()} />
        {best && <Metric label="Closest to ideal" value={`${modeLabel(best.noise_mode)} · ${num4(best.distribution_distance)}`} />}
        {worst && ranked.length > 1 && <Metric label="Furthest from ideal" value={`${modeLabel(worst.noise_mode)} · ${num4(worst.distribution_distance)}`} />}
      </div>

      <h3>TVD by noise mode</h3>
      <TvdBars rows={ranked.map((x) => ({ key: x.noise_mode, label: modeLabel(x.noise_mode), color: modeColor(x.noise_mode), value: x.distribution_distance }))} />

      <BarChart title="Outcome probabilities vs ideal" series={series} maxBars={12} />

      <div className="table-wrap">
        <table>
          <thead><tr><th>Noise mode</th><th className="num">TVD</th><th>Most likely outcomes</th></tr></thead>
          <tbody>
            {r.results.map((x) => (
              <tr key={x.noise_mode}>
                <td><i className="dot" style={{ background: modeColor(x.noise_mode) }} />{modeLabel(x.noise_mode)}</td>
                <td className="num mono">{num4(x.distribution_distance)}</td>
                <td className="mono small-text">{sortedEntries(x.counts).slice(0, 3).map(([b, c]) => `${b}: ${c} (${pct(x.probabilities[b] ?? 0, 1)})`).join('  ·  ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TvdNote />
    </>
  );
}
