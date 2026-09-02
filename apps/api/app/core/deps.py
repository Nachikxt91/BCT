from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models.entities import ROLE_RANK, Membership, OrgRole, TradePack, User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    membership: Membership
    organization_id: str
    role: OrgRole


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive or not found")
    return user


def get_auth_context(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
) -> AuthContext:
    q = (
        db.query(Membership)
        .options(joinedload(Membership.organization))
        .filter(Membership.user_id == user.id)
    )
    memberships = q.all()
    if not memberships:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No organization membership")

    membership: Membership | None = None
    if x_org_id:
        membership = next((m for m in memberships if m.organization_id == x_org_id), None)
        if not membership:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this organization")
    else:
        membership = memberships[0]

    return AuthContext(
        user=user,
        membership=membership,
        organization_id=membership.organization_id,
        role=membership.role,
    )


def require_role(minimum: OrgRole):
    def _dep(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ROLE_RANK[ctx.role] < ROLE_RANK[minimum]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires role {minimum.value} or higher",
            )
        return ctx

    return _dep


def get_org_pack(pack_id: str, ctx: AuthContext, db: Session) -> TradePack:
    pack = db.get(TradePack, pack_id)
    if not pack or pack.organization_id != ctx.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pack not found")
    return pack
