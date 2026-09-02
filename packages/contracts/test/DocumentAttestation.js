const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentAttestation", function () {
  it("attests hashes once", async function () {
    const [attester] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DocumentAttestation");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    const packId = ethers.id("pack-1");
    const docHash = ethers.id("doc");
    const resultHash = ethers.id("result");

    await expect(contract.attest(packId, docHash, resultHash))
      .to.emit(contract, "Attested");

    const record = await contract.getRecord(packId);
    expect(record.exists).to.equal(true);
    expect(record.attester).to.equal(attester.address);

    await expect(contract.attest(packId, docHash, resultHash)).to.be.revertedWithCustomError(
      contract,
      "AlreadyAttested"
    );
  });
});
