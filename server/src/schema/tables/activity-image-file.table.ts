import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('activity_image_file')
export class ActivityImageFileTable {
  @Column({ type: 'text' })
  image_id!: string;

  @Column({ type: 'text' })
  variant!: 'original' | 'thumbnail' | 'preview';

  @Column({ type: 'text' })
  storage_path!: string;

  @Column({ type: 'text' })
  mime_type!: string;

  @Column({ type: 'integer' })
  byte_size!: number;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @CreateDateColumn()
  created_at!: Generated<Timestamp>;
}
