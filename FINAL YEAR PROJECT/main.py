import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from drugs_api import router as drugs_router
from extract_api import router as extract_router
from food_api import router as food_router
from predict import router as predict_router
from risk_api import router as risk_router
from wearables_api import router as wearables_router

app = FastAPI(title="HealthNet API")

# Comma-separated frontend origins allowed to call the API,
# e.g. ALLOWED_ORIGINS="https://healthnet.example,http://localhost:3000"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(predict_router)
app.include_router(risk_router)
app.include_router(drugs_router)
app.include_router(extract_router)
app.include_router(food_router)
app.include_router(wearables_router)


@app.get("/")
def status():
    # Opening the API in a browser shows it's up and where the docs are
    return {"service": "HealthNet API", "status": "ok", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
