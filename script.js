const walletButton = document.getElementById("connectWallet");
const switchWalletButton = document.getElementById("switchWallet");
const switchNetworkButton = document.getElementById("switchNetwork");
const initializeMemoryButton = document.getElementById("initializeMemory");
const commitMemoryButton = document.getElementById("commitMemory");
const deployRegistryButton = document.getElementById("deployRegistry");
const saveRegistryButton = document.getElementById("saveRegistry");
const refreshEventsButton = document.getElementById("refreshEvents");
const copyPacketButton = document.getElementById("copyPacket");
const copyGitlawbCommandsButton = document.getElementById("copyGitlawbCommands");
const copyGitlawbUriButton = document.getElementById("copyGitlawbUri");
const useGitlawbUriButton = document.getElementById("useGitlawbUri");
const publishGitlawbButton = document.getElementById("publishGitlawb");

const walletSummary = document.getElementById("walletSummary");
const appStatus = document.getElementById("appStatus");
const walletStatus = document.getElementById("walletStatus");
const chainStatus = document.getElementById("chainStatus");
const terminalWallet = document.getElementById("terminalWallet");
const terminalRoot = document.getElementById("terminalRoot");
const terminalProof = document.getElementById("terminalProof");
const txStatus = document.getElementById("txStatus");
const memoryRootStatus = document.getElementById("memoryRootStatus");
const gitlawbStatus = document.getElementById("gitlawbStatus");
const registryAddressInput = document.getElementById("registryAddress");
const explorerLinks = document.getElementById("explorerLinks");
const contractExplorer = document.getElementById("contractExplorer");
const txExplorer = document.getElementById("txExplorer");
const eventFeed = document.getElementById("eventFeed");

const agentIdInput = document.getElementById("agentId");
const gitlawbRefInput = document.getElementById("gitlawbRef");
const gitlawbOwnerInput = document.getElementById("gitlawbOwner");
const gitlawbRepoInput = document.getElementById("gitlawbRepo");
const gitlawbPathInput = document.getElementById("gitlawbPath");
const gitlawbUriPreview = document.getElementById("gitlawbUriPreview");
const gitlawbCommandsPreview = document.getElementById("gitlawbCommands");
const gitlawbBridgeStatus = document.getElementById("gitlawbBridgeStatus");
const gitlawbBridgeOutput = document.getElementById("gitlawbBridgeOutput");
const gitlawbPublishMeta = document.getElementById("gitlawbPublishMeta");
const gitlawbRepoLink = document.getElementById("gitlawbRepoLink");
const gitlawbPacketLink = document.getElementById("gitlawbPacketLink");
const gitlawbCommitStatus = document.getElementById("gitlawbCommitStatus");
const flowWallet = document.getElementById("flowWallet");
const flowMemory = document.getElementById("flowMemory");
const flowGitlawb = document.getElementById("flowGitlawb");
const sourceRefInput = document.getElementById("sourceRef");
const memoryPayloadInput = document.getElementById("memoryPayload");
const memoryHashPreview = document.getElementById("memoryHashPreview");
const packetPreview = document.getElementById("packetPreview");

const config = window.CORTEX_CONFIG;
const supportedChains = {
  "0x2105": "Base",
  "0x14a34": "Base Sepolia"
};
const eventLookbackBlocks = 1800;
const defaultGitlawbOwner = "did:key:z6MktmKxVdA3a5hNb9Up4bA8tkC8ZEpnSwze2TKWmjgLWxpx";
const gitlawbBridgeHost = window.location.hostname === "localhost" ? "localhost" : "127.0.0.1";
const gitlawbBridgeUrl = `http://${gitlawbBridgeHost}:4181`;

let artifactPromise;
let connectedAccount = "";
let activeChainId = "";
let manuallyDisconnected = localStorage.getItem("cortex.wallet.disconnected") === "true";
let activeRootId = localStorage.getItem("cortex.memory.root") || "";
let registryAddress = config.contractAddress || "";
let currentPacket = null;
let metadataFollowsGitlawb = true;
let gitlawbPublished = false;

registryAddressInput.value = registryAddress;
renderExplorerLinks();
renderRoot(activeRootId);
renderProofState();
renderMemoryPacket();
renderDemoFlow();

