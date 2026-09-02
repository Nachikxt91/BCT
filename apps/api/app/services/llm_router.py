from __future__ import annotations

import hashlib
import re
import time
from typing import Any

from app.core.config import settings


class LLMRouter:
    """Provider router with Groq primary text + Gemini vision fallback.

    Without API keys, returns deterministic heuristic stubs so the pipeline
    remains runnable offline (dev / CI).
    """

    def __init__(self) -> None:
        self.groq_key = settings.groq_api_key
        self.gemini_key = settings.gemini_api_key

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_key)

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_key)

    def classify_document(self, text: str) -> tuple[str, float, str]:
        """Return (doc_type, confidence, source_model)."""
        if self.groq_enabled:
            try:
                return self._groq_classify(text)
            except Exception:
                pass
        return self._heuristic_classify(text)

    def extract_fields(self, doc_type: str, text: str) -> tuple[dict[str, Any], str]:
        if self.groq_enabled:
            try:
                return self._groq_extract(doc_type, text)
            except Exception:
                if self.gemini_enabled:
                    try:
                        return self._gemini_extract(doc_type, text)
                    except Exception:
                        pass
        return self._heuristic_extract(doc_type, text), "heuristic"

    def vision_ocr(self, image_path: str) -> tuple[str, float, str]:
        """Vision OCR fallback. Prefer Gemini, then Groq vision."""
        if self.gemini_enabled:
            try:
                return self._gemini_vision(image_path)
            except Exception:
                pass
        if self.groq_enabled:
            try:
                return self._groq_vision(image_path)
            except Exception:
                pass
        return "", 0.0, "unavailable"

    def _with_retries(self, fn, *args, **kwargs):
        delay = settings.llm_backoff_base_seconds
        last_exc: Exception | None = None
        for attempt in range(settings.llm_max_retries):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 — route-level fallback
                last_exc = exc
                msg = str(exc).lower()
                if "429" in msg or "rate" in msg:
                    time.sleep(delay + (0.1 * attempt))
                    delay *= 2
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    def _groq_classify(self, text: str) -> tuple[str, float, str]:
        from groq import Groq

        client = Groq(api_key=self.groq_key)
        prompt = (
            "Classify this trade document into one of: "
            "commercial_invoice, packing_list, bill_of_lading, certificate_of_origin, "
            "insurance, bis_certificate, wpc_eta, other.\n"
            "Reply with ONLY the label.\n\n"
            f"{text[:4000]}"
        )

        def call():
            return client.chat.completions.create(
                model=settings.groq_classify_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=32,
            )

        completion = self._with_retries(call)
        label = (completion.choices[0].message.content or "other").strip().lower()
        label = re.sub(r"[^a-z_]", "", label.replace(" ", "_"))
        return label or "other", 0.85, settings.groq_classify_model

    def _groq_extract(self, doc_type: str, text: str) -> tuple[dict[str, Any], str]:
        import json

        from groq import Groq

        client = Groq(api_key=self.groq_key)
        prompt = (
            f"Extract key fields from this {doc_type} as a flat JSON object. "
            "Use keys like invoice_number, date, seller, buyer, amount, currency, "
            "bl_number, vessel, port_of_loading, port_of_discharge, origin_country, "
            "hs_code, bis_number when present. Numbers as strings. "
            "Return JSON only.\n\n"
            f"{text[:8000]}"
        )

        def call():
            return client.chat.completions.create(
                model=settings.groq_extract_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=1024,
            )

        completion = self._with_retries(call)
        raw = completion.choices[0].message.content or "{}"
        return json.loads(raw), settings.groq_extract_model

    def _gemini_extract(self, doc_type: str, text: str) -> tuple[dict[str, Any], str]:
        import json

        import google.generativeai as genai

        genai.configure(api_key=self.gemini_key)
        model = genai.GenerativeModel(settings.gemini_vision_model)
        prompt = (
            f"Extract key fields from this {doc_type} as flat JSON only.\n\n{text[:8000]}"
        )
        resp = self._with_retries(model.generate_content, prompt)
        raw = (resp.text or "{}").strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw), settings.gemini_vision_model

    def _gemini_vision(self, image_path: str) -> tuple[str, float, str]:
        import google.generativeai as genai
        from PIL import Image

        genai.configure(api_key=self.gemini_key)
        model = genai.GenerativeModel(settings.gemini_vision_model)
        img = Image.open(image_path)
        prompt = "Perform OCR. Return plain text transcription of this trade document page."
        resp = self._with_retries(model.generate_content, [prompt, img])
        text = (resp.text or "").strip()
        return text, 0.8 if text else 0.0, settings.gemini_vision_model

    def _groq_vision(self, image_path: str) -> tuple[str, float, str]:
        import base64
        from pathlib import Path

        from groq import Groq

        client = Groq(api_key=self.groq_key)
        data = base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")
        mime = "image/png" if image_path.lower().endswith(".png") else "image/jpeg"

        def call():
            return client.chat.completions.create(
                model=settings.groq_vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "OCR this trade document page. Plain text only."},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{data}"},
                            },
                        ],
                    }
                ],
                temperature=0,
                max_tokens=2048,
            )

        completion = self._with_retries(call)
        text = (completion.choices[0].message.content or "").strip()
        return text, 0.75 if text else 0.0, settings.groq_vision_model

    def _heuristic_classify(self, text: str) -> tuple[str, float, str]:
        t = text.lower()
        rules = [
            ("commercial_invoice", ["commercial invoice", "invoice no", "tax invoice"]),
            ("packing_list", ["packing list", "gross weight", "net weight", "cartons"]),
            ("bill_of_lading", ["bill of lading", "b/l no", "consignee", "notify party", "vessel"]),
            ("certificate_of_origin", ["certificate of origin", "country of origin"]),
            ("insurance", ["insurance policy", "insured value", "marine cargo"]),
            ("bis_certificate", ["bureau of indian standards", "bis licence", "crs"]),
            ("wpc_eta", ["wpc", "equipment type approval", "eta certificate"]),
        ]
        for label, needles in rules:
            if any(n in t for n in needles):
                return label, 0.65, "heuristic"
        return "other", 0.4, "heuristic"

    def _heuristic_extract(self, doc_type: str, text: str) -> dict[str, Any]:
        fields: dict[str, Any] = {"doc_type": doc_type}
        inv = re.search(r"(?:invoice\s*(?:no|number|#)\s*[:.]?\s*)([A-Z0-9\-/]+)", text, re.I)
        if inv:
            fields["invoice_number"] = inv.group(1)
        amt = re.search(r"(?:total|amount|usd|inr)\s*[:.]?\s*([0-9,]+\.?[0-9]*)", text, re.I)
        if amt:
            fields["amount"] = amt.group(1).replace(",", "")
        date = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text)
        if date:
            fields["date"] = date.group(1)
        bl = re.search(r"(?:b/?l|bill of lading)\s*(?:no|number)?\s*[:.]?\s*([A-Z0-9\-/]+)", text, re.I)
        if bl:
            fields["bl_number"] = bl.group(1)
        fields["text_fingerprint"] = hashlib.sha256(text.encode()).hexdigest()[:16]
        return fields


llm_router = LLMRouter()
