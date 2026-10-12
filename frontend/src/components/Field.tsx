import type { ReactNode } from 'react';

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function ChipGroup<T extends string | number>({
  options, selected, onToggle, label, colorOf, ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  label?: string;
  colorOf?: (v: T) => string;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="chips">
      {label && <span className="chips-label">{label}</span>}
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            style={on && colorOf ? { borderColor: colorOf(o.value), boxShadow: `inset 0 0 0 1px ${colorOf(o.value)}` } : undefined}
          >
            {colorOf && <i className="dot" style={{ background: colorOf(o.value) }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