function shortAddress(address) {
  if (!address) return "not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  if (!hash) return "not_initialized";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function getMemoryPayloadHash() {
  if (!window.ethers) return "";
  return window.ethers.keccak256(window.ethers.toUtf8Bytes(memoryPayloadInput.value.trim()));
}

function slugify(value, fallback = "cortex-agent") {
  const slug = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function normalizeRepoName(value) {
  return slugify(value, "cortex-memory");
}

function normalizeGitlawbPath(value) {
  const path = (value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-");
  return path || `memory/${slugify(agentIdInput.value)}/latest.json`;
}

function syncDefaultGitlawbPath() {
  if (gitlawbPathInput.dataset.touched === "true") return;
  gitlawbPathInput.value = `memory/${slugify(agentIdInput.value)}/latest.json`;
}

function getGitlawbTarget() {
  syncDefaultGitlawbPath();

  const owner = gitlawbOwnerInput.value.trim() || defaultGitlawbOwner;
  const repo = normalizeRepoName(gitlawbRepoInput.value);
  const path = normalizeGitlawbPath(gitlawbPathInput.value);
  const uri = `gitlawb://${owner}/${repo}/${path}`;

  if (gitlawbRepoInput.value !== repo) gitlawbRepoInput.value = repo;
  if (gitlawbPathInput.value !== path) gitlawbPathInput.value = path;

  return {
    node: "https://node.gitlawb.com",
    owner,
    repo,
    branch: "main",
    path,
    uri
  };
}

function buildGitlawbManifest(packet) {
  const target = packet?.gitlawb || getGitlawbTarget();
  return {
    protocol: "cortex.gitlawb.publish",
    version: "0.1.0",
    node: target.node,
    target: {
      owner: target.owner,
      repo: target.repo,
      branch: target.branch,
      path: target.path,
      uri: target.uri
    },
    packet
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function buildGitlawbCommands(packet) {
  const manifest = buildGitlawbManifest(packet);
  const target = manifest.target;

  return [
    "PATH=~/.local/bin:$PATH \\",
    "GITLAWB_NODE=https://node.gitlawb.com \\",
    `GITLAWB_OWNER=${shellQuote(target.owner)} \\`,
    `GITLAWB_REPO=${shellQuote(target.repo)} \\`,
    `GITLAWB_PATH=${shellQuote(target.path)} \\`,
    `AGENT_ID=${shellQuote(packet?.agent_id || agentIdInput.value.trim())} \\`,
    `SOURCE_REF=${shellQuote(packet?.source_ref || sourceRefInput.value.trim())} \\`,
    `MEMORY_PAYLOAD=${shellQuote(memoryPayloadInput.value.trim())} \\`,
    "npm run publish:gitlawb"
  ].join("\n");
}

function renderGitlawbTarget(packet = currentPacket) {
  const target = getGitlawbTarget();
  gitlawbUriPreview.textContent = target.uri;
  gitlawbStatus.textContent = target.uri;
  gitlawbCommandsPreview.textContent = buildGitlawbCommands(packet || buildMemoryPacket());
}

function buildMemoryPacket({ txHash = "", committed = false } = {}) {
  const memoryHash = getMemoryPayloadHash();
  const gitlawb = getGitlawbTarget();
  if (metadataFollowsGitlawb) {
    gitlawbRefInput.value = gitlawb.uri;
  }

  return {
    protocol: "cortex.memory.packet",
    version: "0.1.0",
    agent_id: agentIdInput.value.trim(),
    owner: connectedAccount || null,
    chain_id: activeChainId || config.chainId,
    registry: registryAddress || null,
    memory_root: activeRootId || null,
    memory_hash: memoryHash || null,
    source_ref: sourceRefInput.value.trim(),
    metadata_uri: gitlawbRefInput.value.trim() || gitlawb.uri,
    gitlawb,
    payload_preview: memoryPayloadInput.value.trim(),
    tx_hash: txHash || null,
    committed,
    created_at: new Date().toISOString()
  };
}

function renderMemoryPacket(options = {}) {
  if (!window.ethers) {
    memoryHashPreview.textContent = "ethers_not_loaded";
    packetPreview.textContent = "{}";
    return;
  }

  currentPacket = buildMemoryPacket(options);
  memoryHashPreview.textContent = currentPacket.memory_hash;
  packetPreview.textContent = JSON.stringify(currentPacket, null, 2);
  renderGitlawbTarget(currentPacket);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  } catch {
    setStatus("Clipboard unavailable. Select the text manually.");
  }
}

async function copyCurrentPacket() {
  renderMemoryPacket();
  await copyText(JSON.stringify(currentPacket, null, 2), "Memory packet copied.");
}

async function copyGitlawbUri() {
  renderMemoryPacket();
  await copyText(getGitlawbTarget().uri, "Gitlawb URI copied.");
}

async function copyGitlawbCommands() {
  renderMemoryPacket();
  await copyText(gitlawbCommandsPreview.textContent, "Gitlawb publish commands copied.");
}

function useGitlawbUriAsMetadata() {
  metadataFollowsGitlawb = true;
  gitlawbRefInput.value = getGitlawbTarget().uri;
  renderMemoryPacket();
  setStatus("Gitlawb URI is now the onchain metadata URI.");
}

function setBridgeStatus(message) {
  gitlawbBridgeStatus.textContent = message;
}

function setBridgeOutput(message) {
  gitlawbBridgeOutput.textContent = message || "Ready. Press publish to Gitlawb.";
}

function gitlawbWebRepoUrl(target = getGitlawbTarget()) {
  return `https://gitlawb.com/${target.owner.replace("did:key:", "")}/${target.repo}`;
}

function gitlawbRawPacketUrl(target = getGitlawbTarget()) {
  return `https://node.gitlawb.com/${target.owner.replace("did:key:", "")}/${target.repo}/raw/branch/main/${target.path}`;
}

function renderGitlawbPublishMeta({ commit = "", uri = "" } = {}) {
  const target = getGitlawbTarget();
  gitlawbPublishMeta.hidden = false;
  gitlawbRepoLink.href = gitlawbWebRepoUrl(target);
  gitlawbPacketLink.href = gitlawbRawPacketUrl(target);
  gitlawbCommitStatus.textContent = commit
    ? `commit: ${commit.slice(0, 10)}`
    : uri
      ? `packet: ${shortHash(uri)}`
      : "commit: up to date";
}

async function checkGitlawbBridge() {
  try {
    const response = await fetch(`${gitlawbBridgeUrl}/health`, { method: "GET" });
    if (!response.ok) throw new Error("health check failed");
    const result = await response.json();
    setBridgeStatus(result.running ? "bridge: publish in progress" : `bridge: online at ${gitlawbBridgeUrl}`);
    renderGitlawbPublishMeta();
    setBridgeOutput(result.running
      ? "Gitlawb publish is already running. Wait for it to finish."
      : "Ready. Press publish to Gitlawb."
    );
  } catch {
    setBridgeStatus(`bridge: offline. run npm run bridge:gitlawb`);
    setBridgeOutput("Bridge is offline. Run npm run bridge:gitlawb, then refresh this page.");
  }
}

async function publishGitlawbFromBrowser() {
  renderMemoryPacket();
  const target = getGitlawbTarget();
  const packet = currentPacket || buildMemoryPacket();

  publishGitlawbButton.disabled = true;
  publishGitlawbButton.textContent = "publishing...";
  setBridgeStatus("bridge: publishing latest packet...");
  setBridgeOutput("Starting Gitlawb publish...\nThis can take 10-30 seconds while Base Sepolia events are indexed.");
  setStatus("Publishing latest Cortex packet to Gitlawb...");

  try {
    const response = await fetch(`${gitlawbBridgeUrl}/publish-gitlawb`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gitlawbOwner: target.owner,
        gitlawbRepo: target.repo,
        gitlawbPath: target.path,
        agentId: packet.agent_id,
        sourceRef: packet.source_ref,
        memoryPayload: memoryPayloadInput.value.trim(),
        registryAddress,
        memoryRoot: activeRootId,
        memoryHash: packet.memory_hash,
        txHash: packet.tx_hash
      })
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || result.output || "Gitlawb bridge publish failed.");
    }

    const lastLine = (result.output || "").split("\n").filter(Boolean).at(-1) || "Gitlawb publish completed.";
    setBridgeStatus(`bridge: ${lastLine}`);
    setBridgeOutput(result.output || lastLine);
    renderGitlawbPublishMeta({
      commit: result.commit || "",
      uri: result.publishedUri || target.uri
    });
    gitlawbPublished = true;
    renderDemoFlow();
    setStatus(lastLine);
  } catch (error) {
    const message = error.message?.includes("Failed to fetch")
      ? `Gitlawb bridge unreachable at ${gitlawbBridgeUrl}. Open http://localhost:4178/ and run npm run bridge:gitlawb.`
      : error.message || "Gitlawb publish failed.";
    setBridgeStatus(`bridge: ${message}`);
    setBridgeOutput(message);
    setStatus(message);
  } finally {
    publishGitlawbButton.disabled = false;
    publishGitlawbButton.textContent = "publish to Gitlawb";
  }
}

