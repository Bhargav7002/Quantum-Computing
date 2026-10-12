# Quantum Simulation Platform V2 — Frontend

React + TypeScript + Vite. Built against `docs/api-contract.md` (API v1.0.0).

## Run
```bash
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev               # must be http://localhost:5173 (backend CORS allow-list)
```
Start the backend first (`http://127.0.0.1:8000`). `npm run build` typechecks and builds.

## Layout
- `src/types/api.ts` – request/response types copied from the contract
- `src/services/api.ts` – the only place that calls `fetch`; typed errors (validation / server / network / unknown)
- `src/utils/validation.ts` – client-side limit checks (backend stays authoritative)
- `src/pages/` – Simulation, Noise comparison, Depth sweep
- `src/components/Charts.tsx` – dependency-free SVG charts
- `src/mocks/` – **temporary** mock data, only active with `VITE_USE_MOCKS=true`; delete once the real API is connected

## Contract rules the UI follows
- `custom_layers` is sent only for the `custom` circuit
- `ideal` is never sent in `noise_modes`; depths are sent unique and ascending
- `distribution_distance` is labelled TVD; `null` is shown as "—"
- Circuit list and limits come from `GET /api/circuits` (contract fallback if unreachable)
