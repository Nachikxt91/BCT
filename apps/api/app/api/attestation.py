from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/status")
def attestation_status():
    configured = bool(
        settings.chain_rpc_url
        and settings.attestation_contract_address
        and settings.attester_private_key
    )
    return {
        "configured": configured,
        "mode": "on-chain" if configured else "mock",
        "contract": settings.attestation_contract_address,
    }
