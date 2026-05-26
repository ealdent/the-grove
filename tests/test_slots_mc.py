import importlib.util
import pytest
import sys
from pathlib import Path

# Dynamically import the script since it has a hyphen in the name
script_path = Path(__file__).parent.parent / "scripts" / "slots-mc.py"
spec = importlib.util.spec_from_file_location("slots_mc", script_path)
slots_mc = importlib.util.module_from_spec(spec)
sys.modules["slots_mc"] = slots_mc
spec.loader.exec_module(slots_mc)

from slots_mc import theoretical_ev, Outcome, build_distribution

def test_build_distribution_empty_outcomes():
    """Test build_distribution raises ValueError on empty list."""
    with pytest.raises(ValueError, match="Please paste your previously determined probabilities into OUTCOMES."):
        build_distribution([])

def test_build_distribution_sum_too_high():
    """Test build_distribution raises ValueError when sum of probabilities > 1."""
    outcomes = [
        ("outcome1", 0.6, 1.0),
        ("outcome2", 0.5, 2.0),
    ]
    with pytest.raises(ValueError, match=r"Outcome probabilities sum to 1\.100000 \(>1\)\. Fix your inputs\."):
        build_distribution(outcomes)

def test_theoretical_ev_empty():
    """Test with an empty list of outcomes."""
    assert theoretical_ev([]) == -1.0

def test_theoretical_ev_all_loss():
    """Test with 100% loss probability."""
    dist = [Outcome(name="loss", prob=1.0, mult=0.0)]
    assert theoretical_ev(dist) == -1.0

def test_theoretical_ev_break_even():
    """Test with a break-even scenario (1x multiplier on 100%)."""
    dist = [Outcome(name="push", prob=1.0, mult=1.0)]
    assert theoretical_ev(dist) == 0.0

def test_theoretical_ev_positive():
    """Test scenario with positive expected value."""
    dist = [
        Outcome(name="win", prob=0.5, mult=3.0),
        Outcome(name="loss", prob=0.5, mult=0.0)
    ]
    # (0.5 * 3.0) + (0.5 * 0.0) - 1.0 = 1.5 - 1.0 = 0.5
    assert theoretical_ev(dist) == 0.5

def test_theoretical_ev_negative():
    """Test scenario with negative expected value."""
    dist = [
        Outcome(name="win", prob=0.2, mult=2.0),
        Outcome(name="loss", prob=0.8, mult=0.0)
    ]
    # (0.2 * 2.0) + (0.8 * 0.0) - 1.0 = 0.4 - 1.0 = -0.6
    assert theoretical_ev(dist) == pytest.approx(-0.6)

def test_theoretical_ev_mixed():
    """Test a mixed scenario resembling a real slot."""
    dist = [
        Outcome(name="jackpot", prob=0.01, mult=50.0),
        Outcome(name="win", prob=0.1, mult=5.0),
        Outcome(name="push", prob=0.2, mult=1.0),
        Outcome(name="loss", prob=0.69, mult=0.0)
    ]
    # EV = (0.01*50) + (0.1*5) + (0.2*1) + (0.69*0) - 1.0
    # EV = 0.5 + 0.5 + 0.2 + 0 - 1.0 = 1.2 - 1.0 = 0.2
    assert theoretical_ev(dist) == pytest.approx(0.2)
