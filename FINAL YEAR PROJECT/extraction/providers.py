"""Cloud vision providers for "Enhanced reading". Each turns one file into the JSON of schemas.py.

Chosen with EXTRACTION_PROVIDER (none | claude | gemini) and an API key in the environment:
  claude  ANTHROPIC_API_KEY (or an `ant auth login` profile)   model: EXTRACTION_MODEL, default claude-opus-5-5
  gemini  GEMINI_API_KEY or GOOGLE_API_KEY                       model: EXTRACTION_MODEL, default gemini-flash-latest

The SDKs are imported only when their provider is used. Files are sent once and never stored here.
"""
import base64
import json
import os

from .schemas import SCHEMAS, SYSTEM_PROMPTS, USER_PROMPTS

DEFAULT_MODELS = {"claude": "claude-opus-5-5", "gemini": "gemini-flash-latest"}
NAMES = {"claude": "Claude (Anthropic)", "gemini": "Gemini (Google)"}


class ExtractionError(Exception):
    """code: notConfigured | unavailable | rateLimited | refused | failed"""

    def __init__(self, code, message=""):
        super().__init__(message or code)
        self.code = code


def configured_provider():
    provider = os.getenv("EXTRACTION_PROVIDER", "none").strip().lower()
    return provider if provider in DEFAULT_MODELS else None


def model_for(provider):
    return os.getenv("EXTRACTION_MODEL") or DEFAULT_MODELS[provider]


def _claude(kind, data, media_type, model):
    import anthropic

    encoded = base64.standard_b64encode(data).decode("ascii")
    file_block = (
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": encoded}}
        if media_type == "application/pdf"
        else {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}}
    )
    try:
        response = anthropic.Anthropic().beta.messages.create(
            model=model,
            max_tokens=16000,
            # If a safety check declines the request, Anthropic re-runs it on a suitable fallback model
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMAS[kind]}},
            system=SYSTEM_PROMPTS[kind],
            messages=[{"role": "user", "content": [file_block, {"type": "text", "text": USER_PROMPTS[kind]}]}],
        )
    except anthropic.AuthenticationError:
        raise ExtractionError("notConfigured", "The Anthropic API key was rejected.")
    except anthropic.PermissionDeniedError:
        raise ExtractionError("notConfigured", "The Anthropic API key can't use this model.")
    except anthropic.RateLimitError:
        raise ExtractionError("rateLimited")
    except anthropic.BadRequestError as error:
        raise ExtractionError("failed", error.message)
    except anthropic.APIStatusError:
        raise ExtractionError("unavailable")
    except anthropic.APIConnectionError:
        raise ExtractionError("unavailable")

    if response.stop_reason == "refusal":
        raise ExtractionError("refused")
    if response.stop_reason == "max_tokens":
        raise ExtractionError("failed", "The reply was cut off.")
    text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise ExtractionError("failed", "The reply wasn't valid JSON.")


def _gemini(kind, data, media_type, model):
    from google import genai
    from google.genai import errors, types

    try:
        response = genai.Client().models.generate_content(
            model=model,
            contents=[types.Part.from_bytes(data=data, mime_type=media_type), USER_PROMPTS[kind]],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPTS[kind],
                response_mime_type="application/json",
                response_json_schema=SCHEMAS[kind],
            ),
        )
    except errors.ClientError as error:
        if error.code in (401, 403):
            raise ExtractionError("notConfigured", "The Gemini API key was rejected.")
        if error.code == 429:
            raise ExtractionError("rateLimited")
        raise ExtractionError("failed", str(error))
    except errors.APIError:
        raise ExtractionError("unavailable")
    except ValueError as error:
        # The SDK raises ValueError when no API key is set
        raise ExtractionError("notConfigured", str(error))
    try:
        return json.loads(response.text or "")
    except json.JSONDecodeError:
        raise ExtractionError("failed", "The reply wasn't valid JSON.")


PROVIDERS = {"claude": _claude, "gemini": _gemini}


def extract(kind, data, media_type):
    provider = configured_provider()
    if not provider:
        raise ExtractionError("notConfigured", "Enhanced reading isn't set up: set EXTRACTION_PROVIDER for the API.")
    return provider, model_for(provider), PROVIDERS[provider](kind, data, media_type, model_for(provider))
