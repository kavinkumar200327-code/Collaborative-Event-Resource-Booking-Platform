from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import UserRegister, UserLogin


def register_user(
    db: Session,
    user_data: UserRegister,
) -> User:
    existing_user = (
        db.query(User)
        .filter(func.lower(User.email) == user_data.email.lower())
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    hashed = hash_password(user_data.password)

    new_user = User(
        full_name=user_data.full_name.strip(),
        email=user_data.email.lower(),
        hash_password=hashed,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception:
        db.rollback()
        raise


def login_user(
    db: Session,
    credentials: UserLogin,
) -> dict:
    user = (
        db.query(User)
        .filter(func.lower(User.email) == credentials.email.lower())
        .first()
    )

    if not user or not verify_password(
        credentials.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token()
    now = datetime.now(timezone.utc)

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False,
    )

    try:
        db.add(refresh_token_record)
        db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user,
        }
    except Exception:
        db.rollback()
        raise


def refresh_access_token(
    db: Session,
    refresh_token: str,
) -> dict:
    token_hash = hash_refresh_token(refresh_token)

    token_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    now = datetime.now(timezone.utc)
    expires_at = token_record.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if token_record.is_revoked or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is expired or revoked",
        )

    user = db.query(User).filter(User.id == token_record.user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable",
        )

    token_record.is_revoked = True
    token_record.revoked_at = now

    new_refresh_token = create_refresh_token()

    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_refresh_token),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False,
    )

    try:
        db.add(new_token_record)
        db.commit()

        return {
            "access_token": create_access_token(user.id),
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
    except Exception:
        db.rollback()
        raise


def logout_user(
    db: Session,
    refresh_token: str,
) -> dict:
    token_hash = hash_refresh_token(refresh_token)

    token_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )

    if token_record and not token_record.is_revoked:
        try:
            token_record.is_revoked = True
            token_record.revoked_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()

    return {"message": "Logged out successfully"}


def change_user_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> dict:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.hash_password = hash_password(new_password)
    try:
        db.commit()
        return {"message": "Password updated successfully"}
    except Exception:
        db.rollback()
        raise
