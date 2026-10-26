"""Trains the HealthNet Tagger and exports it for the browser.

    python -m training.tagger.train        # from "FINAL YEAR PROJECT/"

1. Generates labelled names from vocabulary.py, decorated the way reports print them (prefixes,
   suffixes, typos, OCR mix-ups, merged words). Seeded, so every run gives the same model.
2. Removes every benchmark spelling (healthnet-frontend/src/benchmark/labNames.json). The names the
   rule-based reader can't place (HELD_OUT) are removed even inside longer names, so the benchmark
   measures the model on spellings it has never seen.
3. Trains a multinomial logistic regression on character n-gram features (features.py), choosing the
   regularisation on a validation split.
4. Prunes and rounds the weights, then evaluates that exported model, not the in-memory one.
5. Writes healthnet-frontend/src/ocr/tagger/model.json and a parity fixture for features.js.
"""
import json
import math
import random
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.linear_model import LogisticRegression

from .features import feature_counts, normalise, vectorise
from .vocabulary import CONFUSIONS, OTHER, PREFIXES, SPELLINGS, SUFFIXES

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT.parent / "healthnet-frontend" / "src"
BENCHMARK_NAMES = FRONTEND / "benchmark" / "labNames.json"
MODEL_OUT = FRONTEND / "ocr" / "tagger" / "model.json"
PARITY_OUT = FRONTEND / "ocr" / "tagger" / "__fixtures__" / "parity.json"

SEED = 2026
PER_LABEL = 900
OTHER_SAMPLES = 7000
MIN_FEATURE_COUNT = 2
WEIGHT_DECIMALS = 2
MIN_WEIGHT = 0.25
C_VALUES = (1, 4, 16)

# Benchmark spellings the rule-based reader can't place (docs/benchmarks/lab-reports.md). The model must
# learn to read these without ever seeing them, even as part of a longer name.
HELD_OUT = ["SpO₂", "O2 Sat", "HR", "Creat.", "TC", "Glycated Hb"]

# Benchmark field -> Tagger label, for checking the model on every benchmark spelling
BENCHMARK_LABELS = {"plainGlucose": "glucoseUnspecified"}


def decorate(rng, name):
    text = rng.choice(PREFIXES) + name + rng.choice(SUFFIXES)
    if rng.random() < 0.15:  # a typo: drop, repeat or swap a letter
        i = rng.randrange(len(text))
        kind = rng.random()
        if kind < 0.4:
            text = text[:i] + text[i + 1:]
        elif kind < 0.7:
            text = text[:i] + text[i] + text[i:]
        elif i + 1 < len(text):
            text = text[:i] + text[i + 1] + text[i] + text[i + 2:]
    if rng.random() < 0.15:  # OCR letter/digit mix-ups
        text = "".join(CONFUSIONS.get(ch, ch) if rng.random() < 0.15 else ch for ch in text)
    if rng.random() < 0.1 and " " in text.strip():  # two words run together
        spaces = [i for i, ch in enumerate(text) if ch == " " and 0 < i < len(text) - 1]
        if spaces:
            i = rng.choice(spaces)
            text = text[:i] + text[i + 1:]
    return text


def phrase_in(phrase, text):
    """Whether the words of `phrase` appear together, as whole words, in `text`."""
    return f" {phrase} " in f" {text} "


def generate(rng):
    benchmark = json.loads(BENCHMARK_NAMES.read_text(encoding="utf-8"))
    exact = {normalise(name) for names in benchmark.values() for name in names}
    held_out = [normalise(name) for name in HELD_OUT]

    def allowed(text):
        n = normalise(text)
        return bool(n) and n not in exact and not any(phrase_in(h, n) for h in held_out)

    samples, removed = [], 0
    for label, spellings in [*SPELLINGS.items(), ("other", OTHER)]:
        count = OTHER_SAMPLES if label == "other" else PER_LABEL
        made = 0
        while made < count:
            text = decorate(rng, rng.choice(spellings))
            if not allowed(text):
                removed += 1
                continue
            samples.append((text, label))
            made += 1
    rng.shuffle(samples)
    return samples, removed, benchmark


