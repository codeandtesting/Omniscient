// Generate a fresh wallet and write a clean .env (gitignored). Run once, then delete this file.
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const w = ethers.Wallet.createRandom();

const lines = [
  "CMC_API_KEY=REGENERATE_THIS_KEY_ON_COINMARKETCAP",
  "CMC_BASE_URL=https://pro-api.coinmarketcap.com",
  "TWAK_PRIVATE_KEY=" + w.privateKey,
  "TWAK_WALLET_ADDRESS=" + w.address,
  "BSC_RPC_URL=https://bsc-dataseed1.binance.org",
  "USE_TWAK=false",
  "X402_TOKEN_CONTRACT=0x0000000000000000000000000000000000000000",
  "ERC_8183_CONTRACT_ADDRESS=0x5b43fe29d12daD5f03ff338DDB555980eb2efAA7",
  "AGENT_REGISTRATION_CONTRACT=0x212c61b9b72c95d95bf29cf032f5e5635629aed5",
  "",
];

fs.writeFileSync(path.join(__dirname, "..", ".env"), lines.join("\n"));
console.log("NEW WALLET ADDRESS:", w.address);
console.log("Private key written to .env (gitignored). Never commit or share it.");
