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


def _pdf_to_images(pdf_path: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        from pdf2image import convert_from_path

        images = convert_from_path(str(pdf_path), dpi=200)
        paths: list[Path] = []
        for i, img in enumerate(images, start=1):
            p = out_dir / f"page_{i:03d}.png"
            img.save(p, "PNG")
            paths.append(p)
        return paths
    except Exception as exc:  # noqa: BLE001
        logger.warning("pdf2image failed (%s); copying as single image stub page", exc)
        # If upload is already an image, use it; else write placeholder note page
        dest = out_dir / "page_001.png"
        suffix = pdf_path.suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}:
            shutil.copy(pdf_path, dest)
            return [dest]
        # Create a simple PNG via Pillow with filename text for demo
        try:
            from PIL import Image, ImageDraw

            img = Image.new("RGB", (1240, 1754), "white")
            draw = ImageDraw.Draw(img)
            draw.text((40, 40), f"DEMO PAGE for {pdf_path.name}", fill="black")
            draw.text((40, 80), "Install poppler + pdf2image for real PDF rasterization", fill="black")
            img.save(dest)
            return [dest]
        except Exception:
            dest.write_bytes(b"")  # last resort
            return [dest]


def process_pack(db: Session, pack_id: str) -> TradePack:
    pack = db.get(TradePack, pack_id)
    if not pack:
        raise ValueError(f"Pack {pack_id} not found")

    try:
        pack.status = PackStatus.preprocessing
        db.commit()

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

        pack.status = PackStatus.ocr
        db.commit()

        vision_used = 0
        page_rows: list[DocumentPage] = []

        for idx, img_path in enumerate(page_paths, start=1):
            text, conf, engine = run_ocr(str(img_path))
            status = PageStatus.ocr_done

            if conf < settings.ocr_confidence_threshold and vision_used < settings.max_vision_pages_per_pack:
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
        for p in page_rows:
            db.refresh(p)

        pack.status = PackStatus.extracting
        db.commit()

        # Extract per page; merge fields
        for page in page_rows:
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
        db.commit()
        db.refresh(pack)
        return pack

    except Exception as exc:  # noqa: BLE001
        logger.exception("process_pack failed")
        pack.status = PackStatus.failed
        pack.error_message = str(exc)
        db.commit()
        db.refresh(pack)
        raise
