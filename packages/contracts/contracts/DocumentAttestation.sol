// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DocumentAttestation
/// @notice Stores SHA-256 hashes of trade document packs and OCR result payloads.
/// @dev Never store PII or document bytes on-chain — hashes only.
contract DocumentAttestation {
    struct Record {
        bytes32 docHash;
        bytes32 resultHash;
        uint64 timestamp;
        address attester;
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Record) private records;

    event Attested(
        bytes32 indexed packId,
        bytes32 docHash,
        bytes32 resultHash,
        address indexed attester,
        uint64 timestamp
    );

    error NotOwner();
    error AlreadyAttested();
    error EmptyHash();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function attest(bytes32 packId, bytes32 docHash, bytes32 resultHash) external {
        if (docHash == bytes32(0) || resultHash == bytes32(0)) revert EmptyHash();
        if (records[packId].exists) revert AlreadyAttested();

        records[packId] = Record({
            docHash: docHash,
            resultHash: resultHash,
            timestamp: uint64(block.timestamp),
            attester: msg.sender,
            exists: true
        });

        emit Attested(packId, docHash, resultHash, msg.sender, uint64(block.timestamp));
    }

    function getRecord(bytes32 packId)
        external
        view
        returns (bytes32 docHash, bytes32 resultHash, uint64 timestamp, address attester, bool exists)
    {
        Record memory r = records[packId];
        return (r.docHash, r.resultHash, r.timestamp, r.attester, r.exists);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