window.cortexPublishGitlawb = publishGitlawbFromBrowser;

function saveLocalPacket(packet) {
  const packets = JSON.parse(localStorage.getItem("cortex.memory.packets") || "[]");
  packets.unshift(packet);
  localStorage.setItem("cortex.memory.packets", JSON.stringify(packets.slice(0, 20)));
}

function formatTimestamp(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "pending";
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setStatus(message) {
  txStatus.textContent = message;
  appStatus.textContent = message;
}

function setFlowStep(element, active) {
  element?.classList.toggle("is-complete", Boolean(active));
}

function renderDemoFlow() {
  setFlowStep(flowWallet, connectedAccount);
  setFlowStep(flowMemory, activeRootId || currentPacket?.committed);
  setFlowStep(flowGitlawb, gitlawbPublished);
}

function explorerUrl(type, value) {
  const base = config.blockExplorerUrls?.[0] || "https://sepolia.basescan.org";
  return `${base}/${type}/${value}`;
}

function renderExplorerLinks({ txHash = "" } = {}) {
  const hasContract = Boolean(registryAddress);
  const hasTx = Boolean(txHash);

  explorerLinks.hidden = !hasContract && !hasTx;

  contractExplorer.hidden = !hasContract;
  if (hasContract) {
    contractExplorer.href = explorerUrl("address", registryAddress);
  }

  txExplorer.hidden = !hasTx;
  if (hasTx) {
    txExplorer.href = explorerUrl("tx", txHash);
  }
}

function hasWalletProvider() {
  return Boolean(window.ethereum);
}

function showRuntimeHint() {
  if (!hasWalletProvider()) {
    setStatus("Wallet provider missing. Open this page in Chrome with MetaMask/Rabby.");
    return;
  }

  if (window.location.protocol === "file:") {
    setStatus("Use http://localhost:4178/ for wallet deploy tests.");
    return;
  }

  setStatus("Ready. Connect wallet or switch Base Sepolia.");
}

function renderRoot(rootId) {
  memoryRootStatus.textContent = rootId ? shortHash(rootId) : "not initialized";
  terminalRoot.textContent = rootId ? shortHash(rootId) : "not_initialized";
  renderDemoFlow();
}

function renderProofState(message) {
  if (message) {
    terminalProof.textContent = message;
    return;
  }
  terminalProof.textContent = registryAddress ? "registry_ready" : "registry_required";
}

function setWalletState({ account = connectedAccount, chainId = activeChainId, message = "" } = {}) {
  connectedAccount = account || "";
  activeChainId = chainId || "";

  const short = shortAddress(connectedAccount);
  const chainName = supportedChains[activeChainId] || (activeChainId ? `unsupported:${activeChainId}` : "unknown");

  walletSummary.textContent = connectedAccount ? short : "wallet:not_connected";
  walletStatus.textContent = connectedAccount ? short : message || "not connected";
  chainStatus.textContent = chainName;
  terminalWallet.textContent = connectedAccount ? `${short} / ${chainName}` : "awaiting_connection";

  walletButton.textContent = connectedAccount ? "disconnect" : "connect wallet";
  walletButton.classList.toggle("is-connected", Boolean(connectedAccount));
  switchWalletButton.hidden = false;
  renderDemoFlow();
}

function clearWalletSession(message = "Wallet disconnected from this app session.") {
  manuallyDisconnected = true;
  localStorage.setItem("cortex.wallet.disconnected", "true");
  localStorage.removeItem("cortex.memory.root");
  activeRootId = "";
  setWalletState({ account: "", chainId: "", message: "disconnected" });
  renderRoot("");
  renderProofState();
  gitlawbPublished = false;
  renderDemoFlow();
  setStatus(message);
}

function disconnectWallet() {
  clearWalletSession();
}

async function revokeWalletPermission() {
  if (!window.ethereum) return false;
  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }]
    });
    return true;
  } catch {
    return false;
  }
}

