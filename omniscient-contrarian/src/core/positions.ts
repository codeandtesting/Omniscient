import * as fs from "fs";
import * as path from "path";

/**
 * Tracks the entry (cost-basis) price of each open position so the agent can take
 * profit / stop loss instead of bag-holding. Persisted to disk so positions survive
 * a restart during the live competition.
 */
const FILE = path.join(process.cwd(), "cache", "positions.json");

export interface Position {
    entryPrice: number;
    sizeUsd: number;
    openedAt: number; // epoch ms
}

let positions: Record<string, Position> = load();

function load(): Record<string, Position> {
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch {
        return {};
    }
}

function save(): void {
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(positions, null, 2));
    } catch {
        /* best-effort */
    }
}

export function recordEntry(symbol: string, entryPrice: number, sizeUsd: number): void {
    // If we already hold some, blend the cost basis (average up/down).
    const existing = positions[symbol];
    if (existing) {
        const totalSize = existing.sizeUsd + sizeUsd;
        positions[symbol] = {
            entryPrice: (existing.entryPrice * existing.sizeUsd + entryPrice * sizeUsd) / totalSize,
            sizeUsd: totalSize,
            openedAt: existing.openedAt,
        };
    } else {
        positions[symbol] = { entryPrice, sizeUsd, openedAt: Date.now() };
    }
    save();
}

export function clearEntry(symbol: string): void {
    delete positions[symbol];
    save();
}

export function getEntry(symbol: string): Position | null {
    return positions[symbol] ?? null;
}

export function getOpenPositions(): { symbol: string; pos: Position }[] {
    return Object.entries(positions).map(([symbol, pos]) => ({ symbol, pos }));
}
