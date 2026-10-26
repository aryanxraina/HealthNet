"""The browser runs a JavaScript port of the risk engine (healthnet-frontend/src/risk/).

Its data files and parity fixture are generated from this package. If this test fails, the engine or
its data changed without updating the frontend: run `python -m risk.export_frontend`, then the
frontend tests (src/risk/engine.test.js) to check the port still matches.
"""
import pytest

from risk import export_frontend


@pytest.fixture(scope="module")
def generated():
    return export_frontend.build()


@pytest.mark.parametrize(
    "relative", ["data/who_cvd.json", "data/prevent.json", "data/diabetes_model.json", "__fixtures__/parity.json"]
)
def test_frontend_copy_is_up_to_date(generated, relative):
    expected = generated[relative]
    path = export_frontend.FRONTEND / relative
    assert path.exists(), f"{relative} is missing: run python -m risk.export_frontend"
    assert path.read_text(encoding="utf-8") == expected, f"{relative} is out of date: run python -m risk.export_frontend"
