import { rm } from 'node:fs/promises';

import { sql } from 'kysely';
import { ConfigService } from 'src/config/config.service';
import { createDatabase } from 'src/db/database';

const CONFIRMATION_FLAG = '--confirm';

const quoteIdentifier = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

async function resetDevelopmentData(): Promise<void> {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(`Refusing to reset data without ${CONFIRMATION_FLAG}.`);
  }

  const config = new ConfigService();
  const db = createDatabase(config.database);

  try {
    const queueTables = await sql<{ tablename: string }>`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = ${config.jobs.schema}
        AND tablename <> 'version'
    `.execute(db);

    await db.transaction().execute(async (trx) => {
      // Keep every user account (including its admin role, password, and avatar),
      // while removing data that is created while using the app.
      await sql`
        TRUNCATE TABLE
          notification,
          follow_request,
          user_follow,
          user_block,
          live_workout,
          upload
        RESTART IDENTITY CASCADE
      `.execute(trx);

      if (queueTables.rows.length > 0) {
        const tables = queueTables.rows
          .map(({ tablename }) => `${quoteIdentifier(config.jobs.schema)}.${quoteIdentifier(tablename)}`)
          .join(', ');
        await sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`).execute(trx);
      }
    });

    // These directories only hold resettable data. Avatars deliberately live outside them.
    await Promise.all(
      ['activities', 'images', 'temporary'].map((directory) =>
        rm(config.storageDir + `/${directory}`, { force: true, recursive: true }),
      ),
    );

    console.log('Development data reset. User accounts and avatars were kept.');
  } finally {
    await db.destroy();
  }
}

void resetDevelopmentData().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
