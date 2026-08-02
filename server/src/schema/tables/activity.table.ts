import type { ColumnType, RawBuilder } from 'kysely';

import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp, UpdateDateColumn } from 'src/schema/decorators';

type Defaulted<T> = ColumnType<T, T | undefined, T>;
type DefaultedTimestamp = ColumnType<Timestamp, Timestamp | undefined, Timestamp>;
type GeographyWrite = RawBuilder<unknown> | null | undefined;
type Geography = ColumnType<string | null, GeographyWrite, GeographyWrite>;


@Table('activity')
export class ActivityTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  upload_id!: string;

  @Column({ type: 'text' })
  sport!: string;

  @Column({ type: 'text', nullable: true })
  sub_sport!: string | null;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'timestamp' })
  started_at!: Timestamp;

  @Column({ type: 'integer', nullable: true })
  timezone_offset_minutes!: number | null;

  @Column({ type: 'integer' })
  elapsed_time_s!: number;

  @Column({ type: 'integer', nullable: true })
  moving_time_s!: number | null;

  @Column({ type: 'double precision', nullable: true })
  distance_m!: number | null;

  @Column({ type: 'double precision', nullable: true })
  elevation_gain_m!: number | null;

  @Column({ type: 'double precision', nullable: true })
  elevation_loss_m!: number | null;

  @Column({ type: 'double precision', nullable: true })
  avg_speed_mps!: number | null;

  @Column({ type: 'double precision', nullable: true })
  max_speed_mps!: number | null;

  @Column({ type: 'integer', nullable: true })
  avg_hr!: number | null;

  @Column({ type: 'integer', nullable: true })
  max_hr!: number | null;

  @Column({ type: 'integer', nullable: true })
  avg_cadence!: number | null;

  @Column({ type: 'integer', nullable: true })
  max_cadence!: number | null;

  @Column({ type: 'integer', nullable: true })
  avg_power!: number | null;

  @Column({ type: 'integer', nullable: true })
  max_power!: number | null;

  @Column({ type: 'integer', nullable: true })
  normalized_power!: number | null;

  @Column({ type: 'integer', nullable: true })
  calories!: number | null;

  @Column({ type: 'geography', nullable: true })
  track!: Geography;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
