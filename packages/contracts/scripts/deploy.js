const hre = require("hardhat");

async function main() {
  const DocumentAttestation = await hre.ethers.getContractFactory("DocumentAttestation");
  const contract = await DocumentAttestation.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("DocumentAttestation deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
