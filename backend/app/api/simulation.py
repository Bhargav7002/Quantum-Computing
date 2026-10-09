from fastapi import APIRouter, HTTPException

from app.core.simulator import run_simulation
from app.models.schemas import SimulationRequest

router = APIRouter(tags=["simulation"])


@router.post("/simulation/run")
def simulate(request: SimulationRequest):
    try:
        return run_simulation(
            circuit_id=request.circuit,
            n_qubits=request.n_qubits,
            shots=request.shots,
            noise=request.noise,
            noise_mode=request.noise_mode,
            custom_layers=request.custom_layers,
            include_ideal_reference=request.include_ideal_reference,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": str(exc),
                    "details": [],
                }
            },
        ) from exc