async function switchWalletAccount() {
  clearWalletSession("Switching wallet account. Choose another account in your wallet.");
  const revoked = await revokeWalletPermission();
  manuallyDisconnected = false;
  localStorage.removeItem("cortex.wallet.disconnected");

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBaseSepolia();
    setWalletState({ account: accounts[0], chainId: await getChainId() });
    setStatus(revoked
      ? "Wallet account switched."
      : "Wallet reconnected. If the same account appears, change the selected account inside your wallet extension."
    );
    await hydrateLatestRoot();
  } catch (error) {
    clearWalletSession(error?.message || "Wallet account switch cancelled.");
  }
}

async function loadArtifact() {
  artifactPromise ||= fetch("./artifacts/MemoryRegistry.json").then((response) => {
    if (!response.ok) throw new Error("Contract artifact missing. Run npm run compile.");
    return response.json();
  });
  return artifactPromise;
}

async function getProvider() {
  if (!window.ethereum) throw new Error("Wallet extension missing.");
  if (!window.ethers) throw new Error("Ethers bundle missing.");
  return new window.ethers.BrowserProvider(window.ethereum);
}

function getReadOnlyProvider() {
  if (!window.ethers) throw new Error("Ethers bundle missing.");
  if (hasWalletProvider() && connectedAccount) {
    return getProvider();
  }
  return new window.ethers.JsonRpcProvider(config.rpcUrls[0]);
}

