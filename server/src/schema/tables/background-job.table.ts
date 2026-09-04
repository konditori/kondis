import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

export type BackgroundJobState = 'created' | 'active' | 'retry' | 'completed' | 'failed' | 'dead';

@Table('background_job')
export class BackgroundJobTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) queue!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'jsonb' }) payload!: unknown;
  @Column({ type: 'text' }) state!: Generated<BackgroundJobState>;
  @Column({ type: 'integer' }) priority!: Generated<number>;
  @Column({ type: 'text', nullable: true }) singleton_key!: string | null;
  @Column({ type: 'integer' }) retry_count!: Generated<number>;
  @Column({ type: 'integer' }) retry_limit!: Generated<number>;
  @Column({ type: 'timestamptz' }) start_after!: Generated<Timestamp>;
  @CreateDateColumn() created_on!: Generated<Timestamp>;
  @Column({ type: 'timestamptz', nullable: true }) started_on!: Timestamp | null;
  @Column({ type: 'timestamptz', nullable: true }) completed_on!: Timestamp | null;
  @Column({ type: 'jsonb', nullable: true }) output!: unknown;
  @Column({ type: 'timestamptz', nullable: true }) published_on!: Timestamp | null;
  @Column({ type: 'timestamptz', nullable: true }) delete_after!: Timestamp | null;
}
