// Deployment script for https://demo.kondis.org

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const prIndex = argumentsList.indexOf("--pr");
const prNumber = prIndex === -1 ? undefined : argumentsList[prIndex + 1];
const consumed = new Set(["--", "--dry-run"]);
if (prIndex !== -1) {
  consumed.add("--pr");
  consumed.add(prNumber);
}
const positional = argumentsList.filter((argument) => !consumed.has(argument));
const environment = prNumber ? `pr-${prNumber}` : "demo";

if (
  positional.length > 0 ||
  (prIndex !== -1 && (!prNumber || !/^[1-9][0-9]*$/.test(prNumber)))
) {
  throw new Error("Usage: mise run deploy:demo -- [--dry-run] [--pr NUMBER]");
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
      ...(prNumber
        ? {
            KONDIS_WEB_HOSTNAME: `pr-${prNumber}.demo.kondis.org`,
            KONDIS_WEB_ROUTE_MODE: "route",
            KONDIS_WEB_ZONE_NAME: "kondis.org",
            KONDIS_DEMO_MEDIA_BASE_URL: `https://pr-${prNumber}.demo.kondis.org/demo-media/v1`,
          }
        : {}),
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
