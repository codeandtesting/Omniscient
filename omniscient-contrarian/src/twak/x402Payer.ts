import { ethers } from "ethers";
import { logger } from "../utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * A single payment option from the server's HTTP 402 `Payment-Required` header.
 * CMC Agent Hub uses the x402 "exact" scheme settled in USDC on Base (chain 8453)
 * via EIP-3009 `transferWithAuthorization`. The payment is GASLESS for us — we only
 * sign an EIP-712 authorization; the facilitator submits it on-chain and pays gas.
 */
export interface X402Accept {
    scheme: string;          // "exact"
    network: string;         // CAIP-2, e.g. "eip155:56" (BSC) on the live CMC config
    asset: string;           // payment token contract address on that chain
    amount: string;          // smallest units, e.g. "10000000000000000" = 0.01 (18 decimals)
    payTo: string;           // recipient address
    maxTimeoutSeconds?: number;
    extra?: {
        name?: string;
        version?: string;
        assetTransferMethod?: string; // "eip3009" | "permit2-exact"
        [k: string]: any;             // x402PaymentConfigId, signerAddress, spenderAddress, ...
    };
}

export interface X402Resource {
    url: string;
    mimeType?: string;
    [k: string]: any;
}

export interface X402Requirements {
    x402Version: number;
    accepts: X402Accept[];
    resource?: X402Resource;
}

/**
 * Decode the base64-encoded JSON carried in the `Payment-Required` response header.
 */
export function decodePaymentRequired(headerValue: string): X402Requirements {
    const json = Buffer.from(headerValue, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return {
        x402Version: parsed.x402Version ?? 2,
        accepts: parsed.accepts ?? [],
        resource: parsed.resource,
    };
}

/** Parse the numeric EVM chain id out of a CAIP-2 network string like "eip155:8453". */
function chainIdFromNetwork(network: string): number {
    const m = /(?:eip155:)?(\d+)/.exec(network);
    return m ? parseInt(m[1], 10) : 8453; // default Base mainnet
}

/**
 * Build the x402 **V2** payment header for a given EIP-3009 payment option by
 * signing a `TransferWithAuthorization` (EIP-712) with the agent's own key.
 *
 * Signing is fully offline — no provider, no gas, keys never leave the process.
 * The facilitator submits the transfer and pays gas. Returns the base64-encoded
 * V2 payload (with the required top-level `accepted` field) for `PAYMENT-SIGNATURE`.
 */
export async function buildX402Header(
    accept: X402Accept,
    x402Version: number = 2,
    resource?: X402Resource
): Promise<{ header: string; amountUsd: number }> {
    if (!process.env.TWAK_PRIVATE_KEY) {
        throw new Error("Missing TWAK_PRIVATE_KEY in .env (needed to sign x402 payment)");
    }
    if (accept.extra?.assetTransferMethod && accept.extra.assetTransferMethod !== "eip3009") {
        throw new Error(
            `x402: unsupported transfer method '${accept.extra.assetTransferMethod}' (only eip3009 implemented)`
        );
    }

    // Offline signer — no provider needed for EIP-712 signing.
    const wallet = new ethers.Wallet(process.env.TWAK_PRIVATE_KEY);

    const chainId = chainIdFromNetwork(accept.network);
    const now = Math.floor(Date.now() / 1000);
    const validBefore = now + (accept.maxTimeoutSeconds ?? 60);
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const authorization = {
        from: wallet.address,
        to: accept.payTo,
        value: accept.amount,          // string, smallest units
        validAfter: "0",
        validBefore: validBefore.toString(),
        nonce,
    };

    // EIP-712 domain for the token's EIP-3009 implementation.
    const domain = {
        name: accept.extra?.name || "USD Coin",
        version: accept.extra?.version || "1",
        chainId,
        verifyingContract: accept.asset,
    };

    const types = {
        TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
        ],
    };

    const signature = await wallet.signTypedData(domain, types, authorization);

    // x402 V2 payment payload: the chosen requirement echoed back as `accepted`,
    // plus the signed authorization.
    const payload = {
        x402Version,
        resource,
        accepted: accept,
        payload: {
            signature,
            authorization,
        },
    };

    const header = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");

    // Decimals differ by token: Base USDC = 6 (10000 = $0.01), BSC stables = 18 (1e16 = $0.01).
    const raw = BigInt(accept.amount);
    const decimals = raw >= 10n ** 12n ? 18 : 6;
    const amountUsd = Number(raw) / 10 ** decimals;
    logger.info(
        `x402 Payer: Signed EIP-3009 auth for ${amountUsd} ${accept.extra?.name || "token"} ` +
        `on ${accept.network} -> ${accept.payTo}`
    );

    return { header, amountUsd };
}