async function getChainId() {
  if (!window.ethereum) return "";
  return window.ethereum.request({ method: "eth_chainId" });
}

function isUnknownChainError(error) {
  const message = `${error?.message || ""} ${error?.data?.message || ""}`.toLowerCase();
  return error?.code === 4902
    || error?.code === -32603 && message.includes("unrecognized chain")
    || message.includes("unrecognized chain")
    || message.includes("unknown chain")
    || message.includes("not been added");
}

async function addBaseSepolia() {
  setStatus("Base Sepolia is not in this wallet. Confirm adding the network.");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: config.chainId,
      chainName: config.chainName,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: config.rpcUrls,
      blockExplorerUrls: config.blockExplorerUrls
    }]
  });
}

async function ensureBaseSepolia() {
  if (!window.ethereum) throw new Error("Wallet extension missing.");
  const current = await getChainId();
  if (current === config.chainId) {
    activeChainId = current;
    chainStatus.textContent = supportedChains[current];
    return;
  }

  try {
    setStatus("Confirm network switch to Base Sepolia in your wallet.");
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainId }]
    });
  } catch (error) {
    if (!isUnknownChainError(error)) throw error;
    await addBaseSepolia();
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainId }]
    });
  }

  activeChainId = await getChainId();
  chainStatus.textContent = supportedChains[activeChainId] || `unsupported:${activeChainId}`;
}

async function switchToBaseSepolia() {
  try {
    if (!hasWalletProvider()) {
      setWalletState({ message: "wallet extension missing" });
      setStatus("Wallet provider missing. Open http://localhost:4178/ in Chrome with MetaMask/Rabby.");
      return;
    }
    await ensureBaseSepolia();
    setWalletState({ account: connectedAccount, chainId: await getChainId() });
    setStatus("Network switched to Base Sepolia.");
  } catch (error) {
    setStatus(error?.message || "Network switch cancelled.");
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    setWalletState({ message: "wallet extension missing" });
    setStatus("Install or unlock MetaMask/Rabby, then connect again.");
    return;
  }

  walletButton.textContent = "connecting...";

  try {
    manuallyDisconnected = false;
    localStorage.removeItem("cortex.wallet.disconnected");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBaseSepolia();
    setWalletState({ account: accounts[0], chainId: await getChainId() });
    setStatus("Wallet connected. Registry is ready if an address is set.");
    await hydrateLatestRoot();
  } catch (error) {
    setWalletState({ message: error?.message || "connection rejected" });
    setStatus(error?.message || "Wallet connection rejected.");
  }
}

