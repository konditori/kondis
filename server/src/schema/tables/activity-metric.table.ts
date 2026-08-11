import { Column, Table } from 'src/schema/decorators';

@Table('activity_metric')
export class ActivityMetricTable {
  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'integer' })
  elapsed_time!: number;

  @Column({ type: 'integer', nullable: true })
  moving_time!: number | null;

  @Column({ type: 'double precision', nullable: true })
  distance!: number | null;

  @Column({ type: 'double precision', nullable: true })
  elevation_gain!: number | null;

  @Column({ type: 'double precision', nullable: true })
  elevation_loss!: number | null;

  @Column({ type: 'double precision', nullable: true })
  avg_speed!: number | null;

  @Column({ type: 'double precision', nullable: true })
  max_speed!: number | null;

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
}
