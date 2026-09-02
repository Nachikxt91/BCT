from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PackStatusOut(str, Enum):
    uploaded = "uploaded"
    queued = "queued"
    preprocessing = "preprocessing"
    ocr = "ocr"
    extracting = "extracting"
    needs_review = "needs_review"
    approved = "approved"
    attested = "attested"
    failed = "failed"


class FieldOut(BaseModel):
    id: str
    key: str
    value: str | None
    confidence: float
    source_model: str | None
    needs_review: bool
    page_id: str | None = None


class PageOut(BaseModel):
    id: str
    page_number: int
    doc_type: str
    status: str
    ocr_confidence: float | None
    ocr_engine: str | None
    ocr_text_preview: str | None = None


class PackSummary(BaseModel):
    id: str
    domain: str
    filename: str
    sha256: str
    status: PackStatusOut
    page_count: int
    created_at: datetime | None
    attestation_tx: str | None = None


class PackDetail(PackSummary):
    error_message: str | None = None
    result_hash: str | None = None
    pages: list[PageOut] = Field(default_factory=list)
    fields: list[FieldOut] = Field(default_factory=list)


class ProcessResponse(BaseModel):
    pack_id: str
    status: PackStatusOut
    message: str


class ApproveRequest(BaseModel):
    note: str | None = None


class AttestResponse(BaseModel):
    pack_id: str
    doc_hash: str
    result_hash: str
    tx_hash: str
    mocked: bool
