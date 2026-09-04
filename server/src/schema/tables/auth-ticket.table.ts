import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

export type AuthTicketScope = 'activity-events' | 'initial-setup' | 'job-events';

@Table('auth_ticket')
export class AuthTicketTable {
  @Column({ type: 'text' }) token_hash!: string;
  @Column({ type: 'uuid', nullable: true }) user_id!: string | null;
  @Column({ type: 'uuid', nullable: true }) session_id!: string | null;
  @Column({ type: 'text' }) scope!: AuthTicketScope;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @Column({ type: 'timestamptz' }) expires_at!: Timestamp;
}
