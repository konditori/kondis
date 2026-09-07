import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const environment = process.argv[2];
const dryRun = process.argv.slice(3).includes("--dry-run");

if (
  !["production", "preview"].includes(environment) ||
  process.argv.slice(3).some((argument) => argument !== "--dry-run")
) {
  throw new Error(
    "Usage: pnpm run deploy:demo <production|preview> [--dry-run]",
  );
}
if (!process.env.KONDIS_HYPERDRIVE_ID) {
  throw new Error("KONDIS_HYPERDRIVE_ID is required");
}
if (!process.env.KONDIS_DEMO_USER_ID) {
  throw new Error("KONDIS_DEMO_USER_ID is required for public demo access");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const script = fileURLToPath(
  new URL("./deploy-cloudflare.mjs", import.meta.url),
);
const child = spawn(
  command,
  ["exec", "node", script, environment, ...(dryRun ? ["--dry-run"] : [])],
  {
    stdio: "inherit",
    env: { ...process.env, KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: "false" },
  },
);

child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
