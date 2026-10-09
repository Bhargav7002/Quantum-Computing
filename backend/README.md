# Quantum System Simulation Platform — Backend (V2)

FastAPI + Qiskit Aer backend for the React frontend. This is a separate V2 implementation; do not replace or edit the existing Streamlit project while building it.

## Requirements

- Python 3.11 recommended
- A virtual environment dedicated to this backend

## Windows PowerShell setup

```powershell
cd path\to\quantum-system-simulation-platform-v2\backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, you can run without activating:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Verify

- Health: http://localhost:8000/api/health
- Circuit catalogue: http://localhost:8000/api/circuits
- Interactive OpenAPI docs: http://localhost:8000/docs

## Endpoints

- `GET /api/health`
- `GET /api/circuits`
- `POST /api/simulation/run`
- `POST /api/analysis/noise-comparison`
- `POST /api/analysis/depth-sweep`

Request/response fields, units, enum strings, bitstring ordering and metric definitions must follow `../docs/api-contract.md` in the full V2 repository. The backend is the source of truth for scientific metrics.

## Run tests

```powershell
pytest -q
```

## Scientific notes

- Counts are shot-based samples, not exact probabilities.
- Total variation distance is computed against the ideal sampled distribution for the same circuit/settings.
- `success_probability` is `null` until a circuit-specific success criterion is defined.
- The QFT-like circuit is not claimed to be a full QFT implementation.
- Noise comparison results apply only to the selected simulator models and parameters; they do not prove a universal real-hardware dominant noise mechanism.
