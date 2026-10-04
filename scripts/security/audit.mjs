import { spawnSync } from "node:child_process";
import { verifySecurityPatches } from "./verify-patches.mjs";

const verifiedPatches = await verifySecurityPatches();
const result = spawnSync("pnpm", ["audit", "--prod", "--json"], {
  encoding: "utf8",
  cwd: new URL("../..", import.meta.url),
  maxBuffer: 16 * 1024 * 1024,
});
if (result.error) throw result.error;
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  throw new Error(
    `Audit did not return JSON: ${result.stderr || result.stdout}`,
  );
}
if (audit.error || !audit.metadata)
  throw new Error(`Audit failed: ${JSON.stringify(audit.error || audit)}`);
let failed = false;
let remaining = 0;
for (const advisory of Object.values(audit.advisories || {})) {
  const paths = advisory.findings.flatMap((finding) => finding.paths);
  const patch = verifiedPatches.get(advisory.github_advisory_id);
  const locallyFixed =
    patch &&
    advisory.module_name === patch.name &&
    advisory.findings.length > 0 &&
    advisory.findings.every((finding) => finding.version === patch.version);
  console.log(
    `${advisory.severity}: ${advisory.module_name} — ${advisory.url}${locallyFixed ? " (fixed by verified local source patch; registry scans package versions)" : ""}`,
  );
  for (const path of paths.slice(0, 3)) console.log(`  ${path}`);
  if (paths.length > 3)
    console.log(`  … ${paths.length - 3} more dependency paths`);
  if (["high", "critical"].includes(advisory.severity) && !locallyFixed) {
    failed = true;
    remaining++;
  }
}
console.log(
  `Registry version findings: ${JSON.stringify(audit.metadata.vulnerabilities)}`,
);
console.log(`Unremediated high/critical advisories: ${remaining}`);
process.exitCode = failed ? 1 : 0;