def export(classifier, columns, labels):
    """Model JSON with small weights dropped and the rest rounded, as the browser will load it."""
    weights = {}
    for name, column in columns.items():
        row = classifier.coef_[:, column]
        if np.max(np.abs(row)) >= MIN_WEIGHT:
            weights[name] = [round(float(w), WEIGHT_DECIMALS) for w in row]
    return {
        "version": 1,
        "labels": labels,
        "intercepts": [round(float(b), WEIGHT_DECIMALS) for b in classifier.intercept_],
        "weights": weights,
    }


def predict(model, text):
    """Probabilities from the exported model (same arithmetic as tagger.js)."""
    counts = {name: count for name, count in feature_counts(text).items() if name in model["weights"]}
    norm = math.sqrt(sum(c * c for c in counts.values()))
    scores = list(model["intercepts"])
    if norm:
        for name, count in counts.items():
            for k, w in enumerate(model["weights"][name]):
                scores[k] += w * count / norm
    top = max(scores)
    exps = [math.exp(s - top) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def accuracy(model, pairs):
    labels = model["labels"]
    hits = sum(labels[int(np.argmax(predict(model, text)))] == label for text, label in pairs)
    return hits / len(pairs) if pairs else float("nan")


def main():
    rng = random.Random(SEED)
    samples, removed, benchmark = generate(rng)
    split = int(len(samples) * 0.85)
    train, val = samples[:split], samples[split:]
    labels = sorted({label for _, label in samples})

    frequency = {}
    for text, _ in train:
        for name in feature_counts(text):
            frequency[name] = frequency.get(name, 0) + 1
    columns = {name: i for i, name in enumerate(sorted(n for n, c in frequency.items() if c >= MIN_FEATURE_COUNT))}

    def matrix(pairs):
        rows, cols, values = [], [], []
        for r, (text, _) in enumerate(pairs):
            for column, value in vectorise(text, columns).items():
                rows.append(r)
                cols.append(column)
                values.append(value)
        return csr_matrix((values, (rows, cols)), shape=(len(pairs), len(columns)))

    x_train, x_val = matrix(train), matrix(val)
    y_train = [labels.index(label) for _, label in train]
    best = None
    for c in C_VALUES:
        classifier = LogisticRegression(C=c, max_iter=3000).fit(x_train, y_train)
        model = export(classifier, columns, labels)
        score = accuracy(model, val)
        print(f"C={c}: validation accuracy {score:.4f}, {len(model['weights'])} features kept")
        if best is None or score > best[0]:
            best = (score, c, model)
    score, c, model = best

    # Every benchmark spelling, none of which was trained on
    named = [(name, BENCHMARK_LABELS.get(field, field)) for field, names in benchmark.items() if field != "bloodPressure" for name in names]
    named += [(name, "bloodPressure") for name in benchmark["bloodPressure"]]
    held = [(name, label) for name, label in named if name in HELD_OUT]
    print(f"chosen C={c}; removed {removed} generated names that matched benchmark spellings")
    print(f"validation accuracy {score:.4f}; benchmark spellings {accuracy(model, named):.4f}; held-out spellings {accuracy(model, held):.4f}")
    for name, label in held:
        probabilities = predict(model, name)
        k = int(np.argmax(probabilities))
        print(f"  {name!r}: {model['labels'][k]} ({probabilities[k]:.2f}), expected {label}")

    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(model, separators=(",", ":")) + "\n"
    MODEL_OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {MODEL_OUT.relative_to(ROOT.parent)} ({len(text.encode()) // 1024} KB)")

    probes = [name for name, _ in named] + [t for t, _ in val[:150]] + ["", "  ", "123", "Ω µmol/L"]
    parity = [{"text": t, "features": feature_counts(t), "probabilities": predict(model, t)} for t in probes]
    PARITY_OUT.parent.mkdir(parents=True, exist_ok=True)
    PARITY_OUT.write_text(json.dumps(parity, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {PARITY_OUT.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
