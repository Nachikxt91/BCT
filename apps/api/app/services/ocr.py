from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Cache missing optional engines so we don't spam logs on every page.
_paddle_unavailable: bool | None = None
_tesseract_unavailable: bool | None = None


def run_ocr(image_path: str) -> tuple[str, float, str]:
    """Run classic OCR. Prefer PaddleOCR; fall back to Tesseract; else stub.

    Returns (text, mean_confidence 0-1, engine_name).
    """
    global _paddle_unavailable, _tesseract_unavailable

    path = Path(image_path)
    if not path.exists():
        return "", 0.0, "missing_file"

    if _paddle_unavailable is not True:
        try:
            result = _paddle_ocr(str(path))
            _paddle_unavailable = False
            return result
        except Exception as exc:  # noqa: BLE001
            _paddle_unavailable = True
            logger.warning("PaddleOCR unavailable (%s) — will skip for remaining pages", exc)

    if _tesseract_unavailable is not True:
        try:
            result = _tesseract_ocr(str(path))
            _tesseract_unavailable = False
            return result
        except Exception as exc:  # noqa: BLE001
            _tesseract_unavailable = True
            logger.warning("Tesseract unavailable (%s) — using stub/vision for remaining pages", exc)

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
    # Low confidence forces vision fallback when API keys are configured.
    name = Path(image_path).name
    return f"[stub OCR — install paddleocr or tesseract for local OCR]\n{name}", 0.1, "stub"
