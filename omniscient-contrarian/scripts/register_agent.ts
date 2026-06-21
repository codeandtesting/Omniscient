import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const registryAddress = process.env.AGENT_REGISTRATION_CONTRACT;
  if (!registryAddress) throw new Error("AGENT_REGISTRATION_CONTRACT not set");

  // The official competition contract ABI for register
  const abi = [
    "function register() external"
  ];

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(registryAddress, abi, signer);

  console.log(`Registering agent address ${signer.address} via the competition contract...`);
  const tx = await contract.register();
  await tx.wait();

  console.log(`Agent successfully registered! TX: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
