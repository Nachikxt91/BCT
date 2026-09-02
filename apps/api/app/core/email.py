from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("tradedoc.email")


def send_email(to: str, subject: str, body: str) -> None:
    """Send via SMTP when configured; always log in development."""
    if settings.app_env == "development":
        logger.info("EMAIL to=%s subject=%s\n%s", to, subject, body)

    if not settings.smtp_host:
        if settings.app_env != "development":
            logger.warning("SMTP not configured; email to %s not sent", to)
        return

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.app_public_url.rstrip('/')}/verify-email?token={token}"
    send_email(
        to,
        "Verify your TradeDoc account",
        f"Welcome to TradeDoc OCR.\n\nVerify your email:\n{link}\n\nThis link expires in {settings.email_verify_hours} hours.",
    )


def send_password_reset_email(to: str, token: str) -> None:
    link = f"{settings.app_public_url.rstrip('/')}/reset-password?token={token}"
    send_email(
        to,
        "Reset your TradeDoc password",
        f"Reset your password:\n{link}\n\nIf you did not request this, ignore this email.\nExpires in {settings.password_reset_hours} hour(s).",
    )


def send_invite_email(to: str, org_name: str, temp_password: str | None = None) -> None:
    login = f"{settings.app_public_url.rstrip('/')}/login"
    extra = f"\nTemporary password: {temp_password}\nPlease change it after login.\n" if temp_password else "\n"
    send_email(
        to,
        f"You've been invited to {org_name} on TradeDoc",
        f"You have been invited to join {org_name} on TradeDoc OCR.\n{extra}\nSign in: {login}\n",
    )
