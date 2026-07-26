import { Provider } from '@nestjs/common';

import { DatabaseLifecycle, databaseProvider } from 'src/db/database';

export const databaseProviders: Provider[] = [databaseProvider, DatabaseLifecycle];
