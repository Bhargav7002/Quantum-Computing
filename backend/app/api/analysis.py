from fastapi import APIRouter, HTTPException

from app.core.simulator import run_depth_sweep, run_noise_comparison
from app.models.schemas import DepthSweepRequest, NoiseComparisonRequest

router = APIRouter(tags=["analysis"])


@router.post("/analysis/noise-comparison")
def noise_comparison(request: NoiseComparisonRequest):
    try:
        return run_noise_comparison(
            circuit_id=request.circuit,
            n_qubits=request.n_qubits,
            shots=request.shots,
            noise=request.noise,
            custom_layers=request.custom_layers,
            noise_modes=list(request.noise_modes),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/analysis/depth-sweep")
def depth_sweep(request: DepthSweepRequest):
    try:
        return run_depth_sweep(
            n_qubits=request.n_qubits,
            shots=request.shots,
            noise=request.noise,
            depths=request.depths,
            noise_modes=list(request.noise_modes),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
