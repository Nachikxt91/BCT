from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


def run_ocr(image_path: str) -> tuple[str, float, str]:
    """Run classic OCR. Prefer PaddleOCR; fall back to Tesseract; else stub.

    Returns (text, mean_confidence 0-1, engine_name).
    """
    path = Path(image_path)
    if not path.exists():
        return "", 0.0, "missing_file"

    try:
        return _paddle_ocr(str(path))
    except Exception as exc:  # noqa: BLE001
        logger.warning("PaddleOCR failed: %s — trying Tesseract", exc)

    try:
        return _tesseract_ocr(str(path))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Tesseract failed: %s — using stub OCR", exc)

    return _stub_ocr(str(path))


def _paddle_ocr(image_path: str) -> tuple[str, float, str]:
    from paddleocr import PaddleOCR

    # Use English + latin digits; disable angle cls for speed in MVP
    ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    result = ocr.ocr(image_path, cls=True)
    lines: list[str] = []
    confs: list[float] = []
    if result:
        for block in result:
            if not block:
                continue
            for line in block:
                txt = line[1][0]
                conf = float(line[1][1])
                lines.append(txt)
                confs.append(conf)
    text = "\n".join(lines)
    mean_conf = sum(confs) / len(confs) if confs else 0.0
    return text, mean_conf, "paddleocr"


def _tesseract_ocr(image_path: str) -> tuple[str, float, str]:
    import pytesseract
    from PIL import Image

    img = Image.open(image_path)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    words = []
    confs = []
    for i, word in enumerate(data["text"]):
        w = (word or "").strip()
        if not w:
            continue
        words.append(w)
        try:
            c = float(data["conf"][i])
            if c >= 0:
                confs.append(c / 100.0)
        except (ValueError, TypeError):
            pass
    text = " ".join(words)
    mean_conf = sum(confs) / len(confs) if confs else 0.5
    return text, mean_conf, "tesseract"


def _stub_ocr(image_path: str) -> tuple[str, float, str]:
    """Offline stub so pipeline works without OCR binaries installed."""
    name = Path(image_path).name.lower()
    sample = (
        "COMMERCIAL INVOICE\n"
        "Invoice No: INV-DEMO-1001\n"
        "Date: 15/07/2026\n"
        "Seller: Demo Electronics Pvt Ltd\n"
        "Buyer: Acme Imports LLC\n"
        "Total Amount: USD 12500.00\n"
        "Description: Wireless modules HS 8517\n"
        f"Source file: {name}\n"
    )
    # Slightly below threshold forces vision path when keys present
    conf = settings.ocr_confidence_threshold - 0.05
    return sample, conf, "stub"
