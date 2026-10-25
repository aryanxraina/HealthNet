import pickle
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, classification_report, roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "diabetes.csv"  # Pima Indians Diabetes dataset (Kaggle)
MODEL_PATH = BASE_DIR / "diabetes_model.pkl"

FEATURES = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
    "Insulin", "BMI", "DiabetesPedigreeFunction", "Age",
]

# In this dataset a 0 in these columns means "not measured", not a real reading
ZERO_MEANS_MISSING = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]

SEED = 42


def fill_missing():
    # Imputing inside the pipeline keeps each cross-validation fold's medians out of the
    # other folds, and means the API gets the same treatment of zeros
    return ColumnTransformer(
        [("median", SimpleImputer(missing_values=0, strategy="median"), ZERO_MEANS_MISSING)],
        remainder="passthrough",
    )


CANDIDATES = {
    "logistic_regression": lambda: Pipeline([
        ("fill_missing", fill_missing()),
        ("scale", StandardScaler()),
        ("classify", LogisticRegression(max_iter=1000)),
    ]),
    "random_forest": lambda: Pipeline([
        ("fill_missing", fill_missing()),
        ("classify", RandomForestClassifier(n_estimators=300, min_samples_leaf=5, random_state=SEED)),
    ]),
    "gradient_boosting": lambda: Pipeline([
        ("fill_missing", fill_missing()),
        ("classify", HistGradientBoostingClassifier(learning_rate=0.05, max_iter=200, max_leaf_nodes=8,
                                                    l2_regularization=1.0, random_state=SEED)),
    ]),
}


def compare(X_train, y_train):
    """Cross-validated scores on the training split only; the test split stays unseen."""
    folds = RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=SEED)
    results = {}
    for name, build in CANDIDATES.items():
        scores = cross_validate(build(), X_train, y_train, cv=folds,
                                scoring={"auc": "roc_auc", "brier": "neg_brier_score", "accuracy": "accuracy"})
        results[name] = {
            "auc": scores["test_auc"].mean(),
            "brier": -scores["test_brier"].mean(),
            "accuracy": scores["test_accuracy"].mean(),
        }
    return results


def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y = df["Outcome"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )

    results = compare(X_train, y_train)
    print("5x5 cross-validation on the training split:")
    for name, r in results.items():
        print(f"  {name:20s} ROC-AUC {r['auc']:.3f}  Brier {r['brier']:.3f}  accuracy {r['accuracy']:.3f}")

    # Probabilities are shown to users, so keep the best-calibrated model (lowest Brier score)
    best = min(results, key=lambda name: results[name]["brier"])
    print(f"Chosen: {best}")

    model = CANDIDATES[best]().fit(X_train, y_train)
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    print(f"Held-out test accuracy: {accuracy_score(y_test, predictions):.3f}")
    print(f"Held-out test ROC-AUC:  {roc_auc_score(y_test, probabilities):.3f}")
    print(f"Held-out test Brier:    {brier_score_loss(y_test, probabilities):.3f}")
    print(classification_report(y_test, predictions, target_names=["No diabetes", "Diabetes"]))

    # The saved model is refit on every row; the scores above come from the held-out 20%
    model = CANDIDATES[best]().fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
