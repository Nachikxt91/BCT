"""Seed demo organization + admin user.

Usage (from apps/api with venv active):
  python -m app.scripts.seed
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.core.security import hash_password, slugify
from app.models.entities import Membership, Organization, OrgRole, User


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        email = settings.seed_admin_email.lower().strip()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"Seed user already exists: {email}")
            return

        # Migrate previous demo email if present
        legacy = db.query(User).filter(User.email == "admin@tradedoc.local").first()
        if legacy:
            legacy.email = email
            legacy.password_hash = hash_password(settings.seed_admin_password)
            legacy.email_verified_at = datetime.now(timezone.utc)
            db.commit()
            print(f"Updated legacy seed user -> {email}")
            print(f"  password: {settings.seed_admin_password}")
            return

        user = User(
            email=email,
            password_hash=hash_password(settings.seed_admin_password),
            full_name="TradeDoc Admin",
            email_verified_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.flush()

        slug = slugify(settings.seed_org_name)
        org = db.query(Organization).filter(Organization.slug == slug).first()
        if not org:
            org = Organization(name=settings.seed_org_name, slug=slug)
            db.add(org)
            db.flush()

        membership = (
            db.query(Membership)
            .filter(Membership.user_id == user.id, Membership.organization_id == org.id)
            .first()
        )
        if not membership:
            db.add(Membership(user_id=user.id, organization_id=org.id, role=OrgRole.owner))

        db.commit()
        print("Seeded admin user")
        print(f"  email:    {email}")
        print(f"  password: {settings.seed_admin_password}")
        print(f"  org:      {org.name} ({org.id})")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
