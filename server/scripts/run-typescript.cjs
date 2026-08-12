const { resolve } = require('node:path');

const [entry, ...args] = process.argv.slice(2);

if (!entry) {
  throw new Error('Usage: run-typescript.cjs <entry> [...args]');
}

const resolvedEntry = resolve(process.cwd(), entry);
process.argv = [process.argv[0], resolvedEntry, ...args];
require(resolvedEntry);
