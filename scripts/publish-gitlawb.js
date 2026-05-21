import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ethers } from "ethers";

const DEFAULT_OWNER_DID = "did:key:z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx";
const DEFAULT_REPO = "cortex-memory";
const DEFAULT_AGENT_ID = "cortex-agent-001";
const DEFAULT_REGISTRY = "";
const DEFAULT_RPC_URL = "https://sepolia.base.org";
const DEFAULT_PAYLOAD = "Cortex initialized persistent memory for an autonomous AI agent.";
const DEFAULT_SOURCE_REF = "session://genesis";
const BASESCAN_URL = "https://sepolia.basescan.org";
const EVENT_SPAN = 1700;

const env = {
  ...process.env,
  PATH: `${os.homedir()}/.local/bin:${process.env.PATH || ""}`,
  GITLAWB_NODE: process.env.GITLAWB_NODE || "https://node.gitlawb.com"
};

const ownerDid = process.env.GITLAWB_OWNER || DEFAULT_OWNER_DID;
const repo = process.env.GITLAWB_REPO || DEFAULT_REPO;
const agentId = process.env.AGENT_ID || DEFAULT_AGENT_ID;
const registryAddress = process.env.REGISTRY_ADDRESS || DEFAULT_REGISTRY;
const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
const memoryPayload = process.env.MEMORY_PAYLOAD || DEFAULT_PAYLOAD;
const sourceRefOverride = process.env.SOURCE_REF || "";
const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    cwd: options.cwd || process.cwd()
  });

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`);
  }

  return result.stdout?.trim() || "";
}

function ensureFileDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function shortHash(value) {
  if (!value) return "root";
  return value.startsWith("0x") ? value.slice(2, 12) : value.slice(0, 10);
}

function toIso(unixSeconds) {
  const value = Number(unixSeconds || 0);
  return value ? new Date(value * 1000).toISOString() : null;
}

async function queryOnchainState() {
  const artifact = JSON.parse(fs.readFileSync("artifacts/MemoryRegistry.json", "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const registry = new ethers.Contract(registryAddress, artifact.abi, provider);
  const latestBlock = await provider.getBlockNumber();
  const lookback = Number(process.env.EVENT_LOOKBACK_BLOCKS || 120000);
  const fromBlock = Math.max(0, latestBlock - lookback);
  const roots = [];
  const commits = [];

  for (let from = fromBlock; from <= latestBlock; from += EVENT_SPAN + 1) {
    const to = Math.min(latestBlock, from + EVENT_SPAN);
    const [createdLogs, committedLogs] = await Promise.all([
      registry.queryFilter(registry.filters.MemoryRootCreated(), from, to),
      registry.queryFilter(registry.filters.MemoryCommitted(), from, to)
    ]);
    roots.push(...createdLogs);
    commits.push(...committedLogs);
  }

  const rootEvents = roots
    .filter((event) => !agentId || event.args.agentId === agentId)
    .sort((a, b) => a.blockNumber - b.blockNumber || (a.index || 0) - (b.index || 0));

  const root = rootEvents.at(-1);
  const rootId = process.env.MEMORY_ROOT || root?.args.rootId || "";
  const commitEvents = commits
    .filter((event) => !rootId || event.args.rootId === rootId)
    .sort((a, b) => a.blockNumber - b.blockNumber || (a.index || 0) - (b.index || 0));
  const commit = commitEvents.at(-1);

  return { latestBlock, fromBlock, root, rootId, commit };
}

function buildPacket({ root, rootId, commit }) {
  const memoryHash = process.env.MEMORY_HASH
    || commit?.args.memoryHash
    || ethers.keccak256(ethers.toUtf8Bytes(memoryPayload.trim()));
  const packetPath = process.env.GITLAWB_PATH || `memory/${agentId}/latest.json`;
  const gitlawbUri = `gitlawb://${ownerDid}/${repo}/${packetPath}`;
  const sourceRef = sourceRefOverride || commit?.args.sourceRef || DEFAULT_SOURCE_REF;
  const rootCreatedAt = root?.args.createdAt?.toString();
  const commitCreatedAt = commit?.args.committedAt?.toString();
  const owner = process.env.OWNER_ADDRESS || commit?.args.owner || root?.args.owner || null;
  const txHash = process.env.TX_HASH || commit?.transactionHash || root?.transactionHash || null;

  return {
    protocol: "cortex.memory.packet",
    version: "0.1.0",
    agent_id: agentId,
    owner,
    chain_id: "0x14a34",
    network: "Base Sepolia",
    registry: registryAddress,
    memory_root: rootId || null,
    memory_hash: memoryHash,
    source_ref: sourceRef,
    metadata_uri: gitlawbUri,
    payload_preview: memoryPayload.trim(),
    tx_hash: txHash,
    committed: Boolean(commit),
    onchain: {
      root_created_tx: root?.transactionHash || null,
      root_created_block: root?.blockNumber || null,
      root_created_at_unix: rootCreatedAt || null,
      memory_committed_tx: commit?.transactionHash || null,
      memory_committed_block: commit?.blockNumber || null,
      memory_committed_at_unix: commitCreatedAt || null,
      commit_count: commit?.args.commitCount?.toString() || "0"
    },
    gitlawb: {
      node: env.GITLAWB_NODE,
      owner: ownerDid,
      repo,
      branch: "main",
      path: packetPath,
      uri: gitlawbUri
    },
    links: {
      registry: `${BASESCAN_URL}/address/${registryAddress}`,
      transaction: txHash ? `${BASESCAN_URL}/tx/${txHash}` : null,
      repository: `https://gitlawb.com/${ownerDid.replace("did:key:", "")}/${repo}`
    },
    published_at: toIso(commitCreatedAt || rootCreatedAt) || "pending_onchain_timestamp"
  };
}

