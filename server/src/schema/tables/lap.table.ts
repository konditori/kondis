import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

export interface LapTable {
  id: string;
  activity_id: string;
  lap_index: number;
  started_at: Timestamp | null;
  elapsed_time_s: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  avg_speed_mps: number | null;
}

@Table('lap')
export class LapTableEntity {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'integer' })
  lap_index!: number;

  @Column({ type: 'timestamp', nullable: true })
  started_at!: Timestamp | null;

  @Column({ type: 'integer', nullable: true })
  elapsed_time_s!: number | null;

  @Column({ type: 'integer', nullable: true })
  moving_time_s!: number | null;

  @Column({ type: 'double precision', nullable: true })
  distance_m!: number | null;

  @Column({ type: 'integer', nullable: true })
  avg_hr!: number | null;

  @Column({ type: 'integer', nullable: true })
  max_hr!: number | null;

  @Column({ type: 'integer', nullable: true })
  avg_power!: number | null;

  @Column({ type: 'double precision', nullable: true })
  avg_speed_mps!: number | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;
}
