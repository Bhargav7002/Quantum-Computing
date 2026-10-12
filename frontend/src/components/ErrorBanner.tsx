import { ApiError } from '../services/api';

const TITLES: Record<ApiError['kind'], string> = {
  validation: 'The backend rejected this request',
  server: 'The backend hit an error',
  network: 'Cannot reach the backend',
  unknown: 'Unexpected response',
};

export function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className={`banner error kind-${error.kind}`} role="alert">
      <div className="banner-head">
        <strong>{TITLES[error.kind]}</strong>
        {error.status ? <span className="tag">HTTP {error.status}</span> : null}
        {error.code ? <span className="tag">{error.code}</span> : null}
      </div>
      <p>{error.message}</p>
      {error.details.length > 0 && (
        <ul>
          {error.details.map((d, i) => (
            <li key={i}>{d.field ? <code>{d.field}</code> : null} {d.message}</li>
          ))}
        </ul>
      )}
      {error.kind === 'server' && <p className="muted">Check the backend logs for the full traceback.</p>}
      {onRetry && <button type="button" className="btn ghost small" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function ValidationSummary({ errors }: { errors: Record<string, string> }) {
  const items = Object.values(errors);
  if (!items.length) return null;
  return (
    <div className="banner warn" role="alert">
      <strong>Fix these inputs first</strong>
      <ul>{items.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>
  );
}
