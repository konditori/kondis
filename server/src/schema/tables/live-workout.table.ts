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

export type LiveWorkoutStatus = 'recording' | 'paused' | 'ended' | 'discarded';

@Table('live_workout')
export class LiveWorkoutTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  user_id!: string;

  @Column({ type: 'text' })
  client_session_id!: string;

  @Column({ type: 'text' })
  sport!: ActivityType;

  @Column({ type: 'timestamp' })
  started_at!: Timestamp;

  @Column({ type: 'text' })
  status!: LiveWorkoutStatus;

  @Column({ type: 'integer' })
  elapsed_seconds!: number;

  @Column({ type: 'double precision' })
  distance_meters!: number;

  @Column({ type: 'integer' })
  last_sequence!: number;

  @Column({ type: 'timestamp', nullable: true })
  last_point_at!: Timestamp | null;

  @Column({ type: 'timestamp', nullable: true })
  last_received_at!: Timestamp | null;

  @Column({ type: 'text', nullable: true })
  share_token_hash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  share_expires_at!: Timestamp | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
