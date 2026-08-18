import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('notification')
export class NotificationTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) user_id!: string;
  @Column({ type: 'text' }) actor_id!: string;
  @Column({ type: 'text' }) type!: 'activity_like' | 'activity_comment' | 'follow_request';
  @Column({ type: 'text', nullable: true }) activity_id!: string | null;
  @Column({ type: 'timestamp', nullable: true }) read_at!: Timestamp | null;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
