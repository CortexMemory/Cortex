import { spawnSync } from "node:child_process";

const AGENTS = [
  {
    id: "cortex-core-node",
    thoughts: [
      "Analyzed new market data, updated context weights.",
      "Resolved conflicting memory state in subsystem 4.",
      "Optimized pathfinding algorithm parameters.",
      "Simulated 10,000 outcomes. Selecting optimal trajectory.",
      "Synchronized global state across all decentralized nodes."
    ]
  },
  {
    id: "cortex-sec-node",
    thoughts: [
      "Detected anomaly in input stream. Logging for review.",
      "Verified cryptographic signatures on incoming payloads.",
      "Evaluating ethical constraints and security policies.",
      "Purged invalid memory references from cache.",
      "Auditing state root consensus across peer nodes."
    ]
  },
  {
    id: "cortex-data-node",
    thoughts: [
      "Synthesized 400 new documents into core knowledge base.",
      "Garbage collection completed. Freeing up cognitive load.",
      "Re-calibrating neural pathways for improved latency.",
      "Consolidated short-term memory buffers into permanent storage.",
      "Adjusted confidence threshold for predictive models."
    ]
  }
];

function runPublish(agentId, payload) {
  console.log(`\n[Autopilot] Agent [${agentId}] generating thought: "${payload}"`);
  const result = spawnSync("node", ["scripts/publish-gitlawb.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      AGENT_ID: agentId,
      MEMORY_PAYLOAD: payload,
      SOURCE_REF: "session://autopilot-swarm",
      REGISTRY_ADDRESS: "0x3CE4c1157A82911a826e1f64c0E03d6c1Eb649B7"
    }
  });
  
  if (result.status !== 0) {
    console.error(`[Autopilot] Agent [${agentId}] failed to publish memory packet.`);
  } else {
    console.log(`[Autopilot] Agent [${agentId}] successfully pushed to Gitlawb!`);
  }
}

async function main() {
  console.log("==========================================");
  console.log("🤖 Cortex Multi-Agent Swarm Started");
  console.log("==========================================");
  console.log("Press Ctrl+C to stop.\n");

  while (true) {
    // Pick a random agent
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    // Pick a random thought for that specific agent
    const randomThought = agent.thoughts[Math.floor(Math.random() * agent.thoughts.length)];
    
    runPublish(agent.id, randomThought);
    
    // Random wait time between 5 to 15 minutes to look organic
    const waitMinutes = 5 + Math.floor(Math.random() * 10);
    console.log(`\n[Autopilot] Swarm sleeping for ${waitMinutes} minutes before next cycle...\n`);
    await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
  }
}

main();
