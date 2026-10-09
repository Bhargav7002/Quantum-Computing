from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, ReadoutError
from qiskit_aer.noise import depolarizing_error, pauli_error, thermal_relaxation_error

from app.core.metrics import normalize_counts, total_variation_distance
from app.models.schemas import NoiseConfig


@dataclass(frozen=True)
class EngineConfig:
    n_qubits: int
    shots: int
    noise: NoiseConfig


def build_circuit(circuit_id: str, n_qubits: int, custom_layers: int | None = None) -> QuantumCircuit:
    if circuit_id == "bell":
        if n_qubits < 2:
            raise ValueError("Bell circuit requires at least 2 qubits.")
        qc = QuantumCircuit(n_qubits, n_qubits)
        qc.h(0)
        qc.cx(0, 1)
        # Preserve the original project's behavior for additional qubits.
        for q in range(2, n_qubits):
            qc.x(q)
    elif circuit_id == "ghz":
        if n_qubits < 2:
            raise ValueError("GHZ circuit requires at least 2 qubits.")
        qc = QuantumCircuit(n_qubits, n_qubits)
        qc.h(0)
        for q in range(1, n_qubits):
            qc.cx(0, q)
    elif circuit_id == "qft_like":
        qc = QuantumCircuit(n_qubits, n_qubits)
        for q in range(n_qubits):
            qc.h(q)
            for k in range(q + 1, n_qubits):
                qc.cp(np.pi / (2 ** (k - q)), k, q)
    elif circuit_id == "custom":
        layers = custom_layers if custom_layers is not None else 3
        if not 1 <= layers <= 10:
            raise ValueError("custom_layers must be between 1 and 10.")
        qc = QuantumCircuit(n_qubits, n_qubits)
        for layer in range(layers):
            for q in range(n_qubits):
                qc.ry(0.35 + 0.07 * layer + 0.03 * q, q)
                qc.rz(0.20 + 0.05 * q, q)
            for q in range(n_qubits - 1):
                qc.cx(q, q + 1)
    else:
        raise ValueError(f"Unsupported circuit: {circuit_id}")

    qc.measure(range(n_qubits), range(n_qubits))
    return qc


def make_noise_model(config: NoiseConfig, mode: str) -> NoiseModel:
    if mode not in {"depolarizing", "bit_flip", "thermal", "readout", "combined"}:
        raise ValueError(f"Unsupported noise mode: {mode}")

    model = NoiseModel()
    one_qubit_gates = ["x", "y", "z", "h", "sx", "rz", "ry", "rx", "u"]
    two_qubit_gates = ["cx", "cz", "swap"]

    if mode in {"combined", "depolarizing"}:
        one_error = depolarizing_error(config.p1, 1)
        two_error = depolarizing_error(config.p2, 2)
        model.add_all_qubit_quantum_error(one_error, one_qubit_gates)
        model.add_all_qubit_quantum_error(two_error, two_qubit_gates)

    if mode == "bit_flip":
        one_error = pauli_error([("X", config.p1), ("I", 1 - config.p1)])
        two_error = one_error.tensor(one_error)
        model.add_all_qubit_quantum_error(one_error, one_qubit_gates)
        model.add_all_qubit_quantum_error(two_error, two_qubit_gates)

    if mode in {"combined", "thermal"}:
        t1 = config.t1_us * 1000.0  # Aer thermal relaxation time unit is ns
        t2 = config.t2_us * 1000.0
        one_error = thermal_relaxation_error(t1, t2, config.gate_1_us * 1000.0)
        two_single = thermal_relaxation_error(t1, t2, config.gate_2_us * 1000.0)
        two_error = two_single.tensor(two_single)
        model.add_all_qubit_quantum_error(one_error, one_qubit_gates)
        model.add_all_qubit_quantum_error(two_error, two_qubit_gates)

    if mode in {"combined", "readout"} and config.p_readout > 0:
        readout = ReadoutError([
            [1 - config.p_readout, config.p_readout],
            [config.p_readout, 1 - config.p_readout],
        ])
        model.add_all_qubit_readout_error(readout)
    return model


def _counts_for(qc: QuantumCircuit, shots: int, noise: NoiseConfig, mode: str) -> dict[str, int]:
    backend = AerSimulator() if mode == "ideal" else AerSimulator(noise_model=make_noise_model(noise, mode))
    compiled = transpile(qc, backend)
    result = backend.run(compiled, shots=shots).result()
    raw = result.get_counts()
    # Qiskit returns keys as strings; remove spaces so the JSON keys are stable.
    return {str(key).replace(" ", ""): int(value) for key, value in raw.items()}