async function getSignedRegistry() {
  if (!registryAddress) throw new Error("Registry contract missing. Deploy or paste a contract address first.");
  await ensureBaseSepolia();
  if (!connectedAccount) await connectWallet();
  if (!connectedAccount) throw new Error("Wallet connection required.");

  const artifact = await loadArtifact();
  const provider = await getProvider();
  const signer = await provider.getSigner();
  return new window.ethers.Contract(registryAddress, artifact.abi, signer);
}

function isMemoryRootExistsError(error) {
  const message = `${error?.shortMessage || ""} ${error?.message || ""} ${error?.data?.message || ""}`;
  return message.includes("MEMORY_ROOT_EXISTS");
}

async function loadExistingMemoryRoot() {
  const registry = await getReadRegistry();
  if (!registry || !connectedAccount) return "";

  const roots = await registry.getOwnerRoots(connectedAccount);
  const latest = roots.at(-1);
  if (!latest) return "";

  activeRootId = latest;
  localStorage.setItem("cortex.memory.root", latest);
  renderRoot(latest);

  const root = await registry.getMemoryRoot(latest);
  gitlawbStatus.textContent = root.gitlawbRef || gitlawbRefInput.value;
  metadataFollowsGitlawb = false;
  gitlawbRefInput.value = root.gitlawbRef || gitlawbRefInput.value;
  renderMemoryPacket();
  await loadOnchainEvents({ quiet: true });

  return latest;
}

async function getReadRegistry() {
  if (!registryAddress || !connectedAccount) return null;
  const artifact = await loadArtifact();
  const provider = await getProvider();
  return new window.ethers.Contract(registryAddress, artifact.abi, provider);
}

function renderEmptyFeed(title, body, status = "idle") {
  eventFeed.replaceChildren();
  const article = document.createElement("article");
  article.className = "feed-empty";
  article.innerHTML = `
    <time>now</time>
    <div>
      <h2></h2>
      <p></p>
    </div>
    <span></span>
  `;
  article.querySelector("h2").textContent = title;
  article.querySelector("p").textContent = body;
  article.querySelector("span").textContent = status;
  eventFeed.append(article);
}

function renderEventFeed(events) {
  eventFeed.replaceChildren();

  if (!events.length) {
    renderEmptyFeed(
      "No onchain memory events found",
      `Create a memory root or commit a memory. The public RPC scan checks the latest ${eventLookbackBlocks} blocks.`,
      "empty"
    );
    return;
  }

  for (const event of events) {
    const article = document.createElement("article");
    const time = document.createElement("time");
    const content = document.createElement("div");
    const title = document.createElement("h2");
    const body = document.createElement("p");
    const label = document.createElement("span");

    time.textContent = event.time;
    title.textContent = event.title;
    body.textContent = event.body;
    label.textContent = event.label;

    content.append(title, body);
    article.append(time, content, label);

    if (event.txHash) {
      article.title = `View transaction: ${event.txHash}`;
      article.addEventListener("click", () => {
        window.open(explorerUrl("tx", event.txHash), "_blank", "noreferrer");
      });
    }

    eventFeed.append(article);
  }
}

