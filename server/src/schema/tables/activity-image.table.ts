import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/schema/decorators';

export type ActivityImageStatus = 'pending' | 'ready' | 'failed';

@Table('activity_image')
export class ActivityImageTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @Column({ type: 'text' })
  upload_id!: string;

  @Column({ type: 'text' })
  checksum!: string;

  @Column({ type: 'text' })
  original_name!: string;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  @Column({ type: 'integer' })
  sort_order!: Generated<number>;

  @Column({ type: 'text', nullable: true })
  mime_type!: string | null;

  @Column({ type: 'integer', nullable: true })
  byte_size!: number | null;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'text' })
  status!: Generated<ActivityImageStatus>;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'integer' })
  processing_version!: Generated<number>;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;

  @UpdateDateColumn()
  updated_at!: Generated<Timestamp>;
}
