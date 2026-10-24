import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from predict import router as predict_router

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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
