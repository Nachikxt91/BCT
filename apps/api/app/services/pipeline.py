from __future__ import annotations

import hashlib
import json
import logging
import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    DocType,
    DocumentPage,
    ExtractedField,
    PackStatus,
    PageStatus,
    TradePack,
)
from app.services.llm_router import llm_router
from app.services.ocr import run_ocr

logger = logging.getLogger(__name__)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _set_progress(
    db: Session,
    pack: TradePack,
    *,
    stage: str,
    current: int,
    total: int,
    message: str,
) -> None:
    pack.progress_stage = stage
    pack.progress_current = current
    pack.progress_total = total
    pack.progress_message = message
    db.commit()


def _clear_progress(db: Session, pack: TradePack) -> None:
    pack.progress_stage = None
    pack.progress_current = 0
    pack.progress_total = 0
    pack.progress_message = None


def _pdf_to_images(pdf_path: Path, out_dir: Path) -> list[Path]:
    """Rasterize PDF pages to PNG. Prefer PyMuPDF (no Poppler); then pdf2image."""
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = pdf_path.suffix.lower()

    # Already an image upload — copy as single page.
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}:
        dest = out_dir / "page_001.png"
        if suffix != ".png":
            from PIL import Image

            Image.open(pdf_path).convert("RGB").save(dest, "PNG")
        else:
            shutil.copy(pdf_path, dest)
        return [dest]

    errors: list[str] = []

    # 1) PyMuPDF — bundled native libs, works on Windows without Poppler.
    try:
        import pymupdf

        doc = pymupdf.open(pdf_path)
        if doc.page_count < 1:
            raise ValueError("PDF has zero pages")
        paths: list[Path] = []
        # ~200 dpi
        zoom = 200 / 72
        matrix = pymupdf.Matrix(zoom, zoom)
        for i in range(doc.page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            dest = out_dir / f"page_{i + 1:03d}.png"
            pix.save(str(dest))
            paths.append(dest)
        doc.close()
        logger.info("Rasterized %s page(s) via PyMuPDF from %s", len(paths), pdf_path.name)
        return paths
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pymupdf: {exc}")
        logger.warning("PyMuPDF rasterize failed: %s", exc)

    # 2) pdf2image + Poppler (common on Linux / when Poppler is on PATH).
    try:
        from pdf2image import convert_from_path

        images = convert_from_path(str(pdf_path), dpi=200)
        if not images:
            raise ValueError("pdf2image returned no pages")
        paths = []
        for i, img in enumerate(images, start=1):
            p = out_dir / f"page_{i:03d}.png"
            img.save(p, "PNG")
            paths.append(p)
        logger.info("Rasterized %s page(s) via pdf2image from %s", len(paths), pdf_path.name)
        return paths
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pdf2image: {exc}")
        logger.warning("pdf2image failed: %s", exc)

    detail = "; ".join(errors) or "unknown"
    raise RuntimeError(
        "Could not rasterize PDF into page images. "
        "Install PyMuPDF (`pip install pymupdf`) or Poppler for pdf2image. "
        f"Details: {detail}"
    )


def process_pack(db: Session, pack_id: str) -> TradePack:
    pack = db.get(TradePack, pack_id)
    if not pack:
        raise ValueError(f"Pack {pack_id} not found")

    try:
        pack.status = PackStatus.preprocessing
        _set_progress(db, pack, stage="preprocessing", current=0, total=0, message="Rasterizing PDF pages…")

        pack_dir = settings.ocr_dir / pack.id
        if pack_dir.exists():
            shutil.rmtree(pack_dir)
        page_paths = _pdf_to_images(Path(pack.storage_path), pack_dir)
        pack.page_count = len(page_paths)

        # Clear previous pages/fields
        for p in list(pack.pages):
            db.delete(p)
        for f in list(pack.fields):
            db.delete(f)
        db.commit()

        total = len(page_paths)
        pack.status = PackStatus.ocr
        _set_progress(
            db,
            pack,
            stage="ocr",
            current=0,
            total=total,
            message=f"Starting OCR on {total} page(s)…",
        )

        vision_used = 0
        page_rows: list[DocumentPage] = []

        for idx, img_path in enumerate(page_paths, start=1):
            _set_progress(
                db,
                pack,
                stage="ocr",
                current=idx,
                total=total,
                message=f"OCR page {idx} of {total}…",
            )
            text, conf, engine = run_ocr(str(img_path))
            status = PageStatus.ocr_done

            if conf < settings.ocr_confidence_threshold and vision_used < settings.max_vision_pages_per_pack:
                _set_progress(
                    db,
                    pack,
                    stage="ocr",
                    current=idx,
                    total=total,
                    message=f"Vision OCR page {idx} of {total}…",
                )
                v_text, v_conf, v_engine = llm_router.vision_ocr(str(img_path))
                if v_text:
                    text = v_text
                    conf = v_conf
                    engine = f"{engine}+{v_engine}"
                    status = PageStatus.vision_fallback
                    vision_used += 1

            doc_type_str, _, _ = llm_router.classify_document(text or "")
            try:
                doc_type = DocType(doc_type_str)
            except ValueError:
                doc_type = DocType.other

            page = DocumentPage(
                pack_id=pack.id,
                page_number=idx,
                image_path=str(img_path),
                ocr_text=text,
                ocr_confidence=conf,
                doc_type=doc_type,
                status=status,
                ocr_engine=engine,
            )
            db.add(page)
            page_rows.append(page)
            db.commit()
            db.refresh(page)

        pack.status = PackStatus.extracting
        _set_progress(
            db,
            pack,
            stage="extract",
            current=0,
            total=total,
            message="Extracting structured fields…",
        )

        # Extract per page; merge fields
        for i, page in enumerate(page_rows, start=1):
            _set_progress(
                db,
                pack,
                stage="extract",
                current=i,
                total=total,
                message=f"Extracting fields page {i} of {total}…",
            )
            fields, model = llm_router.extract_fields(page.doc_type.value, page.ocr_text or "")
            for key, value in fields.items():
                if key == "doc_type":
                    continue
                conf = 0.7 if model != "heuristic" else 0.55
                needs = conf < settings.ocr_confidence_threshold
                db.add(
                    ExtractedField(
                        pack_id=pack.id,
                        page_id=page.id,
                        key=key,
                        value=str(value) if value is not None else None,
                        confidence=conf,
                        source_model=model,
                        needs_review=needs,
                    )
                )
            db.commit()

        db.refresh(pack)

        # Result hash over ordered fields
        field_payload = [
            {"key": f.key, "value": f.value, "page_id": f.page_id}
            for f in sorted(pack.fields, key=lambda x: (x.key, x.page_id or ""))
        ]
        pack.result_hash = sha256_text(json.dumps(field_payload, sort_keys=True))
        pack.status = PackStatus.needs_review
        pack.error_message = None
        _clear_progress(db, pack)
        pack.progress_message = "OCR complete — ready for review"
        db.commit()
        db.refresh(pack)
        return pack

    except Exception as exc:  # noqa: BLE001
        logger.exception("process_pack failed")
        pack.status = PackStatus.failed
        pack.error_message = str(exc)
        _clear_progress(db, pack)
        pack.progress_message = f"Failed: {exc}"
        db.commit()
        db.refresh(pack)
        raise
