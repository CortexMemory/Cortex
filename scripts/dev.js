import net from "node:net";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const services = [
  {
    name: "site",
    port: 4178,
    command: "python3",
    args: ["-m", "http.server", "4178"]
  },
  {
    name: "gitlawb bridge",
    port: 4181,
    command: "node",
    args: ["scripts/gitlawb-bridge.js"]
  }
];

const children = [];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function startService(service) {
  const child = spawn(service.command, service.args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `${join(homedir(), ".local", "bin")}:${process.env.PATH || ""}`,
      GITLAWB_NODE: process.env.GITLAWB_NODE || "https://node.gitlawb.com"
    }
  });

  children.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${service.name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${service.name}] ${chunk}`);
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${service.name}] exited with code ${code}`);
    }
  });
}

for (const service of services) {
  if (await isPortOpen(service.port)) {
    console.log(`[${service.name}] already running on http://127.0.0.1:${service.port}`);
  } else {
    console.log(`[${service.name}] starting on http://127.0.0.1:${service.port}`);
    startService(service);
  }
}

console.log("Cortex dev stack ready:");
console.log("  site:   http://localhost:4178/");
console.log("  bridge: http://127.0.0.1:4181/health");

function shutdown() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (children.length > 0) {
  await new Promise(() => {});
}