async function loadOnchainEvents({ quiet = false } = {}) {
  if (!registryAddress) {
    renderEmptyFeed("Registry required", "Deploy or paste a registry address to load onchain events.", "setup");
    return;
  }

  if (!window.ethers.isAddress(registryAddress)) {
    renderEmptyFeed("Invalid registry address", "Paste a valid 0x contract address, then save.", "error");
    return;
  }

  try {
    if (!quiet) setStatus("Loading onchain memory events...");
    const artifact = await loadArtifact();
    const provider = await getReadOnlyProvider();
    const contract = new window.ethers.Contract(registryAddress, artifact.abi, provider);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - eventLookbackBlocks);

    const [createdLogs, committedLogs] = await Promise.all([
      contract.queryFilter(contract.filters.MemoryRootCreated(), fromBlock, latestBlock),
      contract.queryFilter(contract.filters.MemoryCommitted(), fromBlock, latestBlock)
    ]);

    const events = [...createdLogs, ...committedLogs]
      .sort((a, b) => {
        if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
        return (b.index || 0) - (a.index || 0);
      })
      .slice(0, 12)
      .map((log) => {
        const name = log.fragment?.name;
        if (name === "MemoryRootCreated") {
          return {
            time: formatTimestamp(log.args.createdAt),
            title: "Memory root initialized",
            body: `${shortHash(log.args.rootId)} for ${log.args.agentId} by ${shortAddress(log.args.owner)}.`,
            label: "root",
            txHash: log.transactionHash
          };
        }

        return {
          time: formatTimestamp(log.args.committedAt),
          title: "Memory committed onchain",
          body: `${shortHash(log.args.memoryHash)} from ${log.args.sourceRef || "source_ref"} on root ${shortHash(log.args.rootId)}.`,
          label: `#${log.args.commitCount.toString()}`,
          txHash: log.transactionHash
        };
      });

    renderEventFeed(events);
    if (!quiet) setStatus(`Loaded ${events.length} onchain memory event${events.length === 1 ? "" : "s"}.`);
  } catch (error) {
    renderEmptyFeed(
      "Could not load onchain events",
      error.shortMessage || error.message || "RPC event query failed.",
      "rpc"
    );
    if (!quiet) setStatus(error.shortMessage || error.message || "Could not load onchain events.");
  }
}

async function hydrateLatestRoot() {
  const registry = await getReadRegistry();
  if (!registry || !connectedAccount) return;

  try {
    const latest = await loadExistingMemoryRoot();
    if (latest) {
      setStatus(`Loaded latest memory root ${shortHash(latest)}.`);
    }
  } catch (error) {
    setStatus(`Registry read failed: ${error.shortMessage || error.message}`);
  }
}

function setRegistryAddress(address) {
  registryAddress = address.trim();
  config.contractAddress = registryAddress;
  registryAddressInput.value = registryAddress;
  if (registryAddress) {
    localStorage.setItem("cortex.registry.address", registryAddress);
  } else {
    localStorage.removeItem("cortex.registry.address");
  }
  renderProofState();
  renderExplorerLinks();
  renderMemoryPacket();
  loadOnchainEvents({ quiet: true });
}

async function deployRegistry() {
  try {
    deployRegistryButton.textContent = "deploying...";
    setStatus("Confirm the registry deployment in your wallet.");
    await ensureBaseSepolia();
    if (!connectedAccount) await connectWallet();

    const artifact = await loadArtifact();
    const provider = await getProvider();
    const signer = await provider.getSigner();
    const factory = new window.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy();
    renderExplorerLinks({ txHash: contract.deploymentTransaction()?.hash || "" });
    setStatus("Deployment transaction sent. Waiting for confirmation...");
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    setRegistryAddress(address);
    renderExplorerLinks({ txHash: contract.deploymentTransaction()?.hash || "" });
    renderProofState("registry_deployed");
    setStatus(`Registry deployed at ${address}.`);
    await loadOnchainEvents({ quiet: true });
  } catch (error) {
    setStatus(error.shortMessage || error.message || "Registry deployment failed.");
  } finally {
    deployRegistryButton.textContent = "deploy Base Sepolia registry";
  }
}

async function initializeMemory() {
  try {
    const registry = await getSignedRegistry();
    const agentId = agentIdInput.value.trim();
    const gitlawbRef = gitlawbRefInput.value.trim() || getGitlawbTarget().uri;

    setStatus("Confirm memory root creation in your wallet.");
    const tx = await registry.createMemoryRoot(agentId, gitlawbRef);
    renderExplorerLinks({ txHash: tx.hash });
    renderProofState("tx_pending");
    const receipt = await tx.wait();

    const artifact = await loadArtifact();
    const iface = new window.ethers.Interface(artifact.abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "MemoryRootCreated") {
          activeRootId = parsed.args.rootId;
          localStorage.setItem("cortex.memory.root", activeRootId);
          renderRoot(activeRootId);
          renderMemoryPacket();
          gitlawbStatus.textContent = gitlawbRef;
          break;
        }
      } catch {
        // Ignore logs emitted by other contracts.
      }
    }

    renderProofState("root_created");
    renderExplorerLinks({ txHash: receipt.hash });
    setStatus(`Memory root initialized: ${shortHash(activeRootId)}.`);
    await loadOnchainEvents({ quiet: true });
  } catch (error) {
    if (isMemoryRootExistsError(error)) {
      const existing = await loadExistingMemoryRoot();
      renderProofState("root_exists");
      setStatus(existing
        ? `Memory root already exists: ${shortHash(existing)}. You can commit memory now.`
        : "Memory root already exists. Change agent id to create a new root."
      );
      return;
    }
    setStatus(error.shortMessage || error.message || "Memory initialization failed.");
    renderProofState();
  }
}

