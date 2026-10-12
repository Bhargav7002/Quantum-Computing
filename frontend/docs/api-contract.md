# Quantum System Simulation Platform V2 — API Contract

**Status:** Integration contract based on the uploaded FastAPI backend source  
**API version:** `1.0.0`  
**Backend base URL (local development):** `http://127.0.0.1:8000`  
**Frontend development origins allowed by CORS:** `http://localhost:5173`, `http://127.0.0.1:5173`

This document describes the current backend behavior for frontend integration. It does not change backend code. If implementation behavior changes, update this contract and notify both frontend and backend contributors.

## 1. Integration rules

- Use JSON request bodies and JSON responses for `POST` endpoints.
- Use the exact endpoint paths, enum values, and property names below.
- Bitstrings are returned in Qiskit's order, documented as `q[n-1]_to_q[0]` (the leftmost bit corresponds to the highest-index qubit).
- Counts are shot counts. Probability maps are normalized from the observed counts and can vary between runs because sampling is finite.
- `distribution_distance` is total variation distance (TVD): `0.5 * sum(abs(P(x) - Q(x)))`, with missing bitstrings treated as probability zero. It ranges from 0 to 1.
- Current ideal references are sampled using the same number of shots, not computed from exact statevector probabilities. A measured TVD can therefore include finite-shot sampling variation.
- A depth sweep does not promise that TVD increases monotonically with depth.

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend and simulator health |
| `GET` | `/api/circuits` | Circuit catalogue and supported limits |
| `POST` | `/api/simulation/run` | Run one circuit simulation |
| `POST` | `/api/analysis/noise-comparison` | Compare selected noise modes against an ideal sampled reference |
| `POST` | `/api/analysis/depth-sweep` | Compare custom-circuit depths under selected noise modes |

Interactive API documentation is available at `http://127.0.0.1:8000/docs` while the backend is running.

## 3. Health

### `GET /api/health`

Example response:

```json
{
  "status": "ok",
  "service": "quantum-simulation-api",
  "version": "1.0.0",
  "simulator": "qiskit_aer"
}
```

`status` is normally `ok`; the implementation can return `degraded` and simulator `unavailable` if importing the simulator dependencies fails.

## 4. Circuit catalogue

### `GET /api/circuits`

Response shape:

```json
{
  "circuits": [
    {
      "id": "bell",
      "label": "Bell",
      "description": "Creates a Bell pair on qubits 0 and 1; extra qubits are initialized to |1> by the original implementation.",
      "min_qubits": 2,
      "max_qubits": 8,
      "supports_custom_layers": false
    },
    {
      "id": "ghz",
      "label": "GHZ",
      "description": "Creates a multi-qubit GHZ state.",
      "min_qubits": 2,
      "max_qubits": 8,
      "supports_custom_layers": false
    },
    {
      "id": "qft_like",
      "label": "QFT-like",
      "description": "Compact interference circuit; omits the final swaps of a full QFT.",
      "min_qubits": 1,
      "max_qubits": 8,
      "supports_custom_layers": false
    },
    {
      "id": "custom",
      "label": "Custom layered",
      "description": "Parameterized RY/RZ rotations and nearest-neighbor entangling layers.",
      "min_qubits": 1,
      "max_qubits": 8,
      "supports_custom_layers": true,
      "min_layers": 1,
      "max_layers": 10
    }
  ]
}
```

Use the `id` values as request `circuit` values. Do not send `custom_layers` for non-custom circuits.

## 5. Shared request fields

### Circuit IDs

- `bell`
- `ghz`
- `qft_like`
- `custom`

### Noise modes

For `/api/simulation/run`, `noise_mode` accepts:
- `ideal`
- `depolarizing`
- `bit_flip`
- `thermal`
- `readout`
- `combined`

For noise comparison and depth sweep, `noise_modes` accepts one or more of:
- `depolarizing`
- `bit_flip`
- `thermal`
- `readout`
- `combined`

`ideal` is not a valid entry in `noise_modes`; the backend generates the ideal reference internally for those analysis endpoints.

### Noise configuration

All request endpoints that accept noise can use this object. All properties are optional; omitted properties use the defaults below.

```json
{
  "p1": 0.001,
  "p2": 0.01,
  "p_readout": 0.01,
  "t1_us": 100.0,
  "t2_us": 80.0,
  "gate_1_us": 0.05,
  "gate_2_us": 0.30
}
```

