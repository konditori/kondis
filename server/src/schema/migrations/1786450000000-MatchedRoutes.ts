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
          ST_Transform(ST_LineInterpolatePoint(route::geometry, sample_index / 15.0), 3857) AS point
        FROM generate_series(0, 15) AS sample_index
      ), dimensions AS (
        SELECT sample_index, 0 AS axis, ST_X(point) / 10000.0 AS value FROM samples
        UNION ALL
        SELECT sample_index, 1 AS axis, ST_Y(point) / 10000.0 AS value FROM samples
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

  await sql`
    CREATE TABLE activity_route_match (
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      matched_activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      PRIMARY KEY (activity_id, matched_activity_id)
    )
  `.execute(db);

  // Persist matches for existing activities. Future imports use the same predicates in ActivityRepository.
  await sql`
    INSERT INTO activity_route_match (activity_id, matched_activity_id)
    SELECT source.id, candidate.id
    FROM activity AS source
    CROSS JOIN LATERAL (
      SELECT candidate.id, candidate.track
      FROM activity AS candidate
      WHERE candidate.sport = source.sport
        AND candidate.track IS NOT NULL
        AND candidate.route_embedding IS NOT NULL
        AND ST_DWithin(candidate.track, source.track, 250)
      ORDER BY candidate.route_embedding <-> source.route_embedding
      LIMIT 250
    ) AS candidate
    WHERE source.track IS NOT NULL AND source.route_embedding IS NOT NULL
      AND (
        candidate.id = source.id
        OR (
          ST_Length(candidate.track) / NULLIF(ST_Length(source.track), 0) BETWEEN 0.88 AND 1.14
          AND ST_DWithin(ST_StartPoint(candidate.track::geometry)::geography, ST_StartPoint(source.track::geometry)::geography, 120)
          AND ST_DWithin(ST_EndPoint(candidate.track::geometry)::geography, ST_EndPoint(source.track::geometry)::geography, 120)
          AND ST_FrechetDistance(
            ST_Transform(candidate.track::geometry, 3857),
            ST_Transform(source.track::geometry, 3857)
          ) <= 100
        )
      )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS activity_route_match`.execute(db);
  await sql`DROP INDEX IF EXISTS activity_route_embedding_idx`.execute(db);
  await sql`DROP TRIGGER IF EXISTS activity_set_route_embedding ON activity`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_set_route_embedding()`.execute(db);
  await sql`ALTER TABLE activity DROP COLUMN IF EXISTS route_embedding`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_route_embedding(geography)`.execute(db);
}
