from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth_schemas import InviteRequest, InviteResponse
from app.core.db import get_db
from app.core.deps import AuthContext, require_role
from app.core.email import send_invite_email
from app.core.security import hash_password, new_raw_token, validate_password_strength
from app.models.entities import AuditEvent, Membership, OrgRole, User

router = APIRouter()


@router.post("/invite", response_model=InviteResponse)
def invite_member(
    body: InviteRequest,
    ctx: AuthContext = Depends(require_role(OrgRole.admin)),
    db: Session = Depends(get_db),
):
    if body.role == OrgRole.owner and ctx.role != OrgRole.owner:
        raise HTTPException(403, "Only owners can assign the owner role")

    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    created_new = False
    temp_password: str | None = None

    if not user:
        raw_pw = body.password or new_raw_token(9)
        if body.password:
            err = validate_password_strength(body.password)
            if err:
                raise HTTPException(400, err)
        else:
            # ensure generated password meets policy
            raw_pw = f"Tmp{new_raw_token(6)}1a"
        user = User(
            email=email,
            password_hash=hash_password(raw_pw),
            full_name=body.full_name.strip(),
        )
        db.add(user)
        db.flush()
        created_new = True
        temp_password = raw_pw
    else:
        existing = (
            db.query(Membership)
            .filter(
                Membership.user_id == user.id,
                Membership.organization_id == ctx.organization_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(409, "User is already a member of this organization")

    db.add(
        Membership(
            user_id=user.id,
            organization_id=ctx.organization_id,
            role=body.role,
        )
    )
    db.add(
        AuditEvent(
            organization_id=ctx.organization_id,
            actor_user_id=ctx.user.id,
            action="invite",
            entity_type="user",
            entity_id=user.id,
            meta={"role": body.role.value, "email": email},
        )
    )
    db.commit()

    org_name = ctx.membership.organization.name if ctx.membership.organization else "organization"
    send_invite_email(email, org_name, temp_password)

    return InviteResponse(
        user_id=user.id,
        email=email,
        role=body.role,
        temporary_password=temp_password,
        created_new_user=created_new,
    )
