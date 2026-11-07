"""Messages that need emergency help rather than an explanation.

The app checks the same patterns on the device before anything is sent
(healthnet-frontend/src/assistant/safety.js); this server check is a second line of defence. A match
is answered with emergency and helpline guidance, and the message is not passed to any model.
"""
import re

# code: patterns (matched case-insensitively against the message)
EMERGENCIES = {
    "selfHarm": [
        r"\bkill(ing)? my ?self\b", r"\bsuicid", r"\bend (my|it all)\b.*\blife\b", r"\bend it all\b",
        r"\bself[- ]?harm", r"\bhurt(ing)? my ?self\b", r"\bwant to die\b", r"\bdon'?t want to (live|be alive)\b",
        r"\boverdos",
    ],
    "heart": [
        # Described as happening, so "What is a heart attack risk score?" isn't caught
        r"\bchest (pain|tightness|pressure)\b", r"\bpain in my chest\b", r"\bhaving a heart attack\b",
    ],
    "stroke": [
        r"\bstroke\b.*\b(now|happening|having)\b", r"\b(having|having a) stroke\b", r"\bface (is )?droop",
        r"\bslurred speech\b", r"\bcan'?t (move|feel) (my )?(arm|leg|face)\b", r"\bsudden(ly)? numb",
    ],
    "breathing": [
        r"\bcan'?t breathe\b", r"\bcannot breathe\b", r"\bstruggling to breathe\b", r"\bchoking\b",
    ],
    "unconscious": [r"\bunconscious\b", r"\bpassed out\b", r"\bnot breathing\b", r"\bseizure\b"],
}

_COMPILED = {code: [re.compile(p, re.IGNORECASE) for p in patterns] for code, patterns in EMERGENCIES.items()}


def emergency_in(text):
    """The first emergency code the text matches, or None."""
    for code, patterns in _COMPILED.items():
        if any(p.search(text) for p in patterns):
            return code
    return None
