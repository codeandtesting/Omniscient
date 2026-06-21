import { ethers } from "ethers";
import { logger } from "../utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

const SKILL_ABI = ["function updateSignal(uint256 newScore) external"];

/**
 * Publishes the current conviction signal to the ERC-8183 skill contract.
 * Subscribers can then read this signal on-chain.
 */
export async function publishSignal(score: number): Promise<void> {
    logger.info(`SDK: Publishing signal ${score} to ERC-8183 Skill Contract...`);
    
    const rpcUrl = process.env.BSC_RPC_URL;
    const privateKey = process.env.TWAK_PRIVATE_KEY;
    const contractAddress = process.env.ERC_8183_CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
        logger.warn("SDK: Missing required env vars for publishing signal (BSC_RPC_URL, TWAK_PRIVATE_KEY, ERC_8183_CONTRACT_ADDRESS). Skipping real on-chain transaction.");
        return;
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const skillContract = new ethers.Contract(contractAddress, SKILL_ABI, wallet);

        const tx = await skillContract.updateSignal(score);
        logger.info(`SDK: Signal transaction submitted. Tx: ${tx.hash}`);
        await tx.wait(); // Wait for 1 block
        
        logger.info(`SDK: Signal ${score} successfully published on-chain.`);
    } catch (error: any) {
        logger.error(`SDK: Failed to publish signal on-chain: ${error.message}`);
    }
}
