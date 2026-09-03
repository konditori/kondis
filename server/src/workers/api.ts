import 'reflect-metadata';

import { bootstrapApi } from 'src/main';

process.title = 'kondis-api';

void bootstrapApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
