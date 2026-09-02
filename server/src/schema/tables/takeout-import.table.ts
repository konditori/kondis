import { Column, CreateDateColumn, Generated, Table, Timestamp, UpdateDateColumn } from 'src/schema/decorators';
import type { ImportProgressStatus } from 'src/state/import-progress.store';

@Table('takeout_import')
export class TakeoutImportTable {
  @Column({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'text' })
  status!: Generated<ImportProgressStatus>;

  @Column({ type: 'integer', nullable: true })
  total!: number | null;

  @Column({ type: 'integer' })
  processed!: Generated<number>;

  @Column({ type: 'integer' })
  failed!: Generated<number>;

  @Column({ type: 'integer' })
  duplicates!: Generated<number>;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
