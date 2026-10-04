# Dependency audit

Run `node scripts/security/audit.mjs` from a mise shell after a frozen install.
CI fails on high or critical production dependency findings. An unavailable audit
service also fails the job. Findings print their dependency paths, so runtime
packages and documentation build tools can be assessed separately.

The theme upgrade patches multer, Hono, fast-uri, ip-address, devalue, undici,
Joi and brace-expansion. API documentation's Wrangler belongs in devDependencies;
it is a deployment tool and is never served to visitors.

The documentation dependencies use pinned source patches for two advisories.
There are no documentation-build exceptions or advisory ignore rules.

- [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp):
  `http-cache-semantics` is upgraded to 4.3.0 and patched to prevent `max-stale`,
  `stale-while-revalidate` and `stale-if-error` from bypassing security-related
  cache restrictions. The unpatched 4.3.0 release still reproduces the original
  `Set-Cookie`, `proxy-revalidate` and `no-cache` failures despite falling outside
  the advisory's published version range. The override's exact release-age
  exclusion permits this newly published version; regression checks verify its
  installed source. Ordinary public caching, explicit public cookies and private
  non-shared caches retain their behavior.
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  `braces@3.0.3` has a narrow backport of the depth and cycle guards from
  [upstream PR #72](https://github.com/micromatch/braces/pull/72), pinned to commit
  `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`. Brace/parenthesis nesting and direct
  AST traversal are capped at 100 levels, stricter fractional limits work, and
  cyclic AST parent chains are rejected. Unrelated unreleased parser changes
  are excluded and `stringify` keeps its existing `escapeInvalid` behavior.

pnpm applies the patches from `patches/` during every install and pins their
hashes in the lockfile. Before auditing, `verify-patches.mjs` discovers every
installed instance through pnpm's dependency graph, verifies the patched source
hashes in `patched-packages.json`, and runs adversarial and compatibility checks.
An absent patch, unexpected version, changed source or failing regression fails
CI. Only the exact advisory/package/version whose installed fix was verified is
treated as remediated. Other findings retain their normal severity gate.

The registry still reports `braces@3.0.3` because it scans package versions rather
than patched source. Its finding remains visible in the audit output, alongside
the count of unremediated advisories. Do not rename the package or suppress the
advisory to produce a clean version-only report.

Run the local verification independently with:

```sh
node scripts/security/verify-patches.mjs
```

When official releases fix these behaviors, upgrade, rerun the regressions and
both documentation builds, then remove the corresponding patch, manifest entry
and override. Update source hashes only after reviewing the installed changes.
