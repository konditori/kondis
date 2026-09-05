import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('auth_session')
export class AuthSessionTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'text', unique: true }) token_hash!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @Column({ type: 'timestamptz' }) last_seen_at!: Generated<Timestamp>;
  @Column({ type: 'timestamptz' }) expires_at!: Timestamp;
}
