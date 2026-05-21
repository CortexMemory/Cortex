import http from "node:http";
import os from "node:os";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 4181);
const maxBodySize = 64 * 1024;
let running = false;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-allow-private-network": "true"
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBodySize) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function cleanEnvValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildPublishEnv(payload) {
  const allowed = {
    GITLAWB_OWNER: cleanEnvValue(payload.gitlawbOwner),
    GITLAWB_REPO: cleanEnvValue(payload.gitlawbRepo),
    GITLAWB_PATH: cleanEnvValue(payload.gitlawbPath),
    AGENT_ID: cleanEnvValue(payload.agentId),
    SOURCE_REF: cleanEnvValue(payload.sourceRef),
    MEMORY_PAYLOAD: cleanEnvValue(payload.memoryPayload),
    REGISTRY_ADDRESS: cleanEnvValue(payload.registryAddress),
    MEMORY_ROOT: cleanEnvValue(payload.memoryRoot),
    MEMORY_HASH: cleanEnvValue(payload.memoryHash),
    TX_HASH: cleanEnvValue(payload.txHash)
  };

  return Object.fromEntries(Object.entries(allowed).filter(([, value]) => value));
}

function runPublish(payload) {
  return new Promise((resolve) => {
    const childEnv = {
      ...process.env,
      PATH: `${os.homedir()}/.local/bin:${process.env.PATH || ""}`,
      GITLAWB_NODE: process.env.GITLAWB_NODE || "https://node.gitlawb.com",
      ...buildPublishEnv(payload)
    };

    const child = spawn("npm", ["run", "publish:gitlawb"], {
      cwd: process.cwd(),
      env: childEnv
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code, output: output.trim() });
    });
  });
}

function parsePublishResult(output, payload) {
  const publishedUri = output.match(/Published\s+(gitlawb:\/\/\S+)/)?.[1] || "";
  const commit = output.match(/\[main\s+([0-9a-f]+)\]/i)?.[1] || "";
  const owner = cleanEnvValue(payload.gitlawbOwner);
  const repo = cleanEnvValue(payload.gitlawbRepo);
  const path = cleanEnvValue(payload.gitlawbPath);
  const shortOwner = owner.replace(/^did:key:/, "");

  return {
    publishedUri,
    commit,
    repoUrl: owner && repo ? `https://gitlawb.com/${shortOwner}/${repo}` : "",
    packetUrl: owner && repo && path ? `https://node.gitlawb.com/${shortOwner}/${repo}/raw/branch/main/${path}` : ""
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "cortex-gitlawb-bridge",
      running
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/publish-gitlawb") {
    sendJson(response, 404, { ok: false, error: "Not found." });
    return;
  }

  if (running) {
    sendJson(response, 409, { ok: false, error: "Gitlawb publish is already running." });
    return;
  }

  try {
    const payload = await readJson(request);
    running = true;
    const result = await runPublish(payload);
    running = false;

    sendJson(response, result.code === 0 ? 200 : 500, {
      ok: result.code === 0,
      code: result.code,
      output: result.output,
      ...parsePublishResult(result.output, payload)
    });
  } catch (error) {
    running = false;
    sendJson(response, 400, { ok: false, error: error.message || "Publish failed." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Cortex Gitlawb bridge listening on http://127.0.0.1:${port}`);
});
