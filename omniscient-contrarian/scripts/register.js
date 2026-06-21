// Register the agent wallet on the BNB Hack competition contract.
const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ABI = [
  "function register() external",
  "function isRegistered(address) view returns (bool)",
];

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.TWAK_PRIVATE_KEY, provider);
  const c = new ethers.Contract(process.env.AGENT_REGISTRATION_CONTRACT, ABI, wallet);

  console.log("Agent wallet:", wallet.address);

  try {
    const already = await c.isRegistered(wallet.address);
    if (already) {
      console.log("✅ Already registered. Nothing to do.");
      return;
    }
  } catch (e) {
    console.log("(could not read isRegistered, proceeding to register)");
  }

  console.log("Sending register() transaction...");
  const tx = await c.register();
  console.log("Tx submitted:", tx.hash);
  await tx.wait();
  console.log("✅ REGISTERED on-chain. https://bscscan.com/tx/" + tx.hash);
})();
