"""Chat models for the assistant. Uses the same providers as Enhanced reading:

  ASSISTANT_PROVIDER   none | claude | gemini (default: EXTRACTION_PROVIDER)
  ASSISTANT_MODEL      default claude-opus-5-5 or gemini-flash-latest; claude-haiku-5-5 costs less
  ANTHROPIC_API_KEY / GEMINI_API_KEY as for Enhanced reading

Conversations are sent once per message and never stored here.
"""
import os

from extraction.providers import NAMES, ExtractionError

DEFAULT_MODELS = {"claude": "claude-opus-5-5", "gemini": "gemini-flash-latest"}
MAX_OUTPUT_TOKENS = 4000


def configured_provider():
    provider = (os.getenv("ASSISTANT_PROVIDER") or os.getenv("EXTRACTION_PROVIDER") or "none").strip().lower()
    return provider if provider in DEFAULT_MODELS else None


def model_for(provider):
    return os.getenv("ASSISTANT_MODEL") or DEFAULT_MODELS[provider]


def _claude(system, messages, model):
    import anthropic

    try:
        response = anthropic.Anthropic().beta.messages.create(
            model=model,
            max_tokens=MAX_OUTPUT_TOKENS,
            # If a safety check declines the request, Anthropic re-runs it on a suitable fallback model
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        )
    except anthropic.AuthenticationError:
        raise ExtractionError("notConfigured", "The Anthropic API key was rejected.")
    except anthropic.PermissionDeniedError:
        raise ExtractionError("notConfigured", "The Anthropic API key can't use this model.")
    except anthropic.RateLimitError:
        raise ExtractionError("rateLimited")
    except anthropic.BadRequestError as error:
        raise ExtractionError("failed", error.message)
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        raise ExtractionError("unavailable")

    if response.stop_reason == "refusal":
        raise ExtractionError("refused")
    text = "\n".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise ExtractionError("failed", "The reply was empty.")
    return text


def _gemini(system, messages, model):
    from google import genai
    from google.genai import errors, types

    contents = [
        types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part.from_text(text=m["content"])])
        for m in messages
    ]
    try:
        response = genai.Client().models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system, max_output_tokens=MAX_OUTPUT_TOKENS),
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
        raise ExtractionError("notConfigured", str(error))
    text = (response.text or "").strip()
    if not text:
        raise ExtractionError("refused")
    return text


PROVIDERS = {"claude": _claude, "gemini": _gemini}


def reply(system, messages):
    provider = configured_provider()
    if not provider:
        raise ExtractionError("notConfigured", "The assistant isn't set up: set ASSISTANT_PROVIDER for the API.")
    return provider, PROVIDERS[provider](system, messages, model_for(provider))


__all__ = ["DEFAULT_MODELS", "NAMES", "PROVIDERS", "configured_provider", "model_for", "reply"]
