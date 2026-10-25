"""The shape every calculator returns, so the frontend can render all scores the same way.

status
  ok              value, unit, category and level are set
  needs_input     `missing` lists the profile fields still needed
  not_applicable  `reason` is a code the frontend translates; `reasonParams` fills it in
level
  0 (best) to 4 (worst), for colour coding
"""


def ok(model, value, *, unit, category, level, details=None, assumptions=()):
    return {
        "status": "ok",
        "value": value,
        "unit": unit,
        "category": category,
        "level": level,
        "details": details or {},
        "assumptions": list(assumptions),
        "model": model,
    }


def needs_input(model, missing):
    return {"status": "needs_input", "missing": list(missing), "model": model}


def not_applicable(model, reason, **params):
    return {"status": "not_applicable", "reason": reason, "reasonParams": params, "model": model}


def band(value, cut_points):
    """Index of the first cut point the value is below, e.g. band(7, [5, 10]) == 1."""
    for index, cut in enumerate(cut_points):
        if value < cut:
            return index
    return len(cut_points)


def percent(probability, decimals=1):
    return round(probability * 100, decimals)
