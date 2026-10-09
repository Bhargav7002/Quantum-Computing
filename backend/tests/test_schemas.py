import pytest
from pydantic import ValidationError

from app.models.schemas import NoiseConfig, SimulationRequest


def test_t2_physical_constraint():
    with pytest.raises(ValidationError):
        NoiseConfig(t1_us=10, t2_us=21)


def test_valid_simulation_request():
    request = SimulationRequest(
        circuit="ghz",
        n_qubits=3,
        shots=100,
        noise_mode="combined",
        noise=NoiseConfig(),
    )
    assert request.n_qubits == 3


def test_bell_needs_two_qubits():
    with pytest.raises(ValidationError):
        SimulationRequest(circuit="bell", n_qubits=1)