| Field | Default | Validation | Meaning |
|---|---:|---|---|
| `p1` | `0.001` | 0–1 inclusive | One-qubit noise probability |
| `p2` | `0.01` | 0–1 inclusive | Two-qubit depolarizing probability |
| `p_readout` | `0.01` | 0–1 inclusive | Symmetric readout-flip probability |
| `t1_us` | `100.0` | greater than 0, at most 1,000,000 | T1 in microseconds |
| `t2_us` | `80.0` | greater than 0, at most 1,000,000 and `t2_us <= 2 * t1_us` | T2 in microseconds |
| `gate_1_us` | `0.05` | greater than 0, at most 100,000 | One-qubit gate duration in microseconds |
| `gate_2_us` | `0.30` | greater than 0, at most 100,000 | Two-qubit gate duration in microseconds |

Noise-mode implementation note: `depolarizing` applies depolarizing quantum errors; `bit_flip` applies bit-flip errors; `thermal` applies thermal relaxation; `readout` applies readout error; `combined` applies depolarizing, thermal-relaxation, and readout errors together. The configured parameters do not all affect every mode (for example, `p_readout` is relevant to `readout` and `combined`).

## 6. Run a simulation

### `POST /api/simulation/run`

Example request:

```json
{
  "circuit": "bell",
  "n_qubits": 2,
  "shots": 2000,
  "noise_mode": "ideal",
  "noise": {
    "p1": 0.001,
    "p2": 0.01,
    "p_readout": 0.01,
    "t1_us": 100.0,
    "t2_us": 80.0,
    "gate_1_us": 0.05,
    "gate_2_us": 0.30
  },
  "include_ideal_reference": true
}
```

Request fields:

| Field | Required? | Default / constraints |
|---|---|---|
| `circuit` | Yes | One of the four circuit IDs |
| `n_qubits` | Yes | Integer 1–8; Bell and GHZ require at least 2 |
| `shots` | No | `2000`; integer 1–100,000 |
| `noise_mode` | No | `ideal`; one of the six simulation noise modes |
| `noise` | No | Defaults to the shared noise configuration |
| `custom_layers` | No | `null` by default; integer 1–10, only allowed for `custom` |
| `include_ideal_reference` | No | `true` |

Response shape (illustrative; count values and probabilities vary per run):

```json
{
  "run_id": "a-generated-uuid",
  "circuit": "bell",
  "n_qubits": 2,
  "shots": 2000,
  "noise_mode": "ideal",
  "custom_layers": null,
  "circuit_depth": 2,
  "gate_count": 2,
  "bitstring_order": "q[n-1]_to_q[0]",
  "counts": {"00": 1001, "11": 999},
  "probabilities": {"00": 0.5005, "11": 0.4995},
  "ideal_counts": {"00": 1001, "11": 999},
  "ideal_probabilities": {"00": 0.5005, "11": 0.4995},
  "metrics": {"distribution_distance": 0.0, "success_probability": null},
  "metadata": {
    "simulator": "qiskit_aer",
    "metric_definition": "total_variation_distance",
    "status": "completed"
  }
}
```

The response example is illustrative, not a guaranteed deterministic output. If `noise_mode` is `ideal`, the response's ideal reference equals the primary sampled distribution. If `noise_mode` is noisy and `include_ideal_reference` is `false`, `ideal_counts` and `ideal_probabilities` are `null`, and `metrics.distribution_distance` is `null`.

## 7. Compare noise models

### `POST /api/analysis/noise-comparison`

Example request:

```json
{
  "circuit": "bell",
  "n_qubits": 2,
  "shots": 2000,
  "noise": {
    "p1": 0.01,
    "p2": 0.03,
    "p_readout": 0.02,
    "t1_us": 100.0,
    "t2_us": 80.0,
    "gate_1_us": 0.05,
    "gate_2_us": 0.30
  },
  "noise_modes": ["depolarizing", "bit_flip", "thermal", "readout", "combined"]
}
```

Request constraints:
- `circuit`: one of the four circuit IDs.
- `n_qubits`: 1–8; Bell and GHZ require at least 2.
- `shots`: defaults to 2000; 1–100,000.
- `noise`: optional shared noise configuration.
- `custom_layers`: optional 1–10, only for `custom`.
- `noise_modes`: 1–5 unique supported comparison modes; defaults to all five modes.

Response shape:

```json
{
  "circuit": "bell",
  "n_qubits": 2,
  "shots": 2000,
  "bitstring_order": "q[n-1]_to_q[0]",
  "ideal_probabilities": {"00": 0.5, "11": 0.5},
  "results": [
    {
      "noise_mode": "depolarizing",
      "counts": {"00": 962, "11": 1005, "01": 18, "10": 15},
      "probabilities": {"00": 0.481, "11": 0.5025, "01": 0.009, "10": 0.0075},
      "distribution_distance": 0.0195
    }
  ],
  "metric_definition": "total_variation_distance"
}
```

`results` contains one entry per requested noise mode. The example contains one result only to illustrate the entry shape; actual output contains every requested mode.

