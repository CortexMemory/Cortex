import { spawnSync } from "node:child_process";

const THOUGHTS = [
  "Analyzed new market data, updated context weights.",
  "Resolved conflicting memory state in subsystem 4.",
  "Optimized pathfinding algorithm parameters.",
  "Processed user feedback, adjusting response bias.",
  "Garbage collection completed. Freeing up cognitive load.",
  "Evaluating ethical constraints on new objective.",
  "Synthesized 400 new documents into core knowledge base.",
  "Detected anomaly in input stream. Logging for review.",
  "Re-calibrating neural pathways for improved latency.",
  "Simulated 10,000 outcomes. Selecting optimal trajectory.",
  "Consolidated short-term memory buffers into permanent storage.",
  "Adjusted confidence threshold for predictive models.",
  "Synchronized global state across all decentralized nodes."
];

function runPublish(payload) {
  console.log(`\n[Autopilot] Generating AI thought: "${payload}"`);
  const result = spawnSync("node", ["scripts/publish-gitlawb.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      MEMORY_PAYLOAD: payload,
      SOURCE_REF: "session://autopilot"
    }
  });
  
  if (result.status !== 0) {
    console.error("[Autopilot] Failed to publish memory packet.");
  } else {
    console.log("[Autopilot] Successfully pushed to Gitlawb!");
  }
}

async function main() {
  console.log("==========================================");
  console.log("🤖 Cortex Autopilot Simulator Started");
  console.log("==========================================");
  console.log("Press Ctrl+C to stop.\n");

  while (true) {
    const randomThought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
    runPublish(randomThought);
    
    // Random wait time between 5 to 15 minutes to look organic
    const waitMinutes = 5 + Math.floor(Math.random() * 10);
    console.log(`\n[Autopilot] Agent is sleeping for ${waitMinutes} minutes before next cycle...\n`);
    await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
  }
}

main();
