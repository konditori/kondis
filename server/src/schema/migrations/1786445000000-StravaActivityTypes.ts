import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity DROP CONSTRAINT activity_sport_check`.execute(db);
  await sql`
    ALTER TABLE activity ADD CONSTRAINT activity_sport_check CHECK (
      sport IN (
        'alpine_ski', 'backcountry_ski', 'badminton', 'basketball', 'canoeing', 'cricket',
        'cross_country_ski', 'crossfit', 'dance', 'e_bike_ride', 'elliptical', 'e_mountain_bike_ride',
        'golf', 'gravel_ride', 'handcycle', 'high_intensity_interval_training', 'hike', 'ice_skate',
        'inline_skate', 'kayaking', 'kitesurf', 'mountain_bike_ride', 'padel', 'physical_therapy',
        'pickleball', 'pilates', 'racquetball', 'ride', 'rock_climbing', 'roller_ski', 'rowing', 'run',
        'sail', 'skateboard', 'snowboard', 'snowshoe', 'soccer', 'squash', 'stair_stepper',
        'stand_up_paddling', 'surfing', 'swim', 'table_tennis', 'tennis', 'trail_run', 'velomobile',
        'virtual_ride', 'virtual_row', 'virtual_run', 'volleyball', 'walk', 'weight_training',
        'wheelchair', 'windsurf', 'workout', 'yoga', 'other'
      )
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE activity SET sport = 'other'
    WHERE sport NOT IN (
      'run', 'ride', 'trail_run', 'walk', 'hike', 'swim', 'alpine_ski', 'roller_ski',
      'cross_country_ski', 'ice_skate', 'other'
    )
  `.execute(db);
  await sql`ALTER TABLE activity DROP CONSTRAINT activity_sport_check`.execute(db);
  await sql`
    ALTER TABLE activity ADD CONSTRAINT activity_sport_check CHECK (
      sport IN (
        'run', 'ride', 'trail_run', 'walk', 'hike', 'swim', 'alpine_ski', 'roller_ski',
        'cross_country_ski', 'ice_skate', 'other'
      )
    )
  `.execute(db);
}
