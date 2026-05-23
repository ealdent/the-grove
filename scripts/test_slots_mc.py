import pytest
import importlib.util
import sys
import math

# Load the target module dynamically due to hyphen in filename
spec = importlib.util.spec_from_file_location("slots_mc", "scripts/slots-mc.py")
slots_mc = importlib.util.module_from_spec(spec)
sys.modules["slots_mc"] = slots_mc
spec.loader.exec_module(slots_mc)

def test_build_distribution_empty():
    with pytest.raises(ValueError, match="Please paste your previously determined probabilities into OUTCOMES."):
        slots_mc.build_distribution([])

def test_build_distribution_sum_too_high():
    outcomes = [
        ("outcome1", 0.6, 1.0),
        ("outcome2", 0.5, 2.0),
    ]
    with pytest.raises(ValueError, match=r"Outcome probabilities sum to 1\.100000 \(>1\)\. Fix your inputs\."):
        slots_mc.build_distribution(outcomes)

def test_build_distribution_exact_sum():
    outcomes = [
        ("outcome1", 0.5, 1.0),
        ("outcome2", 0.5, 2.0),
    ]
    dist = slots_mc.build_distribution(outcomes)

    assert len(dist) == 2
    assert dist[0].name == "outcome1"
    assert math.isclose(dist[0].prob, 0.5)
    assert dist[0].mult == 1.0

    assert dist[1].name == "outcome2"
    assert math.isclose(dist[1].prob, 0.5)
    assert dist[1].mult == 2.0

    assert math.isclose(sum(d.prob for d in dist), 1.0)

def test_build_distribution_with_residual():
    outcomes = [
        ("outcome1", 0.4, 1.0),
        ("outcome2", 0.3, 2.0),
    ]
    dist = slots_mc.build_distribution(outcomes)

    assert len(dist) == 3
    assert dist[0].name == "outcome1"
    assert math.isclose(dist[0].prob, 0.4)

    assert dist[1].name == "outcome2"
    assert math.isclose(dist[1].prob, 0.3)

    # Residual loss
    assert dist[2].name == "loss (residual)"
    assert math.isclose(dist[2].prob, 0.3)  # 1.0 - 0.7
    assert dist[2].mult == 0.0

    assert math.isclose(sum(d.prob for d in dist), 1.0)


@pytest.fixture
def reset_martingale_globals():
    """Reset PARAMS and CONFIG to defaults so martingale tests don't leak state."""
    slots_mc.PARAMS.base_bet = 5000
    slots_mc.PARAMS.loss_mult = 2.0
    slots_mc.PARAMS.treat_push_as_win = False
    slots_mc.CONFIG.max_bet = 250000
    yield


def test_martingale_zero_or_negative_last_bet_returns_base(reset_martingale_globals):
    assert slots_mc.next_bet_martingale(1_000_000, 0, 0.0, 0, 1) == slots_mc.PARAMS.base_bet
    assert slots_mc.next_bet_martingale(1_000_000, -5000, 0.0, 0, 1) == slots_mc.PARAMS.base_bet


def test_martingale_resets_to_base_after_win(reset_martingale_globals):
    # last_mult > 1.0 = win
    assert slots_mc.next_bet_martingale(1_000_000, 20000, 2.0, 1, 0) == 5000


def test_martingale_doubles_after_loss(reset_martingale_globals):
    # last_mult = 0.0 = loss; bet should double
    assert slots_mc.next_bet_martingale(1_000_000, 5000, 0.0, 0, 1) == 10000
    assert slots_mc.next_bet_martingale(1_000_000, 10000, 0.0, 0, 2) == 20000


def test_martingale_caps_at_max_bet(reset_martingale_globals):
    # 200000 * 2 = 400000 but max_bet caps at 250000
    assert slots_mc.next_bet_martingale(1_000_000, 200000, 0.0, 0, 1) == 250000


def test_martingale_push_as_win_resets(reset_martingale_globals):
    slots_mc.PARAMS.treat_push_as_win = True
    # last_mult = 1.0 (push), treated as win => reset
    assert slots_mc.next_bet_martingale(1_000_000, 20000, 1.0, 1, 0) == 5000


def test_martingale_push_as_loss_doubles(reset_martingale_globals):
    # treat_push_as_win defaults to False; 1.0 multiplier counts as loss for progression
    assert slots_mc.next_bet_martingale(1_000_000, 20000, 1.0, 0, 1) == 40000
