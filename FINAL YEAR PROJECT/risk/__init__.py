"""HealthNet risk engine: published risk equations and screeners, run on a health profile.

Every score is an educational estimate, not a diagnosis. Sources and licences: CITATIONS.md.
"""
from . import findrisc, framingham_htn, ml_diabetes, prevent, screeners, who_cvd
from .profile import Profile

VERSION = "1.0.0"

DISCLAIMER = (
    "These are educational estimates from published risk models, not a diagnosis. "
    "Talk to a doctor or nurse about your results before making health decisions."
)

CALCULATORS = {
    "bodyComposition": screeners.body_composition,
    "whoCvd": who_cvd.assess,
    "prevent": prevent.assess,
    "framinghamHtn": framingham_htn.assess,
    "findrisc": findrisc.assess,
    "mlDiabetes": ml_diabetes.assess,
    "phq4": screeners.phq4,
    "stopBang": screeners.stop_bang,
    "auditC": screeners.audit_c,
}


def assess(profile: Profile):
    """Every score for one profile, keyed by score id (the same ids the frontend uses)."""
    return {
        "engineVersion": VERSION,
        "scores": {score_id: calculate(profile) for score_id, calculate in CALCULATORS.items()},
        "disclaimer": DISCLAIMER,
    }


__all__ = ["CALCULATORS", "DISCLAIMER", "Profile", "VERSION", "assess"]
