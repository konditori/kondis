import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_oauth_client')
export class McpOAuthClientTable {
  @Column({ type: 'text' }) id!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text[]' }) redirect_uris!: string[];
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