async function commitMemory() {
  try {
    if (!activeRootId) {
      await initializeMemory();
      if (!activeRootId) return;
    }

    const registry = await getSignedRegistry();
    const payload = memoryPayloadInput.value.trim();
    const sourceRef = sourceRefInput.value.trim();
    const metadataURI = gitlawbRefInput.value.trim() || getGitlawbTarget().uri;
    const memoryHash = getMemoryPayloadHash();

    setStatus("Confirm memory commit in your wallet.");
    const tx = await registry.commitMemory(activeRootId, memoryHash, sourceRef, metadataURI);
    renderMemoryPacket({ txHash: tx.hash });
    renderExplorerLinks({ txHash: tx.hash });
    renderProofState("commit_pending");
    const receipt = await tx.wait();

    const committedPacket = buildMemoryPacket({ txHash: receipt.hash, committed: true });
    currentPacket = committedPacket;
    gitlawbPublished = false;
    saveLocalPacket(committedPacket);
    packetPreview.textContent = JSON.stringify(committedPacket, null, 2);
    renderDemoFlow();
    renderProofState("memory_committed");
    renderExplorerLinks({ txHash: receipt.hash });
    setStatus(`Memory committed: ${shortHash(memoryHash)}.`);
    await loadOnchainEvents({ quiet: true });
  } catch (error) {
    setStatus(error.shortMessage || error.message || "Memory commit failed.");
    renderProofState();
  }
}

walletButton?.addEventListener("click", () => {
  if (connectedAccount) {
    disconnectWallet();
    return;
  }
  connectWallet();
});
switchWalletButton?.addEventListener("click", switchWalletAccount);
switchNetworkButton?.addEventListener("click", switchToBaseSepolia);
initializeMemoryButton?.addEventListener("click", initializeMemory);
commitMemoryButton?.addEventListener("click", commitMemory);
deployRegistryButton?.addEventListener("click", deployRegistry);
refreshEventsButton?.addEventListener("click", () => loadOnchainEvents());
copyPacketButton?.addEventListener("click", copyCurrentPacket);
copyGitlawbUriButton?.addEventListener("click", copyGitlawbUri);
copyGitlawbCommandsButton?.addEventListener("click", copyGitlawbCommands);
useGitlawbUriButton?.addEventListener("click", useGitlawbUriAsMetadata);
gitlawbRefInput?.addEventListener("input", () => {
  metadataFollowsGitlawb = false;
  renderMemoryPacket();
});
gitlawbPathInput?.addEventListener("input", () => {
  gitlawbPathInput.dataset.touched = "true";
});
[agentIdInput, gitlawbOwnerInput, gitlawbRepoInput, gitlawbPathInput, sourceRefInput, memoryPayloadInput].forEach((input) => {
  input?.addEventListener("input", () => renderMemoryPacket());
});
saveRegistryButton?.addEventListener("click", () => {
  setRegistryAddress(registryAddressInput.value);
  setStatus(registryAddress ? `Registry saved: ${registryAddress}` : "Registry address cleared.");
  hydrateLatestRoot();
});

if (window.ethereum) {
  window.ethereum.request({ method: "eth_accounts" }).then(async (accounts) => {
    if (accounts[0] && !manuallyDisconnected) {
      setWalletState({ account: accounts[0], chainId: await getChainId() });
      await hydrateLatestRoot();
    }
  });

  window.ethereum.on?.("accountsChanged", async (accounts) => {
    if (manuallyDisconnected) return;
    setWalletState({ account: accounts[0] || "", chainId: await getChainId() });
    await hydrateLatestRoot();
  });

  window.ethereum.on?.("chainChanged", async (chainId) => {
    if (manuallyDisconnected) return;
    setWalletState({ account: connectedAccount, chainId });
    await hydrateLatestRoot();
  });
}

showRuntimeHint();
checkGitlawbBridge();
loadOnchainEvents({ quiet: true });
