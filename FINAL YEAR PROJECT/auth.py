"""Firebase sign-in check for API routes.

The frontend sends the signed-in user's Firebase ID token as `Authorization: Bearer <token>`.
Tokens are verified against Google's public keys, the project ID (FIREBASE_PROJECT_ID) and the
issuer, following https://firebase.google.com/docs/auth/admin/verify-id-tokens.
"""
import os
from functools import lru_cache

import cachecontrol
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

bearer = HTTPBearer(auto_error=False)


@lru_cache
def _google_request():
    # Caches Google's signing keys for as long as their Cache-Control header allows
    return google_requests.Request(session=cachecontrol.CacheControl(requests.Session()))


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    """The signed-in user's Firebase uid, or a 401/503 error."""
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Sign-in checks aren't set up yet: set FIREBASE_PROJECT_ID for the API.",
        )
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Sign in to use this feature.", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        claims = id_token.verify_firebase_token(credentials.credentials, _google_request(), audience=project_id)
    except google_exceptions.TransportError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Couldn't reach Google to check your sign-in.")
    except (ValueError, google_exceptions.GoogleAuthError):
        claims = None
    if not claims or claims.get("iss") != f"https://securetoken.google.com/{project_id}" or not claims.get("sub"):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your sign-in has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return claims["sub"]
