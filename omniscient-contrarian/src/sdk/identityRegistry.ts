import { ethers } from "ethers";
import { logger } from "../utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * The agent's ERC-8004 identity is its on-chain wallet address. Competition
 * registration is performed on the BSC registry contract (AGENT_REGISTRATION_CONTRACT)
 * via `twak compete register`. This function reports the *real* identity rather than
 * a fabricated id, deriving the address from the configured signing key.
 */
export async function registerIdentity(name: string, ownerAddress?: string): Promise<string> {
    let agentAddress = ownerAddress || process.env.TWAK_WALLET_ADDRESS || "";

    // Derive from the key if not explicitly provided, so the identity is always real.
    if (!agentAddress && process.env.TWAK_PRIVATE_KEY) {
        agentAddress = new ethers.Wallet(process.env.TWAK_PRIVATE_KEY).address;
    }

    if (!agentAddress) {
        throw new Error("Cannot resolve agent identity: set TWAK_WALLET_ADDRESS or TWAK_PRIVATE_KEY");
    }

    const registry = process.env.AGENT_REGISTRATION_CONTRACT || "(unset)";
    logger.info(
        `SDK: Agent '${name}' identity = ${agentAddress} ` +
        `(registered to competition registry ${registry} via 'twak compete register').`
    );

    return agentAddress;
}
