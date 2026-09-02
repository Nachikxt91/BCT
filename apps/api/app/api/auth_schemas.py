from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.entities import OrgRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    organization_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    message: str


class MembershipOut(BaseModel):
    organization_id: str
    organization_name: str
    organization_slug: str
    role: OrgRole


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    email_verified: bool
    created_at: datetime | None
    memberships: list[MembershipOut]


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: OrgRole = OrgRole.operator
    password: str | None = Field(default=None, min_length=8)


class InviteResponse(BaseModel):
    user_id: str
    email: EmailStr
    role: OrgRole
    temporary_password: str | None = None
    created_new_user: bool
