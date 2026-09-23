"""Supabase clients for verifying users and storing their protected images."""

import os
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

load_dotenv()

BUCKET = os.getenv("SUPABASE_BUCKET", "protected-images")
bearer = HTTPBearer(auto_error=False)


def _url() -> str:
    value = os.getenv("SUPABASE_URL")
    if not value:
        raise RuntimeError("SUPABASE_URL is missing from .env")
    return value


@lru_cache(maxsize=1)
def public_client() -> Client:
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY is missing from .env")
    return create_client(_url(), key)


@lru_cache(maxsize=1)
def admin_client() -> Client:
    # Server only. Never pass this key to React or include it in an API response.
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SECRET_KEY is missing from .env")
    return create_client(_url(), key)


def current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in first.")
    try:
        response = public_client().auth.get_user(credentials.credentials)
        if response.user is None: # type: ignore
            raise ValueError("No user returned")
        return str(response.user.id) # type: ignore
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc
