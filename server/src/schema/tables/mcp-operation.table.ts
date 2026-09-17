import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_operation')
export class McpOperationTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'uuid', nullable: true }) credential_id!: string | null;
  @Column({ type: 'text' }) kind!: string;
  @Column({ type: 'text' }) idempotency_key!: string;
  @Column({ type: 'text' }) input_hash!: string;
  @Column({ type: 'jsonb' }) result!: unknown;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