function writeRepoFiles(repoDir, packet) {
  const packetPath = path.join(repoDir, packet.gitlawb.path);
  const rootPath = path.join(repoDir, `memory/${agentId}/root.json`);
  const hashPath = path.join(repoDir, `memory/${agentId}/${shortHash(packet.memory_hash)}.json`);
  const readmePath = path.join(repoDir, "README.md");

  ensureFileDirectory(packetPath);
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(hashPath, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(rootPath, `${JSON.stringify({
    protocol: "cortex.memory.root",
    version: "0.1.0",
    root_id: packet.memory_root,
    agent_id: packet.agent_id,
    owner: packet.owner,
    registry: packet.registry,
    network: packet.network,
    latest_packet: packet.gitlawb.uri,
    latest_memory_hash: packet.memory_hash,
    latest_tx: packet.tx_hash
  }, null, 2)}\n`);

  fs.writeFileSync(readmePath, `# Cortex Memory

Cortex is the memory layer for autonomous AI agents.

## Current Packet

- Agent: \`${packet.agent_id}\`
- Registry: \`${packet.registry}\`
- Memory root: \`${packet.memory_root || "pending"}\`
- Latest memory hash: \`${packet.memory_hash}\`
- Gitlawb URI: \`${packet.gitlawb.uri}\`
- BaseScan tx: ${packet.links.transaction || "pending"}

Packets are anchored on Base Sepolia and versioned through Gitlawb.
`);
}

async function main() {
  run("gl", ["identity", "show"], { capture: true });

  const state = await queryOnchainState();
  if (!state.rootId) {
    throw new Error("No memory root found. Initialize Cortex memory before publishing to Gitlawb.");
  }

  const packet = buildPacket(state);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-gitlawb-publish-"));
  const repoDir = path.join(tempDir, repo);
  const remote = `gitlawb://${ownerDid}/${repo}`;

  console.log(`Publishing Cortex packet to ${remote}`);
  run("git", ["clone", remote, repoDir]);
  writeRepoFiles(repoDir, packet);

  run("git", ["config", "user.name", "Cortex Agent"], { cwd: repoDir });
  run("git", ["config", "user.email", "cortex@gitlawb.local"], { cwd: repoDir });
  run("git", ["add", "README.md", "memory"], { cwd: repoDir });

  const changed = run("git", ["status", "--porcelain"], { cwd: repoDir, capture: true });
  if (!changed) {
    console.log("Gitlawb repository is already up to date.");
    return;
  }

  console.log(changed);
  if (dryRun) {
    console.log("Dry run enabled. Skipping commit and push.");
    return;
  }

  run("git", ["commit", "-m", `Publish Cortex memory ${shortHash(packet.memory_hash)}`], { cwd: repoDir });
  run("git", ["push", "origin", "main"], { cwd: repoDir });
  console.log(`Published ${packet.gitlawb.uri}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
