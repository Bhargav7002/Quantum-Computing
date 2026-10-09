from fastapi import APIRouter

router = APIRouter(tags=["circuits"])


@router.get("/circuits")
def list_circuits():
    # These constraints describe the actual circuit builders in app/core/simulator.py.
    return {
        "circuits": [
            {
                "id": "bell",
                "label": "Bell",
                "description": "Creates a Bell pair on qubits 0 and 1; extra qubits are initialized to |1> by the original implementation.",
                "min_qubits": 2,
                "max_qubits": 8,
                "supports_custom_layers": False,
            },
            {
                "id": "ghz",
                "label": "GHZ",
                "description": "Creates a multi-qubit GHZ state.",
                "min_qubits": 2,
                "max_qubits": 8,
                "supports_custom_layers": False,
            },
            {
                "id": "qft_like",
                "label": "QFT-like",
                "description": "Compact interference circuit; omits the final swaps of a full QFT.",
                "min_qubits": 1,
                "max_qubits": 8,
                "supports_custom_layers": False,
            },
            {
                "id": "custom",
                "label": "Custom layered",
                "description": "Parameterized RY/RZ rotations and nearest-neighbor entangling layers.",
                "min_qubits": 1,
                "max_qubits": 8,
                "supports_custom_layers": True,
                "min_layers": 1,
                "max_layers": 10,
            },
        ]
    }
