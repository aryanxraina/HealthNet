# HealthNet

AI-powered preventive healthcare platform that helps people anywhere understand their health risks early and build healthier habits.

## Repository Structure

- `healthnet-frontend/`: React web app with Home, Sign in, Dashboard, Health Questionnaire, Food Tracker and an AI chat assistant. Sign-in uses Firebase Authentication (email + password and Google).
- `FINAL YEAR PROJECT/`: Python API (`main.py`). It holds the risk engine (`risk/`: WHO, PREVENT, Framingham, FINDRISC and screeners; sources in [`risk/CITATIONS.md`](FINAL%20YEAR%20PROJECT/risk/CITATIONS.md)), the experimental diabetes model (`train_diabetes_model.py`, `diabetes.csv`, `diabetes_model.pkl`) and its tests (`tests/`). It also holds the original static HTML prototypes, which are legacy and no longer maintained.
- `docs/`: design documents, including the [on-device model roadmap](docs/on-device-model-roadmap.md) (how reading and risk scoring move fully onto the user's device)

## Features

- Firebase sign-in (email + password, Google). Dashboard, Questionnaire and Food Tracker require an account.
- Guided health questionnaire with a progress tracker, saved per user in Firestore
- Dashboard with your real risk scores (calculated on your device, so your answers aren't sent anywhere), the latest readings you entered, and "add this to unlock" links. Some side panels still show labelled sample data
- Wearable sync: connect Google Health (Fitbit, Pixel Watch) in Settings → Devices to chart daily steps, resting heart rate and sleep on the Dashboard
- Food tracker: log meals from food search, barcodes, your own entries or (with Enhanced reading) a meal photo; daily calories and macros against your goal, and a 7-day view
- Settings: display name, units (metric/imperial, mg/dL or mmol/L, °C/°F), light/dark theme, language, diabetes model, password reset, account deletion
- Personalised PDF report card (a friendly summary plus a detail page for your doctor) and a raw JSON export
- Risk engine (in the browser, with the Python version as the reference and an API): WHO 2019 heart attack and stroke risk, AHA PREVENT, Framingham hypertension risk, FINDRISC, PHQ-4, STOP-Bang, AUDIT-C, BMI and waist-to-height ratio, plus an experimental diabetes model
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
The app runs at `http://localhost:3000`. Run the tests with `npm test` and make a production build with `npm run build`. The Dashboard's risk scores need the API from step 3 running; if it isn't on `http://localhost:8000`, set `REACT_APP_API_URL` in `.env.local`.

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

#### Optional: Enhanced reading (cloud AI)
Lab reports and prescriptions are read on the user's device by default, so nothing is uploaded. Users can also switch on **Settings → Enhanced reading**, which offers to send a hard-to-read file to a cloud vision model. They're asked for consent every time, and the result is still reviewed before saving. It stays off unless the API is configured:

| Setting | Values |
|---|---|
| `EXTRACTION_PROVIDER` | `none` (default), `claude` or `gemini` |
| API key | `ANTHROPIC_API_KEY` for Claude, `GEMINI_API_KEY` for Gemini |
| `EXTRACTION_MODEL` (optional) | Defaults to `claude-opus-5-5` or `gemini-flash-latest`. `claude-haiku-5-5` costs much less. |

How files are handled:
- Files are passed on in memory and never stored or logged by the API.
- Claude requests use Anthropic's server-side fallback (`fallbacks: "default"`): if a safety check declines a request, another model retries it automatically.
- The Gemini free tier may let Google use what you send, so only use it with made-up test documents. Use a paid key for real users.

Rough cost per report page: under $0.01 with Haiku or Gemini Flash, and a few cents with Opus.

Medicine names from prescriptions are checked against the free RxNorm database (`GET /drugs/match`); no key is needed.

#### Food tracker data
- **Food search** uses USDA FoodData Central. Get a free key at https://api.data.gov/signup/ and set `USDA_API_KEY`. Without it the shared `DEMO_KEY` is used, which allows only about 10 searches an hour.
- **Barcode lookup** uses Open Food Facts (worldwide, no key).
- **Meal photos** use Enhanced reading (above), so they're only offered when it's switched on.
- **What's sent:** only the search words or the barcode go to these services.

#### Optional: Wearable sync (Google Health)
Brings daily steps, resting heart rate and sleep from Fitbit, Pixel Watch and other sources linked to a Google account. The Google Health API replaces the Fitbit Web API; it is free.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Health API** for your project.
2. Under **Google Auth Platform**, set up the consent screen (External), add the scopes `googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly` and `googlehealth.sleep.readonly`, and add your own Google account under **Test users**.
3. Create an **OAuth client ID** of type **Web application** with the authorised redirect URI `http://localhost:8000/wearables/google/callback`.
4. Set these for the API:
   ```bash
   GOOGLE_HEALTH_CLIENT_ID=...
   GOOGLE_HEALTH_CLIENT_SECRET=...
   # Encrypts the stored Google tokens. Generate once and keep it secret; changing it disconnects everyone.
   TOKEN_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
   # Optional: GOOGLE_HEALTH_REDIRECT_URI (if the API isn't on localhost:8000), FRONTEND_URL (default: first ALLOWED_ORIGINS entry)
   ```

- **How it works:** the API keeps each user's Google refresh token, encrypted, in `wearables.sqlite3` (ignored by git); access tokens stay in memory. Only read-only scopes are requested. Synced daily totals are saved to the user's own Firestore documents (`users/{uid}/activity/{date}`), not on the server.
- **Testing vs. production:** while the app is in *Testing*, only the test users you add can connect (up to 100). Google classes all Google Health scopes as *restricted*, so opening it to everyone needs Google's verification and a security assessment.
- **One server:** the token database is a local file, which suits a single API server. Use a shared database before running several.

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
- **Risk scores are calculated in the browser** by `healthnet-frontend/src/risk/`, a port of the Python engine in `FINAL YEAR PROJECT/risk/` (still the reference, and still served at `/risk/assessment` for other clients). After changing the Python engine or its data, run `python -m risk.export_frontend` from `FINAL YEAR PROJECT/`, then the frontend tests; both test suites fail until the two match.
- **HealthNet Tagger** (recognises lab test names the rules don't know): retrain with `python -m training.tagger.train` from `FINAL YEAR PROJECT/`; it writes `healthnet-frontend/src/ocr/tagger/model.json` and a parity fixture the frontend tests check.
- **Report-reading benchmark:** `npm test` fails if the lab report reader scores worse than its baseline on 600 synthetic reports. After a deliberate improvement, run `npm run benchmark` (in `healthnet-frontend/`) to record the new baseline and update [docs/benchmarks/lab-reports.md](docs/benchmarks/lab-reports.md).
- Commit source only. `node_modules/`, builds, virtual environments and `.env*` files are ignored; `.env.example` is kept as a template.
- `diabetes_model.pkl` must be loaded with the scikit-learn version pinned in `requirements.txt`. Retrain it after changing that version.
- Default branch: `main`.

## License
This project is for academic/demo purposes.

## Author
- Maintainer: aryanxraina
