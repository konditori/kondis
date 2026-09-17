import { Column, Table, Timestamp } from 'src/schema/decorators';

@Table('mcp_upload')
export class McpUploadTable {
  @Column({ type: 'uuid' }) id!: string;
  @Column({ type: 'uuid' }) user_id!: string;
  @Column({ type: 'text' }) checksum!: string;
  @Column({ type: 'text' }) original_name!: string;
  @Column({ type: 'text' }) storage_path!: string;
  @Column({ type: 'integer' }) byte_size!: number;
  @Column({ type: 'timestamptz' }) expires_at!: Timestamp;
  @Column({ type: 'timestamptz', nullable: true }) consumed_at!: Timestamp | null;
}
