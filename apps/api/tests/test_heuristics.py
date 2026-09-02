"""Smoke tests for OCR pipeline heuristics (no external APIs)."""

from app.services.llm_router import LLMRouter
from app.services.pipeline import sha256_text


def test_heuristic_invoice_classify():
    router = LLMRouter()
    label, conf, src = router.classify_document("COMMERCIAL INVOICE\nInvoice No: INV-1\nTotal Amount USD 100")
    assert label == "commercial_invoice"
    assert src == "heuristic"
    assert conf > 0.5


def test_heuristic_extract_invoice_number():
    router = LLMRouter()
    fields, src = router.extract_fields("commercial_invoice", "Invoice No: INV-DEMO-1001\nDate: 01/01/2026")
    assert fields.get("invoice_number") == "INV-DEMO-1001"
    assert src == "heuristic"


def test_result_hash_stable():
    a = sha256_text('[{"key":"a","value":"1"}]')
    b = sha256_text('[{"key":"a","value":"1"}]')
    assert a == b
