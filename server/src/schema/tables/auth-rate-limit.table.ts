import { Column, Table, Timestamp } from 'src/schema/decorators';

@Table('auth_rate_limit')
export class AuthRateLimitTable {
  @Column({ type: 'text' }) key!: string;
  @Column({ type: 'integer' }) attempts!: number;
  @Column({ type: 'timestamptz' }) window_started_at!: Timestamp;
}
