"""Medicine name matching against RxNorm, the US National Library of Medicine's free drug
vocabulary (RxNav REST API, no key needed: https://lhncbc.nlm.nih.gov/RxNav/APIs/).

Used by the prescription reader to tidy up names read by OCR ("metfromin 500" -> metformin 500 MG).
RxNav's approximate search always returns *something*, even for "take after food", so every
candidate is checked here: it must be a real drug concept and its name must resemble what was
written. Unclear names come back unmatched, and the user keeps their own text.

Only the medicine name text is sent to RxNav, never anything about the person.
"""
import re
import time
from difflib import SequenceMatcher

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import current_user

router = APIRouter(prefix="/drugs", tags=["drugs"])

RXNAV = "https://rxnav.nlm.nih.gov/REST"
TIMEOUT_SECONDS = 6
CACHE_SECONDS = 24 * 3600
CACHE_SIZE = 2000
MIN_SIMILARITY = 0.8

# RxNorm term types that are actual medicines (ingredients, brands, clinical and branded drugs, packs)
DRUG_TERM_TYPES = {"IN", "PIN", "MIN", "BN", "SCD", "SBD", "SCDC", "SBDC", "SCDF", "SBDF", "SCDG", "SBDG", "GPCK", "BPCK"}

# International (INN / British) names -> the US names RxNorm uses
US_NAMES = {
    "paracetamol": "acetaminophen",
    "salbutamol": "albuterol",
    "adrenaline": "epinephrine",
    "noradrenaline": "norepinephrine",
    "frusemide": "furosemide",
    "glibenclamide": "glyburide",
    "lignocaine": "lidocaine",
    "pethidine": "meperidine",
    "aciclovir": "acyclovir",
    "amoxycillin": "amoxicillin",
    "cefalexin": "cephalexin",
    "thyroxine": "levothyroxine",
    "co-amoxiclav": "amoxicillin clavulanate",
    "colecalciferol": "cholecalciferol",
    "ciclosporin": "cyclosporine",
    "rifampicin": "rifampin",
    "sodium valproate": "valproate",
    "orphenadrine citrate": "orphenadrine",
}

# Dosage-form words written before the name on prescriptions ("Tab. Metformin")
FORM_PREFIX = re.compile(r"^(?:tab|tabs|tablet|cap|caps|capsule|syp|syr|syrup|inj|injection|oint|cream|drops?|susp|t|c)\b\.?\s*", re.I)

_cache = {}


def _get(path, **params):
    response = requests.get(f"{RXNAV}{path}", params=params, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def clean_query(text):
    """'Tab. Paracetamol 500mg' -> 'acetaminophen 500 mg'"""
    query = FORM_PREFIX.sub("", text.strip().lower())
    query = re.sub(r"(\d)(mg|mcg|g|ml|iu)\b", r"\1 \2", query)
    for international, us in US_NAMES.items():
        query = re.sub(rf"\b{re.escape(international)}\b", us, query)
    return re.sub(r"\s+", " ", query).strip()


# Units and instruction words that can sit on a prescription line but never name a medicine
NOT_A_NAME = {
    "mg", "mcg", "ml", "iu", "gm", "and", "with", "take", "after", "before", "food", "meal", "meals", "daily", "night",
    "morning", "evening", "noon", "once", "twice", "thrice", "times", "day", "days", "week", "weeks", "month", "water",
    "empty", "stomach", "apply", "use", "sos", "needed", "for", "every", "hours", "hrs", "tablet", "tablets", "capsule",
    "capsules", "oral", "dose", "doses", "bedtime", "continue", "stop", "the", "one", "two", "three", "half",
}


def _drug_word(query):
    """The word that names the medicine: the longest word that isn't a unit or an instruction."""
    words = [w for w in re.findall(r"[a-z][a-z\-]+", query) if w not in NOT_A_NAME]
    return max(words, key=len) if words else ""


def similarity(word, name):
    """How closely the written medicine word matches any word of a candidate name (0-1)."""
    if len(word) < 3:
        return 0.0
    candidates = re.findall(r"[a-z][a-z\-]+", name.lower())
    return max((SequenceMatcher(None, word, c).ratio() for c in candidates), default=0.0)


def _ingredients(rxcui, tty):
    if tty in {"IN", "PIN", "MIN"}:
        return None
    related = _get(f"/rxcui/{rxcui}/related.json", tty="IN")
    names = [
        concept["name"]
        for group in related.get("relatedGroup", {}).get("conceptGroup", []) or []
        for concept in group.get("conceptProperties", []) or []
    ]
    return " / ".join(sorted(set(names))) or None


def _search(term, limit, written):
    """Drug concepts for a search term, scored against the word actually written on the prescription."""
    candidates = _get("/approximateTerm.json", term=term, maxEntries=10).get("approximateGroup", {}).get("candidate", []) or []
    # One candidate per concept, best rank first, keeping RxNav's own name for each
    by_rxcui = {}
    for candidate in sorted(candidates, key=lambda c: int(c.get("rank", 99))):
        by_rxcui.setdefault(candidate["rxcui"], candidate)
    matches = []
    for rxcui, candidate in list(by_rxcui.items())[:6]:
        properties = _get(f"/rxcui/{rxcui}/properties.json").get("properties")
        if not properties and candidate.get("source") == "RXNORM" and candidate.get("name"):
            # Older concepts have no properties page; RxNorm's own candidate name is still a drug name
            properties = {"name": candidate["name"], "tty": "SCDC"}
        if not properties or properties.get("tty") not in DRUG_TERM_TYPES:
            continue
        score = similarity(written, properties["name"])
        if score < MIN_SIMILARITY:
            continue
        matches.append({
            "rxcui": rxcui,
            "name": properties["name"],
            "termType": properties["tty"],
            "ingredient": _ingredients(rxcui, properties["tty"]),
            "similarity": round(score, 2),
        })
        if len(matches) >= limit:
            break
    return sorted(matches, key=lambda m: -m["similarity"])


def match_drug(text, limit=3):
    query = clean_query(text)
    if len(_drug_word(query)) < 3:
        return {"query": query, "matches": []}
    cached = _cache.get((query, limit))
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    # Search with just the medicine word and its strength, not the instructions around them
    strength = re.search(r"\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu)?\b", query)
    word = _drug_word(query)
    term = f"{word} {strength.group(0).strip()}" if strength else word
    matches = _search(term, limit, word)
    if not matches and term != word:
        matches = _search(word, limit, word)
    if not matches or matches[0]["similarity"] < 0.9:
        # Not a clear match: also try RxNav's spelling suggestion. Its candidates are still scored
        # against what was written, so a suggestion that is a different drug can't slip through
        suggestions = _get("/spellingsuggestions.json", name=word).get("suggestionGroup", {}).get("suggestionList") or {}
        suggestion = (suggestions.get("suggestion") or [None])[0]
        if suggestion and suggestion.lower() != word:
            seen = {m["rxcui"] for m in matches}
            extra = [m for m in _search(term.replace(word, suggestion.lower()), limit, word) if m["rxcui"] not in seen]
            matches = sorted(matches + extra, key=lambda m: -m["similarity"])[:limit]

    result = {"query": query, "matches": matches}
    if len(_cache) >= CACHE_SIZE:
        _cache.pop(next(iter(_cache)))
    _cache[(query, limit)] = (time.monotonic(), result)
    return result


@router.get("/match")
def match(q: str = Query(min_length=2, max_length=120), limit: int = Query(3, ge=1, le=5), uid: str = Depends(current_user)):
    try:
        return match_drug(q, limit)
    except requests.RequestException:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Couldn't reach the RxNorm drug database. Please try again.")
