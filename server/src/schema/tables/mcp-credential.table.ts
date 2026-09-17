import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_credential')
export class McpCredentialTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text' }) kind!: 'key' | 'oauth';
  @Column({ type: 'text' }) token_hash!: string;
  @Column({ type: 'text', nullable: true }) refresh_hash!: string | null;
  @Column({ type: 'text', nullable: true }) client_id!: string | null;
  @Column({ type: 'text', nullable: true }) audience!: string | null;
  @Column({ type: 'text[]' }) scopes!: string[];
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @Column({ type: 'timestamptz', nullable: true }) last_used_at!: Timestamp | null;
  @Column({ type: 'timestamptz' }) expires_at!: Timestamp;
  @Column({ type: 'timestamptz', nullable: true }) refresh_expires_at!: Timestamp | null;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at!: Timestamp | null;
}
