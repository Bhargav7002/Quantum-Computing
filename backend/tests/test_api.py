
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "quantum-simulation-api"
    assert data["simulator"] == "qiskit_aer"


def test_circuits_endpoint():
    response = client.get("/api/circuits")

    assert response.status_code == 200
    circuit_ids = [item["id"] for item in response.json()["circuits"]]
    assert circuit_ids == ["bell", "ghz", "qft_like", "custom"]


def test_ideal_bell_simulation():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 200,
            "noise_mode": "ideal",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["circuit"] == "bell"
    assert data["n_qubits"] == 2
    assert sum(data["counts"].values()) == 200
    assert abs(sum(data["probabilities"].values()) - 1.0) < 1e-9
    assert data["metrics"]["distribution_distance"] == 0.0


def test_bell_rejects_one_qubit():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "bell",
            "n_qubits": 1,
            "shots": 100,
            "noise_mode": "ideal",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_invalid_noise_mode_is_rejected():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 100,
            "noise_mode": "invalid_mode",
        },
    )

    assert response.status_code == 422


def test_noise_comparison_endpoint():
    response = client.post(
        "/api/analysis/noise-comparison",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 200,
            "noise_modes": ["depolarizing", "readout"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    assert {item["noise_mode"] for item in data["results"]} == {
        "depolarizing",
        "readout",
    }


def test_depth_sweep_endpoint():
    response = client.post(
        "/api/analysis/depth-sweep",
        json={
            "n_qubits": 2,
            "shots": 200,
            "depths": [1, 2],
            "noise_modes": ["combined"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    assert [item["depth"] for item in data["results"]] == [1, 2]



def test_invalid_qubit_count_returns_validation_error():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "qft_like",
            "n_qubits": 0,
            "shots": 100,
            "noise_mode": "ideal",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert data["error"]["details"]


def test_invalid_noise_comparison_mode_returns_validation_error():
    response = client.post(
        "/api/analysis/noise-comparison",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 100,
            "noise_modes": ["invalid_mode"],
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_invalid_t2_t1_relationship_is_rejected():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 100,
            "noise_mode": "combined",
            "noise": {
                "t1_us": 10.0,
                "t2_us": 25.0,
            },
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_noise_comparison_distance_is_in_valid_range():
    response = client.post(
        "/api/analysis/noise-comparison",
        json={
            "circuit": "bell",
            "n_qubits": 2,
            "shots": 300,
            "noise_modes": [
                "depolarizing",
                "bit_flip",
                "thermal",
                "readout",
                "combined",
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 5

    for result in data["results"]:
        distance = result["distribution_distance"]
        assert 0.0 <= distance <= 1.0


        
def test_depth_sweep_rejects_unsorted_depths():
    response = client.post(
        "/api/analysis/depth-sweep",
        json={
            "n_qubits": 2,
            "shots": 100,
            "depths": [3, 1, 2],
            "noise_modes": ["combined"],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_depth_sweep_returns_each_requested_depth():
    response = client.post(
        "/api/analysis/depth-sweep",
        json={
            "n_qubits": 2,
            "shots": 100,
            "depths": [1, 2, 3],
            "noise_modes": ["combined"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 3
    assert [item["depth"] for item in data["results"]] == [1, 2, 3]



def test_custom_circuit_uses_default_layers():
    response = client.post(
        "/api/simulation/run",
        json={
            "circuit": "custom",
            "n_qubits": 2,
            "shots": 100,
            "noise_mode": "ideal",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["circuit"] == "custom"
    assert data["custom_layers"] is None
    assert data["counts"]
    assert sum(data["counts"].values()) == 100



def test_analysis_rejects_invalid_circuit_qubit_count():
    response = client.post(
        "/api/analysis/noise-comparison",
        json={
            "circuit": "ghz",
            "n_qubits": 1,
            "shots": 100,
            "noise_modes": ["combined"],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"



from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_unexpected_exception_returns_safe_error_response():
    test_app = FastAPI()

    @test_app.get("/test-error")
    def trigger_error():
        raise RuntimeError("Internal test-only error")

    from app.main import unexpected_exception_handler

    test_app.add_exception_handler(Exception, unexpected_exception_handler)

    with TestClient(test_app, raise_server_exceptions=False) as test_client:
        response = test_client.get("/test-error")

    assert response.status_code == 500
    data = response.json()
    assert data["error"]["code"] == "SIMULATION_ERROR"
    assert "Internal test-only error" not in response.text
