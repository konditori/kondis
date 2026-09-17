import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_audit')
export class McpAuditTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'uuid', nullable: true }) credential_id!: string | null;
  @Column({ type: 'text' }) action!: string;
  @Column({ type: 'text', nullable: true }) target_id!: string | null;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
