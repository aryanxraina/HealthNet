# HealthNet

AI-powered preventive healthcare platform that helps people anywhere understand their health risks early and build healthier habits.

## Repository Structure

- `healthnet-frontend/`: React web app with Home, Sign in, Dashboard, Health Questionnaire, Food Tracker and an AI chat assistant. Sign-in uses Firebase Authentication (email + password and Google).
- `FINAL YEAR PROJECT/`: Python API and machine-learning model for diabetes risk prediction (`main.py`, `predict.py`, `train_diabetes_model.py`, `diabetes.csv`, `diabetes_model.pkl`). It also holds the original static HTML prototypes, which are legacy and no longer maintained.

## Features

- Firebase sign-in (email + password, Google). Dashboard, Questionnaire and Food Tracker require an account.
- Health questionnaire (personal info, lifestyle, medical history), saved per user in the browser
- Dashboard and nutrition tracker layouts, showing sample data until real data is connected
- Diabetes risk prediction API (logistic regression trained on the Pima Indians Diabetes dataset)
- Anything marked "Coming soon" in the app is planned but not built yet

## Getting Started

### Prerequisites
- Node.js 18 or newer
- Python 3.11 or newer
- A Firebase project (free) for sign-in

### 1. Set up Firebase sign-in
1. In the [Firebase console](https://console.firebase.google.com), create a project and add a **Web app**. Copy its config values.
2. Go to **Authentication → Sign-in method** and enable **Email/Password** and **Google**.
3. Copy `healthnet-frontend/.env.example` to `healthnet-frontend/.env.local` and fill in the values.
4. Before deploying, add your site's domain under **Authentication → Settings → Authorized domains** (`localhost` is allowed by default).

The app runs without these keys, but sign-in is disabled, so the protected pages can't be opened.

### 2. Run the frontend
```bash
cd healthnet-frontend
npm install
npm start
```
The app runs at `http://localhost:3000`. Run the tests with `npm test` and make a production build with `npm run build`.

### 3. Run the prediction API
```bash
cd "FINAL YEAR PROJECT"
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python train_diabetes_model.py   # optional: retrains the model and prints test accuracy and ROC-AUC
python main.py                   # serves http://127.0.0.1:8000 (interactive docs at /docs)
```

Example request:
```bash
curl -X POST http://127.0.0.1:8000/predict-diabetes \
  -H "Content-Type: application/json" \
  -d '{"Pregnancies": 2, "Glucose": 138, "BloodPressure": 72, "SkinThickness": 0, "Insulin": 0, "BMI": 33.6, "DiabetesPedigreeFunction": 0.5, "Age": 45}'
```

- A `0` for Glucose, BloodPressure, SkinThickness, Insulin or BMI means "not measured"; the model fills it in with a typical value.
- Set `ALLOWED_ORIGINS` (comma-separated) to let a deployed frontend call the API. The default is `http://localhost:3000`.
- The prediction is a screening aid, not a diagnosis.

## Development Notes
- Commit source only. `node_modules/`, builds, virtual environments and `.env*` files are ignored; `.env.example` is kept as a template.
- `diabetes_model.pkl` must be loaded with the scikit-learn version pinned in `requirements.txt`. Retrain it after changing that version.
- Default branch: `main`.

## License
This project is for academic/demo purposes.

## Author
- Maintainer: aryanxraina
