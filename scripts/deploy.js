import fs from "node:fs";
import { ethers } from "ethers";

const rpcUrl = process.env.RPC_URL || "https://sepolia.base.org";
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error("Missing PRIVATE_KEY. Example: PRIVATE_KEY=0x... npm run deploy:base-sepolia");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync("artifacts/MemoryRegistry.json", "utf8"));
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

console.log(`Deploying MemoryRegistry from ${wallet.address}`);
const contract = await factory.deploy();
await contract.waitForDeployment();

const address = await contract.getAddress();
const network = await provider.getNetwork();
const deployment = {
  contract: "MemoryRegistry",
  address,
  chainId: Number(network.chainId),
  rpcUrl,
  deployedAt: new Date().toISOString()
};

fs.mkdirSync("deployments", { recursive: true });
fs.writeFileSync("deployments/base-sepolia.json", JSON.stringify(deployment, null, 2));

console.log(`MemoryRegistry deployed: ${address}`);
console.log("Saved deployment -> deployments/base-sepolia.json");
