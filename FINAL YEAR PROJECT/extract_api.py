"""Enhanced reading endpoints. The user opts in per upload in the app; the file is passed to the
configured provider in memory and is never written to disk or logged here."""
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from auth import current_user
from extraction.providers import NAMES, ExtractionError, configured_provider, extract, model_for
from extraction.schemas import validate

router = APIRouter(prefix="/extract", tags=["extract"])

MAX_BYTES = 10 * 1024 * 1024
MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}

HTTP_STATUS = {
    "notConfigured": status.HTTP_503_SERVICE_UNAVAILABLE,
    "unavailable": status.HTTP_502_BAD_GATEWAY,
    "rateLimited": status.HTTP_429_TOO_MANY_REQUESTS,
    "refused": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "failed": status.HTTP_502_BAD_GATEWAY,
}


@router.get("/status")
def extraction_status(uid: str = Depends(current_user)):
    provider = configured_provider()
    return {
        "available": provider is not None,
        "provider": provider,
        "providerName": NAMES.get(provider),
        "model": model_for(provider) if provider else None,
    }


@router.post("/{kind}")
async def extract_document(
    kind: Literal["labReport", "prescription", "mealPhoto"], file: UploadFile = File(...), uid: str = Depends(current_user)
):
    if file.content_type not in MEDIA_TYPES or (kind == "mealPhoto" and file.content_type == "application/pdf"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, {"code": "unsupportedType", "message": "Use a JPG, PNG, WebP or PDF file."})
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, {"code": "tooLarge", "message": "Files must be 10 MB or smaller."})
    try:
        provider, model, raw = extract(kind, data, file.content_type)
    except ExtractionError as error:
        raise HTTPException(HTTP_STATUS[error.code], {"code": error.code, "message": str(error)})
    finally:
        del data
    return {"kind": kind, "provider": provider, "providerName": NAMES[provider], "model": model, **validate(kind, raw)}
