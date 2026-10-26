"""Text features for the Tagger. healthnet-frontend/src/ocr/tagger/features.js must stay identical;
the exported parity fixture checks that it does.

A name is lower-cased and reduced to letters and digits, then described by its character 2- to 4-grams
(each word padded with spaces, so beginnings and endings count) and its whole words. Character n-grams
let the model recognise spellings it never saw, such as an abbreviation of a known word.
"""
import math
import re

NGRAM_SIZES = (2, 3, 4)
DOTTED_ABBREVIATION = re.compile(r"\b(?:[a-z]\.){2,}")


def normalise(text):
    # Dotted abbreviations first ("h.d.l." -> "hdl"), as the rule-based reader does
    text = DOTTED_ABBREVIATION.sub(lambda match: match.group().replace(".", ""), text.lower())
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def feature_counts(text):
    """{feature: count} for one name."""
    counts = {}
    for word in normalise(text).split(" "):
        if not word:
            continue
        counts["w:" + word] = counts.get("w:" + word, 0) + 1
        padded = f" {word} "
        for size in NGRAM_SIZES:
            for start in range(len(padded) - size + 1):
                gram = "c:" + padded[start:start + size]
                counts[gram] = counts.get(gram, 0) + 1
    return counts


def vectorise(text, index):
    """Sparse L2-normalised vector {column: value} over the known features."""
    counts = {index[name]: count for name, count in feature_counts(text).items() if name in index}
    norm = math.sqrt(sum(value * value for value in counts.values()))
    return {column: value / norm for column, value in counts.items()} if norm else {}
