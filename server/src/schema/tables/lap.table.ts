import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('lap')
export class LapTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'integer' })
  lap_index!: number;

  @Column({ type: 'timestamp', nullable: true })
  started_at!: Timestamp | null;

  @Column({ type: 'integer', nullable: true })
  elapsed_time!: number | null;

  @Column({ type: 'integer', nullable: true })
  moving_time!: number | null;

  @Column({ type: 'double precision', nullable: true })
  distance!: number | null;

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
