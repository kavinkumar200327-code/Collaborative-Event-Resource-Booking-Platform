import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:
        return False

def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub" : str(user_id),
        "type" : "access",
        "iat" : now,
        "exp" : now + timedelta(
            minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm = settings.JWT_ALGORITHM,
    )

def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

def create_token_pair(user_id: int) -> dict[str, str]:
    refresh_token = create_refresh_token()

    return{
        "access_token" : create_access_token(user_id),
        "refresh_token" : refresh_token,
        "token_type" : "bearer",
    }

def decode_access_token(token: str) -> dict:

    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms = [settings.JWT_ALGORITHM],
        options = {
            "require" : ["sub", "exp", "iat", "type"]
        },
    )

    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid access token type")

    return payload