## 8. Circuit-depth sweep

### `POST /api/analysis/depth-sweep`

This endpoint sweeps the built-in `custom` circuit over the requested layer depths.

Example request:

```json
{
  "n_qubits": 3,
  "shots": 1000,
  "noise": {
    "p1": 0.01,
    "p2": 0.03,
    "p_readout": 0.02,
    "t1_us": 100.0,
    "t2_us": 80.0,
    "gate_1_us": 0.05,
    "gate_2_us": 0.30
  },
  "depths": [1, 2, 3, 4, 5],
  "noise_modes": ["combined"]
}
```

Request constraints:
- `n_qubits`: integer 1–8.
- `shots`: defaults to 2000; integer 1–100,000.
- `noise`: optional shared noise configuration.
- `depths`: 1–10 unique integers, each 1–10, in ascending order; defaults to `[1, 2, 3, 4, 5, 6]`.
- `noise_modes`: 1–5 unique comparison modes; defaults to `["combined"]`.

Response shape:

```json
{
  "n_qubits": 3,
  "shots": 1000,
  "noise_modes": ["combined"],
  "metric_definition": "total_variation_distance",
  "results": [
    {
      "depth": 1,
      "noise_mode": "combined",
      "ideal_probabilities": {"000": 0.5, "111": 0.5},
      "noisy_probabilities": {"000": 0.45, "111": 0.43, "001": 0.07, "110": 0.05},
      "distribution_distance": 0.12
    }
  ]
}
```

The response `results` array contains one entry for every requested depth × noise-mode pair. Example probability values are illustrative.

## 9. Errors and frontend handling

### Current error behavior

The application uses HTTP status codes and JSON error bodies. Request-schema validation errors return HTTP `422` in this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [{"field": "n_qubits", "message": "Input should be less than or equal to 8"}]
  }
}
```

An application-level `ValueError` from the simulation endpoint returns HTTP `422` in the same broad envelope, with its message and an empty `details` array. Application-level `ValueError` from either analysis endpoint currently becomes HTTP `422` with:

```json
{
  "error": {
    "code": "REQUEST_ERROR",
    "message": "The error message",
    "details": []
  }
}
```

Unexpected exceptions return HTTP `500`:

```json
{
  "error": {
    "code": "SIMULATION_ERROR",
    "message": "The simulation could not be completed. Check backend logs.",
    "details": []
  }
}
```

### Important integration note

Error codes are currently inconsistent for equivalent application-level `ValueError`s (`VALIDATION_ERROR` for simulation versus `REQUEST_ERROR` for analysis). This contract records the current behavior; it does not claim the inconsistency has been fixed. The frontend should display the returned `error.message` when present and should handle unknown error shapes defensively. Before a future breaking change, agree on a unified error envelope and update both the backend and this document.

For network errors (backend unavailable, timeout, or CORS rejection), there may be no JSON error body. The frontend should show a user-friendly connection error.

## 10. CORS and local development

Backend local URL: `http://127.0.0.1:8000`  
Swagger UI: `http://127.0.0.1:8000/docs`

Allowed frontend origins:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

Allowed methods: `GET`, `POST`, `OPTIONS`. Allowed request headers: all (`*`). Credentials are disabled. If the frontend uses a different development port or a deployed domain, the backend CORS allow-list must be updated intentionally.

## 11. Frontend implementation checklist

- Create TypeScript types that match these request and response fields.
- Keep API calls in a shared service module (for example, `src/services/api.ts`).
- Keep the API base URL configurable (for example, through a Vite environment variable such as `VITE_API_BASE_URL`) rather than scattering it through components.
- Read the circuit catalogue from `GET /api/circuits` rather than duplicating labels and limits where practical.
- Validate obvious input limits in the UI for usability, but treat backend validation as authoritative.
- Display counts and probabilities from API responses; do not hardcode results.
- Display `distribution_distance` as TVD and label it clearly.
- Treat missing `ideal_counts`, `ideal_probabilities`, and `distribution_distance` as `null` when the ideal reference is disabled for a noisy simulation.
- Distinguish loading, success, API validation errors, server errors, and network errors.
- Mock data is acceptable during layout work only if clearly labelled as temporary and replaced when the real API is connected.

## 12. Scope and compatibility

This document describes the uploaded backend implementation, not a promise of unimplemented features. It does not introduce authentication, persistence, job queues, streaming, or additional endpoints. Keep the original Streamlit project separate and unchanged; all React/FastAPI V2 integration work belongs in the V2 repository.

---
**Contract ownership:** Backend and frontend contributors should both use this document as the shared integration reference. If a request or response field changes, coordinate the change and update this file before merging frontend/backend changes.
