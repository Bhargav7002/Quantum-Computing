from collections.abc import Mapping


def normalize_counts(counts: Mapping[str, int]) -> dict[str, float]:
    total = sum(counts.values())
    if total <= 0:
        return {}
    return {str(bitstring).replace(" ", ""): count / total for bitstring, count in counts.items()}


def total_variation_distance(
    p: Mapping[str, float] | None,
    q: Mapping[str, float] | None,
) -> float | None:
    """TVD = 0.5 * sum_x |P(x)-Q(x)| over the union of support."""
    if p is None or q is None:
        return None
    keys = set(p) | set(q)
    value = 0.5 * sum(abs(float(p.get(k, 0.0)) - float(q.get(k, 0.0))) for k in keys)
    return min(1.0, max(0.0, float(value)))
