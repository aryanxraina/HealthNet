"""The Tagger's training data and its exported model (training/tagger, healthnet-frontend/src/ocr/tagger)."""
import json
import random

import pytest

from training.tagger import train
from training.tagger.features import feature_counts, normalise


@pytest.fixture(scope="module")
def generated():
    return train.generate(random.Random(train.SEED))


def test_no_benchmark_spelling_is_trained_on(generated):
    samples, removed, benchmark = generated
    exact = {normalise(name) for names in benchmark.values() for name in names}
    held_out = [normalise(name) for name in train.HELD_OUT]
    assert removed > 0
    for text, _ in samples:
        n = normalise(text)
        assert n not in exact, text
        # Names the rules can't place must not appear even inside a longer name
        assert not any(train.phrase_in(h, n) for h in held_out), text


def test_every_label_is_represented(generated):
    samples, _, _ = generated
    labels = {label for _, label in samples}
    assert labels == set(train.SPELLINGS) | {"other"}


def test_exported_model_and_fixture_agree():
    model = json.loads(train.MODEL_OUT.read_text(encoding="utf-8"))
    parity = json.loads(train.PARITY_OUT.read_text(encoding="utf-8"))
    assert set(model) == {"version", "labels", "intercepts", "weights"}
    assert all(len(w) == len(model["labels"]) for w in model["weights"].values())
    for case in parity:
        assert feature_counts(case["text"]) == case["features"]
        assert train.predict(model, case["text"]) == pytest.approx(case["probabilities"], abs=1e-12)


def test_normalise_collapses_dotted_abbreviations():
    assert normalise("H.D.L. Cholesterol") == "hdl cholesterol"
    assert normalise("S. Creatinine (µmol/L)") == "s creatinine mol l"
