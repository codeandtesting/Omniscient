import { logger } from "../utils/logger";

/**
 * Owner-in-the-loop heartbeat veto for self-custody safety.
 *
 * When drawdown breaches the guardrail, the agent does NOT keep trading blindly:
 * it raises a pending override and waits for the human owner to explicitly approve
 * continuation (via the REST endpoint POST /heartbeat/approve). If the owner does
 * not respond inside the window, the safe default fires — emergency liquidation.
 *
 * This keeps signing authority and the kill decision with the user.
 */

interface PendingOverride {
    resolve: (approved: boolean) => void;
    timer: NodeJS.Timeout;
    deadline: number;
}

let pending: PendingOverride | null = null;

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for the owner to react

/**
 * Raise an override request and wait. Resolves true if the owner approves in time,
 * false on timeout (→ caller liquidates).
 */
export function requestOverride(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<boolean> {
    // If one is already pending, don't stack — reuse the existing decision.
    if (pending) {
        logger.warn("TWAK Heartbeat: Override already pending; awaiting existing decision.");
        return new Promise((resolve) => {
            const original = pending!.resolve;
            pending!.resolve = (approved: boolean) => { original(approved); resolve(approved); };
        });
    }

    logger.warn(
        `TWAK Heartbeat: Owner override requested. Awaiting POST /heartbeat/approve for up to ${timeoutMs / 1000}s, ` +
        `else emergency liquidation will fire.`
    );

    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
            pending = null;
            logger.error("TWAK Heartbeat: No owner approval received. Veto applied → safe liquidation.");
            resolve(false);
        }, timeoutMs);

        pending = { resolve, timer, deadline: Date.now() + timeoutMs };
    });
}

/** Called by the REST endpoint when the owner approves continuation. */
export function approveOverride(): boolean {
    if (!pending) return false;
    clearTimeout(pending.timer);
    const resolve = pending.resolve;
    pending = null;
    logger.info("TWAK Heartbeat: Owner APPROVED continuation. Agent will keep its positions.");
    resolve(true);
    return true;
}

/** Status for the dashboard / REST endpoint. */
export function getOverrideStatus(): { pending: boolean; secondsLeft: number } {
    if (!pending) return { pending: false, secondsLeft: 0 };
    return { pending: true, secondsLeft: Math.max(0, Math.round((pending.deadline - Date.now()) / 1000)) };
}
