import { ethers } from "hardhat";

async function main() {
  const feePerDay = ethers.parseEther("0.01"); // 0.01 BNB per day

  console.log("Deploying OmniscientSkill contract...");
  const OmniscientSkill = await ethers.getContractFactory("OmniscientSkill");
  const contract = await OmniscientSkill.deploy(feePerDay);

  await contract.waitForDeployment();

  console.log(`OmniscientSkill deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
