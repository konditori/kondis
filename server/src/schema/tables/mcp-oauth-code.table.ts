import { Column, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_oauth_code')
export class McpOAuthCodeTable {
  @Column({ type: 'text' }) hash!: string;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'text' }) client_id!: string;
  @Column({ type: 'text' }) redirect_uri!: string;
  @Column({ type: 'text' }) challenge!: string;
  @Column({ type: 'text' }) audience!: string;
  @Column({ type: 'text[]' }) scopes!: string[];
  @Column({ type: 'timestamptz' }) expires_at!: Timestamp;
}
