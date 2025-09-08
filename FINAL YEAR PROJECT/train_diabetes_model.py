import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
import pickle

df = pd.read_csv("diabetes.csv")  # Download from Kaggle
X = df.drop("Outcome", axis=1)
y = df["Outcome"]

model = LogisticRegression(max_iter=1000)
model.fit(X, y)

with open("diabetes_model.pkl", "wb") as f:
    pickle.dump(model, f)
