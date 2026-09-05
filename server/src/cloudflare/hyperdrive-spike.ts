import { Client } from 'pg';

export type HyperdriveSpikeResult = {
  serverVersion: string;
  authSessionLookup: number;
  permissionCheck: boolean;
  postgisRouteMatch: number;
  vectorChordNearestNeighbor: number;
  transaction: number;
  rowLock: number;
};

const ZERO_VECTOR = `[${Array.from({ length: 32 }, () => 0).join(',')}]`;

/**
 * Runs the Phase 2 compatibility probes using one Worker-created client.
 * Hyperdrive owns the underlying connection pool; the client is intentionally
 * short-lived and must be closed after the invocation.
 */
export async function runHyperdriveSpike(connectionString: string): Promise<HyperdriveSpikeResult> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const serverVersion = await client.query<{ server_version: string }>(
      'SELECT current_setting($1) AS server_version',
      ['server_version'],
    );
    const authSessionLookup = await client.query(
      `SELECT id
       FROM auth_session
       WHERE token_hash = $1 AND expires_at > $2
       ORDER BY expires_at DESC
       LIMIT 1`,
      ['', new Date()],
    );
    const permissionCheck = await client.query<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM activity
         WHERE user_id = $1 AND exclude_from_rankings = $2
       ) AS allowed`,
      ['00000000-0000-0000-0000-000000000000', false],
    );
    const postgisRouteMatch = await client.query(
      `SELECT id
       FROM activity
       WHERE track IS NOT NULL
         AND ST_DWithin(
           track,
           ST_SetSRID(ST_GeomFromText($1), 4326)::geography,
           $2
         )
       LIMIT 10`,
      ['LINESTRING(0 0, 0.001 0.001)', 250],
    );
    const vectorChordNearestNeighbor = await client.query(
      `SELECT id
       FROM activity
       WHERE route_embedding IS NOT NULL
       ORDER BY route_embedding <-> $1::vector
       LIMIT 1`,
      [ZERO_VECTOR],
    );

    await client.query('BEGIN');
    try {
      const transaction = await client.query<{ value: number }>('SELECT $1::integer AS value', [1]);
      await client.query('SELECT $1::integer AS value', [2]);
      const rowLock = await client.query(
        `SELECT id
         FROM auth_session
         WHERE expires_at > $1
         ORDER BY expires_at
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [new Date()],
      );
      await client.query('COMMIT');

      return {
        serverVersion: serverVersion.rows[0]?.server_version ?? 'unknown',
        authSessionLookup: authSessionLookup.rowCount ?? 0,
        permissionCheck: permissionCheck.rows[0]?.allowed ?? false,
        postgisRouteMatch: postgisRouteMatch.rowCount ?? 0,
        vectorChordNearestNeighbor: vectorChordNearestNeighbor.rowCount ?? 0,
        transaction: transaction.rows[0]?.value ?? 0,
        rowLock: rowLock.rowCount ?? 0,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    }
  } finally {
    await client.end();
  }
}
