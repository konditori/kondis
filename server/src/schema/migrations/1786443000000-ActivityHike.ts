import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity DROP CONSTRAINT activity_sport_check`.execute(db);
  await sql`
    ALTER TABLE activity ADD CONSTRAINT activity_sport_check CHECK (
      sport IN ('run', 'ride', 'trail_run', 'walk', 'hike', 'swim', 'alpine_ski', 'roller_ski', 'cross_country_ski', 'other')
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE activity SET sport = 'other' WHERE sport = 'hike'`.execute(db);
  await sql`ALTER TABLE activity DROP CONSTRAINT activity_sport_check`.execute(db);
  await sql`
    ALTER TABLE activity ADD CONSTRAINT activity_sport_check CHECK (
      sport IN ('run', 'ride', 'trail_run', 'walk', 'swim', 'alpine_ski', 'roller_ski', 'cross_country_ski', 'other')
    )
  `.execute(db);
}
