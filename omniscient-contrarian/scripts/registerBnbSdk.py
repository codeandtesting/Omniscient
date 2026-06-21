"""
Register the agent's ERC-8004 identity on BNB Chain using the official
BNB AI Agent SDK (https://github.com/bnb-chain/bnbagent-sdk).

This is a genuine use of the BNB AI Agent SDK (Python) for on-chain agent
identity — complementing the TypeScript trading agent, which handles the
ERC-8183 signal publishing and TWAK execution.

Setup:
    pip install bnbagent
    # .env (same file the TS agent uses):
    #   TWAK_PRIVATE_KEY=0x...      (agent signing key)
    #   WALLET_PASSWORD=...         (keystore encryption password)

Run:
    python scripts/registerBnbSdk.py
"""

import os
from pathlib import Path


def load_env() -> None:
    """Minimal .env loader so this script shares config with the TS agent."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    load_env()

    private_key = os.environ.get("TWAK_PRIVATE_KEY")
    password = os.environ.get("WALLET_PASSWORD", "omniscient-contrarian")
    network = os.environ.get("BNB_SDK_NETWORK", "bsc")  # "bsc" or "bsc-testnet"

    if not private_key:
        raise SystemExit("Missing TWAK_PRIVATE_KEY in .env")

    try:
        from bnbagent import ERC8004Agent
        from bnbagent.wallets import EVMWalletProvider
    except ImportError as exc:
        raise SystemExit(
            "BNB AI Agent SDK not installed. Run: pip install bnbagent"
        ) from exc

    wallet = EVMWalletProvider(password=password, private_key=private_key)
    agent = ERC8004Agent(wallet, network=network)

    print(f"Registering ERC-8004 identity for {wallet.address} on {network}...")
    result = agent.register(
        name="The Omniscient Contrarian",
        description="Contrarian mean-reversion trading agent: fades hype-vs-flow "
        "divergences using CMC Agent Hub data, executes self-custody via TWAK.",
    )
    print("Registered. Agent identity:", result)


if __name__ == "__main__":
    main()
