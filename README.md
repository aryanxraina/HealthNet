# HealthNet

AI-powered preventive healthcare platform leveraging India''s Digital Public Infrastructure (DPI).

## Monorepo Structure

- `client/`: CRA React app (PWA) prototype
- `healthnet-frontend/`: React app with pages like `Home`, `Dashboard`, `Questionnaire`, `FoodTracker`
- `healthnet-backend/`: Backend placeholder (Node project scaffold)
- `FINAL YEAR PROJECT/`: Python scripts, HTML prototypes, and ML model for diabetes risk prediction

## Features

- Universal search and modern UI components
- Pages: Home, Dashboard, Questionnaire, Food Tracker
- AI risk assessment concept and reminders
- Python-based diabetes model (`train_diabetes_model.py`, `predict.py`)

## Getting Started

### Prerequisites
- Node.js LTS (v18+ recommended)
- Python 3.9+
- Git

### Frontend (healthnet-frontend)
```bash
cd healthnet-frontend
npm install
npm start
```
App runs at `http://localhost:3000`.

### Prototype Client (client)
```bash
cd client
npm install
npm start
```

### Python ML Demo
```bash
cd "FINAL YEAR PROJECT"
# (optional) python -m venv .venv && .\\.venv\\Scripts\\activate
python train_diabetes_model.py
python main.py  # or: python predict.py
```

## Development Notes
- Commit only source; heavy artifacts are ignored via `.gitignore` (e.g., `node_modules/`, caches).
- Default branch: `main`.

## Scripts of Interest
- `FINAL YEAR PROJECT/train_diabetes_model.py`: trains diabetes model
- `FINAL YEAR PROJECT/predict.py`: inference utility
- `FINAL YEAR PROJECT/main.py`: demo/serving entrypoint (if implemented)

## License
This project is for academic/demo purposes.

## Author
- Maintainer: aryanxraina
