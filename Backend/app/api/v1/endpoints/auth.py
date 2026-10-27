from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterResponse,
    UserRegister,
    UserLogin,
    TokenResponse,
    RefreshTokenResponse,
    LogoutRequest,
    AuthMessageResponse,
    LoginResponse,
)
from app.schemas.user import UserProfileResponse, PasswordChangeRequest, UserSummaryResponse
from app.services.auth_service import (
    register_user,
    login_user,
    refresh_access_token,
    logout_user,
    change_user_password,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_date: UserRegister,
    db: Session = Depends(get_db),
):
    user = register_user(db, user_date)
    return {
        "message": "User registered successfully",
        "user": user,
    }


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
def login(
    credentials: UserLogin,
    db: Session = Depends(get_db),
):
    return login_user(db, credentials)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_token(
    token_data: RefreshTokenResponse,
    db: Session = Depends(get_db),
):
    return refresh_access_token(
        db=db,
        refresh_token=token_data.refresh_token,
    )


@router.post(
    "/logout",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
)
def logout(
    token_data: LogoutRequest,
    db: Session = Depends(get_db),
):
    return logout_user(
        db=db,
        refresh_token=token_data.refresh_token,
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post(
    "/change-password",
    response_model=AuthMessageResponse,
    status_code=status.HTTP_200_OK,
)
def change_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return change_user_password(
        db=db,
        user=current_user,
        current_password=data.current_password,
        new_password=data.new_password,
    )


@router.get(
    "/users",
    response_model=List[UserSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def list_users(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User).filter(User.is_active.is_(True))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))
    return query.limit(50).all()
