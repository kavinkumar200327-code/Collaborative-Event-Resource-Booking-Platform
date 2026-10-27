from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserRegister(BaseModel):

    full_name: str = Field(
        min_length = 2,
        max_length = 150,
        examples = ["Kavin kumar"],
        )

    email: EmailStr
    password: str = Field(
        ...,
        min_length = 8,
        max_length = 128,
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Full name cannot be empty")

        return value

class UserLogin(BaseModel):

    email: EmailStr
    password: str = Field(
        ...,
        min_length = 1,
        max_length = 128,
    )

class TokenResponse(BaseModel):

    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenResponse(BaseModel):

    refresh_token: str = Field(
        ...,
        min_length = 1,
    )

class LogoutRequest(BaseModel):
    refresh_token: str = Field(
        ...,
        min_length = 1,
    )

class AuthUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str = "participant"
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes = True)

class AuthMessageResponse(BaseModel):
    message: str

class RegisterResponse(BaseModel):
    message: str
    user: AuthUserResponse

class LoginResponse(TokenResponse):
    user: AuthUserResponse