def circuit_metadata(qc: QuantumCircuit) -> tuple[int, int]:
    logical = qc.remove_final_measurements(inplace=False)
    depth = int(logical.depth() or 0)
    ignored = {"barrier", "measure"}
    gate_count = sum(1 for item in logical.data if item.operation.name not in ignored)
    return depth, gate_count


def run_simulation(
    circuit_id: str,
    n_qubits: int,
    shots: int,
    noise: NoiseConfig,
    noise_mode: str,
    custom_layers: int | None,
    include_ideal_reference: bool,
) -> dict:
    qc = build_circuit(circuit_id, n_qubits, custom_layers)
    noisy_counts = _counts_for(qc, shots, noise, noise_mode)
    probabilities = normalize_counts(noisy_counts)

    ideal_counts = None
    ideal_probabilities = None
    if include_ideal_reference and noise_mode != "ideal":
        ideal_counts = _counts_for(qc, shots, noise, "ideal")
        ideal_probabilities = normalize_counts(ideal_counts)
    elif noise_mode == "ideal":
        # For an ideal run, the primary distribution itself is the ideal reference.
        ideal_counts = dict(noisy_counts)
        ideal_probabilities = dict(probabilities)

    distance = total_variation_distance(probabilities, ideal_probabilities) if ideal_probabilities is not None else None
    depth, gate_count = circuit_metadata(qc)
    return {
        "run_id": str(uuid4()),
        "circuit": circuit_id,
        "n_qubits": n_qubits,
        "shots": shots,
        "noise_mode": noise_mode,
        "custom_layers": custom_layers if circuit_id == "custom" else None,
        "circuit_depth": depth,
        "gate_count": gate_count,
        "bitstring_order": "q[n-1]_to_q[0]",
        "counts": noisy_counts,
        "probabilities": probabilities,
        "ideal_counts": ideal_counts,
        "ideal_probabilities": ideal_probabilities,
        "metrics": {
            "distribution_distance": distance,
            "success_probability": None,
        },
        "metadata": {
            "simulator": "qiskit_aer",
            "metric_definition": "total_variation_distance",
            "status": "completed",
        },
    }


def run_noise_comparison(
    circuit_id: str,
    n_qubits: int,
    shots: int,
    noise: NoiseConfig,
    custom_layers: int | None,
    noise_modes: list[str],
) -> dict:
    qc = build_circuit(circuit_id, n_qubits, custom_layers)
    ideal_counts = _counts_for(qc, shots, noise, "ideal")
    ideal_probabilities = normalize_counts(ideal_counts)
    results = []
    for mode in noise_modes:
        counts = _counts_for(qc, shots, noise, mode)
        probabilities = normalize_counts(counts)
        results.append({
            "noise_mode": mode,
            "counts": counts,
            "probabilities": probabilities,
            "distribution_distance": total_variation_distance(ideal_probabilities, probabilities),
        })
    return {
        "circuit": circuit_id,
        "n_qubits": n_qubits,
        "shots": shots,
        "bitstring_order": "q[n-1]_to_q[0]",
        "ideal_probabilities": ideal_probabilities,
        "results": results,
        "metric_definition": "total_variation_distance",
    }


def run_depth_sweep(
    n_qubits: int,
    shots: int,
    noise: NoiseConfig,
    depths: list[int],
    noise_modes: list[str],
) -> dict:
    results = []
    for depth in depths:
        qc = build_circuit("custom", n_qubits, depth)
        ideal_counts = _counts_for(qc, shots, noise, "ideal")
        ideal_probabilities = normalize_counts(ideal_counts)
        for mode in noise_modes:
            noisy_counts = _counts_for(qc, shots, noise, mode)
            noisy_probabilities = normalize_counts(noisy_counts)
            results.append({
                "depth": depth,
                "noise_mode": mode,
                "ideal_probabilities": ideal_probabilities,
                "noisy_probabilities": noisy_probabilities,
                "distribution_distance": total_variation_distance(ideal_probabilities, noisy_probabilities),
            })
    return {
        "n_qubits": n_qubits,
        "shots": shots,
        "noise_modes": noise_modes,
        "metric_definition": "total_variation_distance",
        "results": results,
    }
