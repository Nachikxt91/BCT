from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.auth_schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MembershipOut,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.email import send_password_reset_email, send_verification_email
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_raw_token,
    slugify,
    validate_password_strength,
    verify_password,
)
from app.models.entities import (
    AuditEvent,
    EmailVerificationToken,
    Membership,
    Organization,
    OrgRole,
    PasswordResetToken,
    RefreshToken,
    User,
)

router = APIRouter()


def _user_out(user: User) -> UserOut:
    memberships = []
    for m in user.memberships:
        org = m.organization
        memberships.append(
            MembershipOut(
                organization_id=m.organization_id,
                organization_name=org.name if org else "",
                organization_slug=org.slug if org else "",
                role=m.role,
            )
        )
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        email_verified=user.email_verified_at is not None,
        created_at=user.created_at,
        memberships=memberships,
    )


def _issue_tokens(db: Session, user: User) -> TokenResponse:
    access = create_access_token(user.id, user.email)
    raw_refresh = new_raw_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_days),
        )
    )
    db.commit()
    return TokenResponse(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=settings.jwt_access_minutes * 60,
    )


def _create_verification(db: Session, user: User) -> str:
    raw = new_raw_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.email_verify_hours),
        )
    )
    db.commit()
    return raw


def _unique_slug(db: Session, base: str) -> str:
    slug = slugify(base)
    candidate = slug
    n = 1
    while db.query(Organization).filter(Organization.slug == candidate).first():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


def _audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    org_id: str | None = None,
    actor_id: str | None = None,
    meta: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            organization_id=org_id,
            actor_user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta,
        )
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    err = validate_password_strength(body.password)
    if err:
        raise HTTPException(400, err)

    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
    )
    db.add(user)
    db.flush()

    org = Organization(name=body.organization_name.strip(), slug=_unique_slug(db, body.organization_name))
    db.add(org)
    db.flush()

    db.add(Membership(user_id=user.id, organization_id=org.id, role=OrgRole.owner))
    _audit(
        db,
        action="register",
        entity_type="user",
        entity_id=user.id,
        org_id=org.id,
        actor_id=user.id,
    )
    db.commit()

    raw_verify = _create_verification(db, user)
    send_verification_email(user.email, raw_verify)

    user = (
        db.query(User)
        .options(joinedload(User.memberships).joinedload(Membership.organization))
        .filter(User.id == user.id)
        .one()
    )
    return _issue_tokens(db, user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    th = hash_token(body.refresh_token)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == th).first()
    now = datetime.now(timezone.utc)
    if not row or row.revoked_at or row.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    row.revoked_at = now
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")
    db.commit()
    return _issue_tokens(db, user)


@router.post("/logout", response_model=MessageResponse)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    th = hash_token(body.refresh_token)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == th).first()
    if row and not row.revoked_at:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.memberships).joinedload(Membership.organization))
        .filter(User.id == user.id)
        .one()
    )
    return _user_out(user)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always returns the same message (no account enumeration)."""
    msg = MessageResponse(message="If that email exists, a reset link has been sent")
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return msg

    raw = new_raw_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.password_reset_hours),
        )
    )
    db.commit()
    send_password_reset_email(user.email, raw)
    return msg


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    err = validate_password_strength(body.new_password)
    if err:
        raise HTTPException(400, err)

    th = hash_token(body.token)
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == th).first()
    now = datetime.now(timezone.utc)
    if not row or row.used_at or row.expires_at < now:
        raise HTTPException(400, "Invalid or expired reset token")

    user = db.get(User, row.user_id)
    if not user:
        raise HTTPException(400, "Invalid or expired reset token")

    user.password_hash = hash_password(body.new_password)
    row.used_at = now
    # revoke all refresh tokens
    for rt in db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)):
        rt.revoked_at = now
    _audit(db, action="password_reset", entity_type="user", entity_id=user.id, actor_id=user.id)
    db.commit()
    return MessageResponse(message="Password updated")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
    th = hash_token(body.token)
    row = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == th).first()
    now = datetime.now(timezone.utc)
    if not row or row.used_at or row.expires_at < now:
        raise HTTPException(400, "Invalid or expired verification token")

    user = db.get(User, row.user_id)
    if not user:
        raise HTTPException(400, "Invalid or expired verification token")

    user.email_verified_at = now
    row.used_at = now
    db.commit()
    return MessageResponse(message="Email verified")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    msg = MessageResponse(message="If that email exists and is unverified, a new link was sent")
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or user.email_verified_at:
        return msg

    # simple rate limit: one unused token in last 2 minutes
    recent = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.created_at
            >= datetime.now(timezone.utc) - timedelta(minutes=2),
        )
        .first()
    )
    if recent:
        return msg

    raw = _create_verification(db, user)
    send_verification_email(user.email, raw)
    return msg


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    err = validate_password_strength(body.new_password)
    if err:
        raise HTTPException(400, err)

    user.password_hash = hash_password(body.new_password)
    now = datetime.now(timezone.utc)
    for rt in db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)):
        rt.revoked_at = now
    _audit(db, action="change_password", entity_type="user", entity_id=user.id, actor_id=user.id)
    db.commit()
    return MessageResponse(message="Password changed")
