from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def attest_hashes(pack_id: str, doc_hash: str, result_hash: str) -> dict[str, Any]:
    """Submit attestation on-chain, or return a deterministic mock tx in dev."""
    if not (
        settings.chain_rpc_url
        and settings.attestation_contract_address
        and settings.attester_private_key
    ):
        mock_tx = f"0xmock{doc_hash[:24]}{result_hash[:24]}"
        logger.info("Attestation mocked for pack %s → %s", pack_id, mock_tx)
        return {
            "tx_hash": mock_tx,
            "mocked": True,
            "pack_id": pack_id,
            "doc_hash": doc_hash,
            "result_hash": result_hash,
        }

    try:
        from eth_account import Account
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(settings.chain_rpc_url))
        account = Account.from_key(settings.attester_private_key)
        # Minimal ABI for DocumentAttestation.attest(bytes32,bytes32,bytes32)
        abi = [
            {
                "inputs": [
                    {"internalType": "bytes32", "name": "packId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "docHash", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "resultHash", "type": "bytes32"},
                ],
                "name": "attest",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ]
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(settings.attestation_contract_address),
            abi=abi,
        )

        def to_bytes32(hex_str: str) -> bytes:
            h = hex_str[2:] if hex_str.startswith("0x") else hex_str
            return bytes.fromhex(h.zfill(64)[-64:])

        pack_bytes = to_bytes32(hashlib_sha(pack_id))
        tx = contract.functions.attest(
            pack_bytes, to_bytes32(doc_hash), to_bytes32(result_hash)
        ).build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 200000,
                "maxFeePerGas": w3.to_wei("50", "gwei"),
                "maxPriorityFeePerGas": w3.to_wei("2", "gwei"),
                "chainId": w3.eth.chain_id,
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "mocked": False,
            "pack_id": pack_id,
            "doc_hash": doc_hash,
            "result_hash": result_hash,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("On-chain attest failed; falling back to mock")
        return {
            "tx_hash": f"0xfallback{doc_hash[:20]}",
            "mocked": True,
            "error": str(exc),
            "pack_id": pack_id,
            "doc_hash": doc_hash,
            "result_hash": result_hash,
        }


def hashlib_sha(value: str) -> str:
    import hashlib

    return hashlib.sha256(value.encode()).hexdigest()
