from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.analysis import router as analysis_router
from app.api.circuits import router as circuits_router
from app.api.simulation import router as simulation_router

app = FastAPI(
    title="Quantum System Simulation API",
    version="1.0.0",
    description=(
        "REST API for multi-qubit circuit simulation, measurement statistics, "
        "and configurable noise/decoherence experiments."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = []
    for err in exc.errors():
        loc = [str(part) for part in err.get("loc", []) if part != "body"]
        details.append({
            "field": ".".join(loc) or "request",
            "message": err.get("msg", "Invalid value"),
        })
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request contains invalid fields.",
                "details": details,
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        payload = detail
    else:
        payload = {
            "error": {
                "code": "REQUEST_ERROR",
                "message": str(detail),
                "details": [],
            }
        }
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    # Keep internal exception details in server logs, not in the browser response.
    import logging
    logging.getLogger("quantum_api").exception("Unhandled API error")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "SIMULATION_ERROR",
                "message": "The simulation could not be completed. Check backend logs.",
                "details": [],
            }
        },
    )


@app.get("/api/health")
def health():
    try:
        import qiskit
        import qiskit_aer  # noqa: F401
        simulator = "qiskit_aer"
        status = "ok"
    except Exception:
        simulator = "unavailable"
        status = "degraded"
    return {
        "status": status,
        "service": "quantum-simulation-api",
        "version": app.version,
        "simulator": simulator,
    }


app.include_router(circuits_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
