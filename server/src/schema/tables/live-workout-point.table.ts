import { Column, Table, Timestamp } from 'src/schema/decorators';

@Table('live_workout_point')
export class LiveWorkoutPointTable {
  @Column({ type: 'text' })
  live_workout_id!: string;

  @Column({ type: 'integer' })
  sequence!: number;

  @Column({ type: 'timestamp' })
  recorded_at!: Timestamp;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'double precision', nullable: true })
  altitude!: number | null;

  @Column({ type: 'real' })
  accuracy_meters!: number;
}
