import { Column, CreateDateColumn, Generated, Table, Timestamp, UpdateDateColumn } from 'src/schema/decorators';
import type { IActivityImageStage } from 'src/types/jobs';

@Table('takeout_import_item')
export class TakeoutImportItemTable {
  @Column({ type: 'uuid' })
  import_id!: string;

  // A stable client-derived identity: either the validated archive entry path
  // or the activities.csv row identity for manual activities.
  @Column({ type: 'text' })
  item_key!: string;

  @Column({ type: 'text' })
  kind!: 'activity' | 'manual';

  @Column({ type: 'text' })
  status!: Generated<'pending' | 'uploading' | 'queued' | 'completed' | 'failed' | 'duplicate'>;

  @Column({ type: 'jsonb' })
  metadata!: unknown;

  @Column({ type: 'jsonb', default: "'[]'::jsonb" })
  staged_images!: Generated<Array<IActivityImageStage & { photoKey: string }>>;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
