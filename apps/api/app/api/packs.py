from __future__ import annotations

import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.schemas import (
    AttestResponse,
    FieldOut,
    PackDetail,
    PackStatusOut,
    PackSummary,
    PageOut,
    ProcessResponse,
)
from app.core.config import settings
from app.core.db import SessionLocal, get_db
from app.core.deps import AuthContext, get_auth_context, get_org_pack, require_role
from app.models.entities import AuditEvent, OrgRole, PackStatus, TradePack
from app.services.attestation import attest_hashes
from app.services.pipeline import process_pack, sha256_file

router = APIRouter()

# In-process lock for the lifetime of an OCR run (not a time window — long jobs stay locked).
_active_jobs: set[str] = set()
_jobs_lock = threading.Lock()


def _try_begin_job(pack_id: str) -> bool:
    with _jobs_lock:
        if pack_id in _active_jobs:
            return False
        _active_jobs.add(pack_id)
        return True


def _end_job(pack_id: str) -> None:
    with _jobs_lock:
        _active_jobs.discard(pack_id)


def _run_process(pack_id: str) -> None:
    # Caller already reserved pack_id via _try_begin_job.
    db = SessionLocal()
    try:
        process_pack(db, pack_id)
    finally:
        _end_job(pack_id)
        db.close()


def _to_summary(pack: TradePack) -> PackSummary:
    return PackSummary(
        id=pack.id,
        domain=pack.domain,
        filename=pack.filename,
        sha256=pack.sha256,
        status=PackStatusOut(pack.status.value),
        page_count=pack.page_count,
        created_at=pack.created_at,
        attestation_tx=pack.attestation_tx,
        progress_stage=pack.progress_stage,
        progress_current=pack.progress_current or 0,
        progress_total=pack.progress_total or 0,
        progress_message=pack.progress_message,
    )


def _to_detail(pack: TradePack) -> PackDetail:
    pages = [
        PageOut(
            id=p.id,
            page_number=p.page_number,
            doc_type=p.doc_type.value,
            status=p.status.value,
            ocr_confidence=p.ocr_confidence,
            ocr_engine=p.ocr_engine,
            ocr_text_preview=(p.ocr_text or "")[:400] or None,
        )
        for p in sorted(pack.pages, key=lambda x: x.page_number)
    ]
    fields = [
        FieldOut(
            id=f.id,
            key=f.key,
            value=f.value,
            confidence=f.confidence,
            source_model=f.source_model,
            needs_review=f.needs_review,
            page_id=f.page_id,
        )
        for f in pack.fields
    ]
    return PackDetail(
        **_to_summary(pack).model_dump(),
        error_message=pack.error_message,
        result_hash=pack.result_hash,
        pages=pages,
        fields=fields,
    )


def _audit(db: Session, ctx: AuthContext, action: str, pack_id: str, meta: dict | None = None) -> None:
    db.add(
        AuditEvent(
            organization_id=ctx.organization_id,
            actor_user_id=ctx.user.id,
            action=action,
            entity_type="pack",
            entity_id=pack_id,
            meta=meta,
        )
    )


