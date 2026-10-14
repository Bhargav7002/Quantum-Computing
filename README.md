# Quantum System Simulation Platform

A web platform for simulating multi-qubit quantum circuits, inspecting measurement statistics, and comparing how different noise models change the results. Built as a capstone project.

- **Frontend:** React + TypeScript + Vite
- **Backend:** FastAPI + Qiskit Aer
- **API contract:** v1.0.0 (see `frontend/docs/api-contract.md`)

## Live demo

| Part | URL |
| --- | --- |
| Website (frontend) | https://quantum-computing-azure.vercel.app |
| API (backend) | https://qubit-studio.onrender.com |
| API docs (Swagger UI) | https://qubit-studio.onrender.com/docs |

The backend runs on a free hosting tier and goes to sleep when idle. The first request after a quiet period can take 30–60 seconds while it wakes up.

## Features

- **Simulation:** run a circuit and view counts, probabilities and the total variation distance (TVD) against the ideal result.
- **Noise comparison:** run one circuit under several noise models and compare the results side by side.
- **Depth sweep:** see how results change as circuit depth increases, for one or more noise models.
- **Overview and Learning lab:** short explanations of the concepts used in the app.

### Circuits

| Circuit | Description |
| --- | --- |
| `bell` | Bell pair on qubits 0 and 1 (2–8 qubits) |
| `ghz` | Multi-qubit GHZ state (2–8 qubits) |
| `qft_like` | Compact interference circuit. It omits the final swaps of a full QFT and is not a complete QFT implementation. |
| `custom` | Layered RY/RZ rotations with nearest-neighbour entangling layers (1–10 layers) |

### Noise models

`ideal`, `depolarizing`, `bit_flip`, `thermal`, `readout`, `combined`

### Limits

| Setting | Range |
| --- | --- |
| Qubits | 1–8 |
| Shots | 1–100,000 |
| Custom layers | 1–10 |
| Depths (sweep) | 1–10, unique and ascending |

## Project structure

```
.
├── backend/               FastAPI + Qiskit Aer API
│   ├── app/
│   │   ├── api/           Route handlers (circuits, simulation, analysis)
│   │   ├── core/          Simulator and metrics
│   │   ├── models/        Request/response schemas (Pydantic)
│   │   └── main.py        App setup, CORS, error handling
│   ├── tests/             Pytest suite (25 tests)
│   └── requirements.txt
└── frontend/              React + TypeScript + Vite app
    ├── src/
    │   ├── pages/         Simulation, noise comparison, depth sweep
    │   ├── components/    Charts, form fields, error banner
    │   ├── services/      api.ts, the only place that calls the backend
    │   └── types/         Types matching the API contract
    └── docs/              API contract
```

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service status |
| GET | `/api/circuits` | Circuit catalogue and limits |
| POST | `/api/simulation/run` | Run one simulation |
| POST | `/api/analysis/noise-comparison` | Compare noise models |
| POST | `/api/analysis/depth-sweep` | Sweep circuit depth |

Errors use one consistent shape: `{ "error": { "code", "message", "details": [] } }`. Full request and response fields are in `frontend/docs/api-contract.md`, and an interactive version is available at `/docs` on the running backend.

## Run it locally

You need two terminals, one for each part. The frontend talks to the backend, so start the backend first.

### Requirements

- Python 3.11 or newer (3.11 recommended; the backend was also tested on 3.13)
- Node.js 18 or newer (tested on Node 22)

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check it at http://127.0.0.1:8000/api/health and http://127.0.0.1:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173. The dev server must stay on port 5173, because the backend only accepts requests from allowed origins.

### Run the tests

```bash
cd backend
pytest -q
```

### Build the frontend

```bash
cd frontend
npm run build      # typechecks, then builds into dist/
```

## Configuration

### Backend (`backend/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of website addresses allowed to call the API. Set it to the deployed frontend URL in production, with no trailing slash. |

### Frontend (`frontend/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Address of the backend, with no trailing slash. It is read at build time, so redeploy the frontend after changing it. |
| `VITE_USE_MOCKS` | `false` | Set to `true` to use built-in mock data instead of the API. |

## Deployment

The two parts are deployed separately.

**Backend on Render**

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variable: `CORS_ORIGINS` = your frontend URL

**Frontend on Vercel**

- Root Directory: `frontend` (Vite preset, build command `npm run build`, output `dist`)
- Environment variable: `VITE_API_BASE_URL` = your backend URL

Deploy the frontend as a single project. Do not use the multi-service import option, because the backend is hosted separately on Render.

## Scientific notes

- Counts are shot-based samples, not exact probabilities.
- Total variation distance is computed against the ideal sampled distribution for the same circuit and settings.
- `success_probability` is `null` until a circuit-specific success criterion is defined.
- Noise comparison results apply only to the selected simulator models and parameters. They do not prove a universal dominant noise mechanism on real hardware.
- The backend is the source of truth for all scientific metrics.

## Known limitations

- On free hosting tiers the backend has limited CPU and memory. The heaviest requests (8 qubits, 100,000 shots, a 10-depth sweep across all noise modes) can take much longer than on a normal computer. Use smaller settings for demos if requests time out.
- The frontend gives up on a request after 60 seconds.

## Team

K. Jnanendra
V.S.R Bhargav
