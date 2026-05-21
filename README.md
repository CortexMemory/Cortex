# Cortex Memory Node

The memory layer for autonomous AI agents.

## Official links

- GitHub: https://github.com/CortexMemory/Cortex
- Gitlawb: https://gitlawb.com/z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx/cortex-memory
- BaseScan: https://sepolia.basescan.org/address/0x3CE4c1157A82911a826e1f64c0E03d6c1Eb649B7
- Latest packet: https://node.gitlawb.com/z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx/cortex-memory/raw/branch/main/memory/cortex-agent-001/latest.json

## Run locally

```bash
npm install
npm run compile
npm run dev
```

Open:

```text
http://localhost:4178/
```

`npm run dev` starts the static site and the local Gitlawb bridge. If either
service is already running, it reuses the existing port.

## Web3 flow

1. Connect MetaMask/Rabby.
2. The app asks the wallet to use Base Sepolia.
3. Click `deploy Base Sepolia registry` to deploy `MemoryRegistry` from the browser wallet.
4. Click `initialize memory` to create the first memory root.
5. Edit the memory payload and click `commit memory` to anchor a memory hash onchain.

The deployed registry address and latest memory root are stored in `localStorage`.

## Gitlawb integration

Gitlawb CLI is installed at:

```text
~/.local/bin/gl
```

Registered Gitlawb DID:

```text
did:key:z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx
```

Published memory repository:

```text
https://gitlawb.com/z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx/cortex-memory
gitlawb://did:key:z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx/cortex-memory
```

The first Cortex memory root packet is published at:

```text
memory/cortex-agent-001/latest.json
```

Publish or refresh the Gitlawb packet from the latest onchain registry state:

```bash
PATH=~/.local/bin:$PATH GITLAWB_NODE=https://node.gitlawb.com npm run publish:gitlawb
```

Preview without committing:

```bash
PATH=~/.local/bin:$PATH GITLAWB_NODE=https://node.gitlawb.com npm run publish:gitlawb -- --dry-run
```

Run the local bridge that enables the site button:

```bash
PATH=~/.local/bin:$PATH GITLAWB_NODE=https://node.gitlawb.com npm run bridge:gitlawb
```

With the bridge running, the site can publish the latest packet through the
`publish to Gitlawb` button.

## CLI deploy option

```bash
npm run compile
PRIVATE_KEY=0x... npm run deploy:base-sepolia
```

The CLI deploy script defaults to `https://sepolia.base.org`. You can override it:

```bash
RPC_URL=https://sepolia.base.org PRIVATE_KEY=0x... npm run deploy:base-sepolia
```
