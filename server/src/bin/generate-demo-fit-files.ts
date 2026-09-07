import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { DEMO_FIT_SPECS, createDemoFitFile } from 'src/demo/fit';

const outputDirectory = resolve(import.meta.dirname, '../../demo/fit');

const generate = async (): Promise<void> => {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    DEMO_FIT_SPECS.map((spec) => writeFile(join(outputDirectory, spec.filename), createDemoFitFile(spec))),
  );
  console.log(`Generated ${DEMO_FIT_SPECS.length} demo FIT files in ${outputDirectory}`);
};

void generate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
