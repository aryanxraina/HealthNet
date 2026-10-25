# HealthNet

AI-powered preventive healthcare platform that helps people anywhere understand their health risks early and build healthier habits.

## Repository Structure

- `healthnet-frontend/`: React web app with Home, Sign in, Dashboard, Health Questionnaire, Food Tracker and an AI chat assistant. Sign-in uses Firebase Authentication (email + password and Google).
- `FINAL YEAR PROJECT/`: Python API (`main.py`). It holds the risk engine (`risk/`: WHO, PREVENT, Framingham, FINDRISC and screeners; sources in [`risk/CITATIONS.md`](FINAL%20YEAR%20PROJECT/risk/CITATIONS.md)), the experimental diabetes model (`train_diabetes_model.py`, `diabetes.csv`, `diabetes_model.pkl`) and its tests (`tests/`). It also holds the original static HTML prototypes, which are legacy and no longer maintained.

## Features

- Firebase sign-in (email + password, Google). Dashboard, Questionnaire and Food Tracker require an account.
- Guided health questionnaire with a progress tracker, saved per user in Firestore
- Dashboard and nutrition tracker layouts, showing sample data until real data is connected
- Risk engine API: WHO 2019 heart attack and stroke risk, AHA PREVENT, Framingham hypertension risk, FINDRISC, PHQ-4, STOP-Bang, AUDIT-C, BMI and waist-to-height ratio, plus an experimental diabetes model
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
5. Go to **Firestore Database → Create database**, pick a location close to most of your users (it can't be changed later), and start in **production mode**.
6. In Firestore's **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and click **Publish**. Each user can then read and write only their own data.

The app runs without these keys, but sign-in is disabled, so the protected pages can't be opened. Without step 5–6, signing in works but saving settings and answers shows a "cloud storage isn't set up" message.

### 2. Run the frontend
```bash
cd healthnet-frontend
npm install
npm start
```
The app runs at `http://localhost:3000`. Run the tests with `npm test` and make a production build with `npm run build`.

### 3. Run the API
```bash
cd "FINAL YEAR PROJECT"
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python train_diabetes_model.py   # optional: retrains the model and prints test accuracy and ROC-AUC
python main.py                   # serves http://127.0.0.1:8000 (interactive docs at /docs)
```

The risk engine (`POST /risk/assessment`) only answers signed-in users. Set your Firebase project ID before starting the API, e.g. `FIREBASE_PROJECT_ID=your-project-id` (PowerShell: `$env:FIREBASE_PROJECT_ID="your-project-id"`). It's the `REACT_APP_FIREBASE_PROJECT_ID` value from `.env.local`. Without it, the endpoint replies that sign-in checks aren't set up. Health data sent to it is used for the calculation only, never stored or logged.

Run the API tests with `pip install -r requirements-dev.txt` and then `pytest`.

The demo endpoint `POST /predict-diabetes` runs the experimental model directly and needs no sign-in.

Example request:
```bash
curl -X POST http://127.0.0.1:8000/predict-diabetes \
  -H "Content-Type: application/json" \
  -d '{"Pregnancies": 2, "Glucose": 138, "BloodPressure": 72, "SkinThickness": 0, "Insulin": 0, "BMI": 33.6, "DiabetesPedigreeFunction": 0.5, "Age": 45}'
```

- A `0` for Glucose, BloodPressure, SkinThickness, Insulin or BMI means "not measured"; the model fills it in with a typical value.
- Set `ALLOWED_ORIGINS` (comma-separated) to let a deployed frontend call the API. The default is `http://localhost:3000`.
- All scores are educational estimates, not a diagnosis.

## Development Notes
- Commit source only. `node_modules/`, builds, virtual environments and `.env*` files are ignored; `.env.example` is kept as a template.
- `diabetes_model.pkl` must be loaded with the scikit-learn version pinned in `requirements.txt`. Retrain it after changing that version.
- Default branch: `main`.

## License
This project is for academic/demo purposes.

## Author
- Maintainer: aryanxraina
