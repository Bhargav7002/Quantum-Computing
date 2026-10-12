import { useState } from 'react';
import type { CircuitInfo } from '../types/api';
import { LIMITS, type CommonForm, type Errors, type NoiseForm } from '../utils/validation';
import { Field } from './Field';

const NOISE_FIELDS: { key: keyof NoiseForm; label: string; hint: string; step: string }[] = [
  { key: 'p1', label: 'p1', hint: 'One-qubit noise probability (0–1)', step: '0.001' },
  { key: 'p2', label: 'p2', hint: 'Two-qubit depolarizing probability (0–1)', step: '0.001' },
  { key: 'p_readout', label: 'p_readout', hint: 'Readout-flip probability (0–1)', step: '0.001' },
  { key: 't1_us', label: 'T1 (µs)', hint: '> 0, at most 1,000,000', step: '1' },
  { key: 't2_us', label: 'T2 (µs)', hint: 'Must be ≤ 2 × T1', step: '1' },
  { key: 'gate_1_us', label: 'gate_1_us (µs)', hint: 'One-qubit gate duration', step: '0.01' },
  { key: 'gate_2_us', label: 'gate_2_us (µs)', hint: 'Two-qubit gate duration', step: '0.01' },
];

export function CommonFields({
  form, onChange, errors, circuits, withCircuit,
}: {
  form: CommonForm;
  onChange: (next: CommonForm) => void;
  errors: Errors;
  circuits: CircuitInfo[];
  /** false on the depth sweep, which always uses the custom circuit. */
  withCircuit: boolean;
}) {
  const [noiseOpen, setNoiseOpen] = useState(false);
  const info = circuits.find((c) => c.id === form.circuit);
  const minQ = withCircuit ? info?.min_qubits ?? LIMITS.qubits.min : LIMITS.qubits.min;
  const maxQ = withCircuit ? info?.max_qubits ?? LIMITS.qubits.max : LIMITS.qubits.max;
  const noiseErrorCount = Object.keys(errors).filter((k) => k.startsWith('noise.')).length;

  return (
    <>
      <div className="grid">
        {withCircuit && (
          <Field label="Circuit" htmlFor="circuit" hint={info?.description}>
            <select id="circuit" value={form.circuit} onChange={(e) => onChange({ ...form, circuit: e.target.value as CommonForm['circuit'] })}>
              {circuits.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Qubits" htmlFor="nq" error={errors.nQubits} hint={`${minQ}–${maxQ}`}>
          <input id="nq" type="number" inputMode="numeric" min={minQ} max={maxQ} step={1} value={form.nQubits} onChange={(e) => onChange({ ...form, nQubits: e.target.value })} />
        </Field>
        <Field label="Shots" htmlFor="shots" error={errors.shots} hint={`${LIMITS.shots.min}–${LIMITS.shots.max.toLocaleString()}`}>
          <input id="shots" type="number" inputMode="numeric" min={LIMITS.shots.min} max={LIMITS.shots.max} step={1} value={form.shots} onChange={(e) => onChange({ ...form, shots: e.target.value })} />
        </Field>
        {withCircuit && info?.supports_custom_layers && (
          <Field label="Layers" htmlFor="layers" error={errors.layers} hint={`${info.min_layers ?? 1}–${info.max_layers ?? 10}`}>
            <input id="layers" type="number" inputMode="numeric" min={info.min_layers ?? 1} max={info.max_layers ?? 10} step={1} value={form.layers} onChange={(e) => onChange({ ...form, layers: e.target.value })} />
          </Field>
        )}
      </div>

      <details className="noise-details" open={noiseOpen || noiseErrorCount > 0} onToggle={(e) => setNoiseOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Noise parameters{noiseErrorCount > 0 && <span className="tag bad">{noiseErrorCount} to fix</span>}</summary>
        <div className="grid noise-grid">
          {NOISE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`noise-${f.key}`} error={errors[`noise.${f.key}`]} hint={f.hint}>
              <input
                id={`noise-${f.key}`}
                type="number"
                inputMode="decimal"
                step={f.step}
                value={form.noise[f.key]}
                onChange={(e) => onChange({ ...form, noise: { ...form.noise, [f.key]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
      </details>
    </>
  );
}
