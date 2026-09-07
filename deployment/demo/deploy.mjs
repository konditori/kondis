// Deployment script for https://demo.kondis.org

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const positional = argumentsList.filter((argument) => argument !== "--dry-run");
const environment = "demo";

if (positional.length > 0) {
  throw new Error("Usage: pnpm run deploy:demo [--dry-run]");
}
if (!process.env.KONDIS_HYPERDRIVE_ID) {
  throw new Error("KONDIS_HYPERDRIVE_ID is required");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const script = fileURLToPath(
  new URL("../../scripts/deploy-cloudflare.mjs", import.meta.url),
);
const configDir = fileURLToPath(new URL(".", import.meta.url));
const child = spawn(
  command,
  [
    "exec",
    "node",
    script,
    environment,
    "--config-dir",
    configDir,
    ...(dryRun ? ["--dry-run"] : []),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      KONDIS_DEMO_MODE: "true",
      KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: "false",
    },
  },
);

child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
