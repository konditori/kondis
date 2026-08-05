import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUTPUT_PATH = resolve(process.cwd(), '..', 'THIRD-PARTY-LICENSES.md');

type PnpmLicensePackage = {
  name: string;
  versions: string[];
  paths: string[];
  license: string;
  author?: string;
  homepage?: string;
};

type Notice = {
  name: string;
  versions: string[];
  license: string;
  author?: string;
  homepage?: string;
  licenseTexts: string[];
  platformVariants: string[];
};

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const readPackageManifest = (directory: string): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const readLicenseTexts = (directory: string): string[] => {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => LICENSE_FILE.test(entry))
    .sort()
    .flatMap((entry) => {
      try {
        const text = readFileSync(join(directory, entry), 'utf8').trim();
        return text.length > 0 ? [text] : [];
      } catch {
        // A directory named `license`, or an unreadable file. Neither is a licence text.
        return [];
      }
    });
};

const isPlatformGated = (manifest: Record<string, unknown>): boolean =>
  Array.isArray(manifest.os) || Array.isArray(manifest.cpu);

const collectNotices = (packages: PnpmLicensePackage[]): { notices: Notice[]; missingText: string[] } => {
  const platformGated = new Set<string>();
  for (const pkg of packages) {
    if (isPlatformGated(readPackageManifest(pkg.paths[0]))) {
      platformGated.add(pkg.name);
    }
  }

  const attributed = new Set(packages.map((pkg) => pkg.name).filter((name) => !platformGated.has(name)));

  const notices: Notice[] = [];
  const missingText: string[] = [];

  for (const pkg of packages) {
    if (platformGated.has(pkg.name)) {
      continue;
    }

    const manifest = readPackageManifest(pkg.paths[0]);
    const optional = Object.keys((manifest.optionalDependencies as Record<string, string> | undefined) ?? {});
    const licenseTexts = readLicenseTexts(pkg.paths[0]);

    if (licenseTexts.length === 0) {
      missingText.push(`${pkg.name} (${pkg.license})`);
    }

    const hasNativeBuilds = optional.some((dependency) => platformGated.has(dependency));
    const platformVariants = hasNativeBuilds ? optional.filter((dependency) => !attributed.has(dependency)) : [];

    notices.push({
      name: pkg.name,
      versions: [...pkg.versions].sort(),
      license: pkg.license,
      author: pkg.author,
      homepage: pkg.homepage,
      licenseTexts,
      platformVariants: platformVariants.sort(),
    });
  }

  return { notices: notices.sort(byName), missingText: missingText.sort() };
};

const renderNotice = (notice: Notice): string => {
  const lines = [`## ${notice.name}`, '', `- Version: ${notice.versions.join(', ')}`, `- License: ${notice.license}`];

  if (notice.author) {
    lines.push(`- Author: ${notice.author}`);
  }
  if (notice.homepage) {
    lines.push(`- Homepage: ${notice.homepage}`);
  }
  if (notice.platformVariants.length > 0) {
    lines.push(
      '- Also covers these per-platform prebuilt binaries, published under the same license',
      `  (only the one matching the host is installed): ${notice.platformVariants.join(', ')}`,
    );
  }

  lines.push('');

  if (notice.licenseTexts.length === 0) {
    lines.push(
      `> This package does not distribute a license file. It declares \`${notice.license}\` in its`,
      '> `package.json`; refer to the homepage above for the copyright holder.',
      '',
    );
    return lines.join('\n');
  }

  for (const text of notice.licenseTexts) {
    lines.push('```', text, '```', '');
  }

  return lines.join('\n');
};

const render = (notices: Notice[]): string => {
  const licenses = [...new Set(notices.map((notice) => notice.license))].sort();

  return [
    '# Third-party licenses',
    '',
    'Kondis is licensed under AGPL-3.0-or-later; see [LICENSE](./LICENSE).',
    '',
    'It bundles the third-party packages listed below. Each is distributed under a permissive',
    'license that permits inclusion in an AGPL-covered work, and each requires that its copyright',
    'and permission notice be preserved. Those notices are reproduced here in full.',
    '',
    'The scope is the production dependency closure of `kondis-server` — precisely what',
    '`pnpm --prod deploy` places in the runtime image. Development dependencies are not',
    'distributed and are therefore not listed.',
    '',
    'This file is generated. Run `mise run third-party-licenses` to update it; do not edit it by hand.',
    '',
    `Packages: ${notices.length}. Licenses in use: ${licenses.join(', ')}.`,
    '',
    '---',
    '',
    notices.map((notice) => renderNotice(notice)).join('\n---\n\n'),
  ].join('\n');
};

async function run(): Promise<void> {
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--filter', 'kondis-server', '--json'], {
    encoding: 'utf8',
    // The dependency closure is large enough to overrun the 1 MB default.
    maxBuffer: 64 * 1024 * 1024,
  });

  const grouped = JSON.parse(raw) as Record<string, PnpmLicensePackage[]>;
  const { notices, missingText } = collectNotices(Object.values(grouped).flat());

  if (notices.length === 0) {
    throw new Error('pnpm reported no production dependencies, which cannot be right');
  }

  await writeFile(OUTPUT_PATH, render(notices), 'utf8');

  console.log(`Wrote ${notices.length} notices to ${OUTPUT_PATH}`);
  if (missingText.length > 0) {
    // Not fatal: a package omitting its own license file is an upstream packaging bug, and the
    // declared SPDX identifier still records the terms we received it under.
    console.warn(`\n${missingText.length} package(s) ship no license file:`);
    for (const name of missingText) {
      console.warn(`  - ${name}`);
    }
  }
}

run().catch((error: unknown) => {
  console.error('Failed to generate third-party licenses:', error);
  process.exitCode = 1;
});
