import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const contractPath = path.resolve("contracts/MemoryRegistry.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "MemoryRegistry.sol": {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((item) => item.severity === "error") || [];

if (errors.length) {
  for (const error of errors) {
    console.error(error.formattedMessage);
  }
  process.exit(1);
}

const contract = output.contracts["MemoryRegistry.sol"].MemoryRegistry;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/MemoryRegistry.json",
  JSON.stringify(
    {
      contractName: "MemoryRegistry",
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`
    },
    null,
    2
  )
);

fs.mkdirSync("vendor", { recursive: true });
fs.copyFileSync(
  "node_modules/ethers/dist/ethers.umd.min.js",
  "vendor/ethers.umd.min.js"
);

console.log("Compiled MemoryRegistry -> artifacts/MemoryRegistry.json");
console.log("Copied ethers browser bundle -> vendor/ethers.umd.min.js");
