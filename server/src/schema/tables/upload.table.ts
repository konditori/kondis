import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/schema/decorators';
import { UploadStatus } from 'src/types';

@Table('upload')
export class UploadTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  checksum!: string;

  @Column({ type: 'text' })
  original_name!: string;

  @Column({ type: 'integer' })
  byte_size!: number;

  @Column({ type: 'text' })
  storage_path!: string;

  @Column({ type: 'text', nullable: true })
  user_id!: string | null;

  @Column({ type: 'text' })
  status!: Generated<UploadStatus>;

  @Column({ type: 'text', default: null, nullable: true })
  error!: string | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
