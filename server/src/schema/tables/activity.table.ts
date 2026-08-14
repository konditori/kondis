import type { ColumnType, RawBuilder } from 'kysely';

import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/schema/decorators';
import { ActivityType } from 'src/types';

type GeographyWrite = RawBuilder<unknown> | null | undefined;
type Geography = ColumnType<string | null, GeographyWrite, GeographyWrite>;

@Table('activity')
export class ActivityTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  upload_id!: string;

  @Column({ type: 'text', nullable: true })
  user_id!: string | null;

  @Column({ type: 'text' })
  sport!: ActivityType;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: Generated<string | null>;

  @Column({ type: 'boolean' })
  exclude_from_rankings!: Generated<boolean>;

  @Column({ type: 'timestamp' })
  started_at!: Timestamp;

  @Column({ type: 'integer', nullable: true })
  timezone_offset_minutes!: number | null;

  @Column({ type: 'geography', nullable: true })
  track!: Geography;

  @Column({ type: 'geography', nullable: true })
  detail_track!: Geography;

  @Column({ type: 'vector', nullable: true })
  route_embedding!: Generated<string | null>;

  @Column({ type: 'timestamp', nullable: true })
  metrics_computed_at!: Generated<Timestamp | null>;

  @Column({ type: 'timestamp', nullable: true })
  best_efforts_computed_at!: Generated<Timestamp | null>;

  @Column({ type: 'timestamp', nullable: true })
  route_matches_computed_at!: Generated<Timestamp | null>;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
