from typing import Literal
from pydantic import BaseModel, Field, model_validator

CircuitId = Literal["bell", "ghz", "qft_like", "custom"]
NoiseMode = Literal["ideal", "depolarizing", "bit_flip", "thermal", "readout", "combined"]
ComparisonNoiseMode = Literal["depolarizing", "bit_flip", "thermal", "readout", "combined"]


class NoiseConfig(BaseModel):
    p1: float = Field(default=0.001, ge=0, le=1, description="One-qubit noise probability")
    p2: float = Field(default=0.01, ge=0, le=1, description="Two-qubit depolarizing probability")
    p_readout: float = Field(default=0.01, ge=0, le=1, description="Symmetric readout-flip probability")
    t1_us: float = Field(default=100.0, gt=0, le=1_000_000, description="T1 in microseconds")
    t2_us: float = Field(default=80.0, gt=0, le=1_000_000, description="T2 in microseconds")
    gate_1_us: float = Field(default=0.05, gt=0, le=100_000, description="One-qubit gate duration in microseconds")
    gate_2_us: float = Field(default=0.30, gt=0, le=100_000, description="Two-qubit gate duration in microseconds")

    @model_validator(mode="after")
    def validate_t2(self):
        if self.t2_us > 2 * self.t1_us:
            raise ValueError("T2 must be less than or equal to 2*T1.")
        return self


class SimulationRequest(BaseModel):
    circuit: CircuitId
    n_qubits: int = Field(ge=1, le=8)
    shots: int = Field(default=2000, ge=1, le=100_000)
    noise_mode: NoiseMode = "ideal"
    noise: NoiseConfig = Field(default_factory=NoiseConfig)
    custom_layers: int | None = Field(default=None, ge=1, le=10)
    include_ideal_reference: bool = True

    @model_validator(mode="after")
    def validate_circuit_constraints(self):
        if self.circuit in {"bell", "ghz"} and self.n_qubits < 2:
            raise ValueError(f"{self.circuit} circuit requires at least 2 qubits.")
        if self.circuit != "custom" and self.custom_layers is not None:
            # Accepting this field for other circuits could mislead users; reject it explicitly.
            raise ValueError("custom_layers is only valid when circuit='custom'.")
        return self


class NoiseComparisonRequest(BaseModel):
    circuit: CircuitId
    n_qubits: int = Field(ge=1, le=8)
    shots: int = Field(default=2000, ge=1, le=100_000)
    noise: NoiseConfig = Field(default_factory=NoiseConfig)
    custom_layers: int | None = Field(default=None, ge=1, le=10)
    noise_modes: list[ComparisonNoiseMode] = Field(
        default_factory=lambda: ["depolarizing", "bit_flip", "thermal", "readout", "combined"],
        min_length=1,
        max_length=5,
    )

    @model_validator(mode="after")
    def validate_request(self):
        if self.circuit in {"bell", "ghz"} and self.n_qubits < 2:
            raise ValueError(f"{self.circuit} circuit requires at least 2 qubits.")
        if self.circuit != "custom" and self.custom_layers is not None:
            raise ValueError("custom_layers is only valid when circuit='custom'.")
        if len(set(self.noise_modes)) != len(self.noise_modes):
            raise ValueError("noise_modes must not contain duplicates.")
        return self


class DepthSweepRequest(BaseModel):
    n_qubits: int = Field(ge=1, le=8)
    shots: int = Field(default=2000, ge=1, le=100_000)
    noise: NoiseConfig = Field(default_factory=NoiseConfig)
    depths: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6], min_length=1, max_length=10)
    noise_modes: list[ComparisonNoiseMode] = Field(default_factory=lambda: ["combined"], min_length=1, max_length=5)

    @model_validator(mode="after")
    def validate_sweep(self):
        if any(depth < 1 or depth > 10 for depth in self.depths):
            raise ValueError("Every depth must be between 1 and 10.")
        if len(set(self.depths)) != len(self.depths):
            raise ValueError("depths must not contain duplicates.")
        if self.depths != sorted(self.depths):
            raise ValueError("depths must be in ascending order.")
        if len(set(self.noise_modes)) != len(self.noise_modes):
            raise ValueError("noise_modes must not contain duplicates.")
        return self
