import type { ColumnType } from 'kysely';

import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp, UpdateDateColumn } from 'src/schema/decorators';
import { UploadStatus } from 'src/types';

type Defaulted<T> = ColumnType<T, T | undefined, T>;
type DefaultedTimestamp = ColumnType<Timestamp, Timestamp | undefined, Timestamp>;

export interface UploadTable {
  id: Defaulted<string>;
  /** Lowercase hex xxhash128 of the file bytes */
  checksum: string;
  original_name: string;
  byte_size: number;
  storage_path: string;
  status: Defaulted<UploadStatus>;
  error: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

@Table('upload')
export class UploadTableEntity {
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

  @Column({ type: 'text' })
  status!: Generated<UploadStatus>;

  @Column({ type: 'text', default: null, nullable: true })
  error!: string | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
