import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // VectorChord supplies the ANN index while its pgvector dependency supplies the vector type.
  await sql`CREATE EXTENSION IF NOT EXISTS vchord CASCADE`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION kondis_route_embedding(route geography)
    RETURNS vector(32) AS $$
      WITH samples AS (
        SELECT
          sample_index,
          ST_Transform(ST_LineInterpolatePoint(route::geometry, sample_index / 15.0), 3857) AS forward_point,
          ST_Transform(ST_LineInterpolatePoint(route::geometry, 1 - sample_index / 15.0), 3857) AS reverse_point
        FROM generate_series(0, 7) AS sample_index
      ), dimensions AS (
        SELECT sample_index, 0 AS axis, (ST_X(forward_point) + ST_X(reverse_point)) / 20000.0 AS value FROM samples
        UNION ALL
        SELECT sample_index, 1 AS axis, (ST_Y(forward_point) + ST_Y(reverse_point)) / 20000.0 AS value FROM samples
        UNION ALL
        SELECT sample_index, 2 AS axis, abs(ST_X(forward_point) - ST_X(reverse_point)) / 10000.0 AS value FROM samples
        UNION ALL
        SELECT sample_index, 3 AS axis, abs(ST_Y(forward_point) - ST_Y(reverse_point)) / 10000.0 AS value FROM samples
      )
      SELECT array_agg(value::real ORDER BY sample_index, axis)::vector(32)
      FROM dimensions
    $$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  `.execute(db);

  await sql`ALTER TABLE activity ADD COLUMN route_embedding vector(32)`.execute(db);
  await sql`UPDATE activity SET route_embedding = kondis_route_embedding(track) WHERE track IS NOT NULL`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION kondis_set_route_embedding() RETURNS trigger AS $$
    BEGIN
      NEW.route_embedding = CASE
        WHEN NEW.track IS NULL THEN NULL
        ELSE kondis_route_embedding(NEW.track)
      END;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);
  await sql`
    CREATE TRIGGER activity_set_route_embedding
    BEFORE INSERT OR UPDATE OF track ON activity
    FOR EACH ROW EXECUTE FUNCTION kondis_set_route_embedding()
  `.execute(db);

  await sql`
    CREATE INDEX activity_route_embedding_idx
    ON activity USING vchordrq (route_embedding vector_l2_ops)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS activity_route_embedding_idx`.execute(db);
  await sql`DROP TRIGGER IF EXISTS activity_set_route_embedding ON activity`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_set_route_embedding()`.execute(db);
  await sql`ALTER TABLE activity DROP COLUMN IF EXISTS route_embedding`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_route_embedding(geography)`.execute(db);
}
