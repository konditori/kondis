import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TABLE follow_request (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT follow_request_no_self CHECK (requester_id <> target_id),
    UNIQUE (requester_id, target_id)
  )`.execute(db);
  await sql`CREATE INDEX follow_request_target_idx ON follow_request (target_id, created_at DESC)`.execute(db);

  await sql`CREATE TABLE user_follow (
    follower_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    followee_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT user_follow_no_self CHECK (follower_id <> followee_id)
  )`.execute(db);
  await sql`CREATE INDEX user_follow_followee_idx ON user_follow (followee_id, created_at DESC)`.execute(db);

  await sql`CREATE TABLE user_block (
    blocker_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_block_no_self CHECK (blocker_id <> blocked_id)
  )`.execute(db);

  await sql`CREATE TABLE activity_like (
    activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, user_id)
  )`.execute(db);
  await sql`CREATE INDEX activity_like_activity_idx ON activity_like (activity_id, created_at DESC)`.execute(db);

  await sql`CREATE TABLE activity_comment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`.execute(db);
  await sql`CREATE INDEX activity_comment_activity_idx ON activity_comment (activity_id, created_at DESC, id DESC)`.execute(
    db,
  );
  await sql`CREATE TRIGGER activity_comment_set_updated_at BEFORE UPDATE ON activity_comment FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE activity_comment`.execute(db);
  await sql`DROP TABLE activity_like`.execute(db);
  await sql`DROP TABLE user_block`.execute(db);
  await sql`DROP TABLE user_follow`.execute(db);
  await sql`DROP TABLE follow_request`.execute(db);
}