@router.get("", response_model=list[PackSummary])
def list_packs(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    packs = (
        db.query(TradePack)
        .filter(TradePack.organization_id == ctx.organization_id)
        .order_by(TradePack.created_at.desc())
        .all()
    )
    return [_to_summary(p) for p in packs]


@router.get("/{pack_id}", response_model=PackDetail)
def get_pack(
    pack_id: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    return _to_detail(pack)


@router.post("", response_model=PackSummary, status_code=201)
async def upload_pack(
    file: UploadFile = File(...),
    domain: str = "electronics",
    ctx: AuthContext = Depends(require_role(OrgRole.operator)),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "Filename required")

    # Basename only — reject path traversal / empty names from multipart Content-Disposition.
    safe_name = Path(file.filename).name
    if not safe_name or safe_name in {".", ".."}:
        raise HTTPException(400, "Invalid filename")

    suffix = Path(safe_name).suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}:
        raise HTTPException(400, "Unsupported file type")

    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB")

    pack = TradePack(
        domain=domain,
        filename=safe_name,
        storage_path="",
        sha256="",
        organization_id=ctx.organization_id,
        created_by_user_id=ctx.user.id,
    )
    db.add(pack)
    db.flush()

    dest_dir = settings.upload_dir / ctx.organization_id / pack.id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe_name
    # Ensure resolved path stays under the pack upload directory.
    if dest.resolve().parent != dest_dir.resolve():
        raise HTTPException(400, "Invalid filename")
    dest.write_bytes(data)

    pack.storage_path = str(dest)
    pack.sha256 = sha256_file(dest)
    pack.status = PackStatus.uploaded
    _audit(db, ctx, "upload", pack.id, {"filename": safe_name})
    db.commit()
    db.refresh(pack)
    return _to_summary(pack)


@router.post("/{pack_id}/process", response_model=ProcessResponse)
def enqueue_process(
    pack_id: str,
    background_tasks: BackgroundTasks,
    ctx: AuthContext = Depends(require_role(OrgRole.operator)),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    if not _try_begin_job(pack_id):
        raise HTTPException(409, "Pack already processing")

    pack.status = PackStatus.queued
    pack.progress_stage = "queued"
    pack.progress_current = 0
    pack.progress_total = 0
    pack.progress_message = "Queued — waiting to start OCR…"
    pack.error_message = None
    _audit(db, ctx, "process_queued", pack.id)
    db.commit()
    background_tasks.add_task(_run_process, pack_id)
    return ProcessResponse(pack_id=pack_id, status=PackStatusOut.queued, message="OCR pipeline queued")


@router.post("/{pack_id}/process-sync", response_model=PackDetail)
def process_sync(
    pack_id: str,
    ctx: AuthContext = Depends(require_role(OrgRole.operator)),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    if not _try_begin_job(pack_id):
        raise HTTPException(409, "Pack already processing")
    try:
        pack = process_pack(db, pack_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Processing failed: {exc}") from exc
    finally:
        _end_job(pack_id)
    _audit(db, ctx, "process_sync", pack.id)
    db.commit()
    return _to_detail(pack)


@router.post("/{pack_id}/approve", response_model=PackDetail)
def approve_pack(
    pack_id: str,
    ctx: AuthContext = Depends(require_role(OrgRole.reviewer)),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    if pack.status not in {PackStatus.needs_review, PackStatus.approved}:
        raise HTTPException(400, f"Cannot approve from status {pack.status}")
    pack.status = PackStatus.approved
    _audit(db, ctx, "approve", pack.id)
    db.commit()
    db.refresh(pack)
    return _to_detail(pack)


@router.post("/{pack_id}/attest", response_model=AttestResponse)
def attest_pack(
    pack_id: str,
    ctx: AuthContext = Depends(require_role(OrgRole.admin)),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    # Require human approval before integrity attestation (allow re-attest of already attested).
    if pack.status not in {PackStatus.approved, PackStatus.attested}:
        raise HTTPException(400, "Approve pack before attestation")
    if not pack.result_hash:
        raise HTTPException(400, "Missing result hash — run OCR first")

    result = attest_hashes(pack.id, pack.sha256, pack.result_hash)
    pack.attestation_tx = result["tx_hash"]
    pack.status = PackStatus.attested
    _audit(db, ctx, "attest", pack.id, {"tx_hash": result["tx_hash"], "mocked": bool(result.get("mocked"))})
    db.commit()
    return AttestResponse(
        pack_id=pack.id,
        doc_hash=pack.sha256,
        result_hash=pack.result_hash,
        tx_hash=result["tx_hash"],
        mocked=bool(result.get("mocked")),
    )


@router.delete("/{pack_id}", status_code=204)
def delete_pack(
    pack_id: str,
    ctx: AuthContext = Depends(require_role(OrgRole.admin)),
    db: Session = Depends(get_db),
):
    pack = get_org_pack(pack_id, ctx, db)
    for path in [Path(pack.storage_path).parent, settings.ocr_dir / pack.id]:
        if path.exists() and path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
    _audit(db, ctx, "delete", pack.id)
    db.delete(pack)
    db.commit()
    return None
