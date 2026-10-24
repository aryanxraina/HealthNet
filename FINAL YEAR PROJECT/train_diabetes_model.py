import pickle
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
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


def build_model():
    # Imputing inside the pipeline means the API gets the same treatment of zeros
    fill_missing = ColumnTransformer(
        [("median", SimpleImputer(missing_values=0, strategy="median"), ZERO_MEANS_MISSING)],
        remainder="passthrough",
    )
    return Pipeline([
        ("fill_missing", fill_missing),
        ("scale", StandardScaler()),
        ("classify", LogisticRegression(max_iter=1000)),
    ])


def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y = df["Outcome"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    model = build_model().fit(X_train, y_train)

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    print(f"Test accuracy: {accuracy_score(y_test, predictions):.3f}")
    print(f"Test ROC-AUC:  {roc_auc_score(y_test, probabilities):.3f}")
    print(classification_report(y_test, predictions, target_names=["No diabetes", "Diabetes"]))

    # The saved model is refit on every row; the scores above come from the held-out 20%
    model = build_model().fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
