import { Kysely, sql } from 'kysely';

const rebuildRouteMatches = async (db: Kysely<unknown>, frechetToleranceMeters: number): Promise<void> => {
  await sql`DELETE FROM activity_route_match`.execute(db);
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
    WHERE source.track IS NOT NULL
      AND source.route_embedding IS NOT NULL
      AND (
        candidate.id = source.id
        OR (
          ST_Length(candidate.track) / NULLIF(ST_Length(source.track), 0) BETWEEN 0.88 AND 1.14
          AND ST_DWithin(
            ST_StartPoint(candidate.track::geometry)::geography,
            ST_StartPoint(source.track::geometry)::geography,
            120
          )
          AND ST_DWithin(
            ST_EndPoint(candidate.track::geometry)::geography,
            ST_EndPoint(source.track::geometry)::geography,
            120
          )
          AND ST_FrechetDistance(
            ST_Transform(kondis_normalize_route(candidate.track), 3857),
            ST_Transform(kondis_normalize_route(source.track), 3857)
          ) <= ${frechetToleranceMeters}
        )
      )
  `.execute(db);
};

export async function up(db: Kysely<unknown>): Promise<void> {
  await rebuildRouteMatches(db, 200);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await rebuildRouteMatches(db, 100);
}
