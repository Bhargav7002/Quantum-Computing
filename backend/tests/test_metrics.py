from app.core.metrics import normalize_counts, total_variation_distance


def test_normalize_counts():
    result = normalize_counts({"00": 3, "11": 1})
    assert result == {"00": 0.75, "11": 0.25}


def test_tvd_identical_distributions_is_zero():
    assert total_variation_distance({"00": 0.5, "11": 0.5}, {"00": 0.5, "11": 0.5}) == 0.0


def test_tvd_disjoint_distributions_is_one():
    assert total_variation_distance({"00": 1.0}, {"11": 1.0}) == 1.0


def test_tvd_handles_missing_keys():
    assert total_variation_distance({"00": 1.0}, {"00": 0.5, "11": 0.5}) == 0.5



def test_normalize_empty_counts():
    from app.core.metrics import normalize_counts

    assert normalize_counts({}) == {}


def test_tvd_with_missing_distribution():
    from app.core.metrics import total_variation_distance

    assert total_variation_distance(None, {"00": 1.0}) is None
    assert total_variation_distance({"00": 1.0}, None) is None
