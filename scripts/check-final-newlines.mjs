import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const violations = [];

for (const file of files) {
  if (!statSync(file).isFile()) continue;

  const contents = readFileSync(file);

  // Binary assets are not source files and do not have line endings to check.
  if (contents.includes(0)) continue;

  let finalNewlineCount = 0;
  for (let index = contents.length - 1; index >= 0 && contents[index] === 0x0a; index--) {
    finalNewlineCount++;
  }

  if (finalNewlineCount !== 1) {
    violations.push(`${file} (${finalNewlineCount} final newlines)`);
  }
}

if (violations.length > 0) {
  console.error('Files must end with exactly one newline:');
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
