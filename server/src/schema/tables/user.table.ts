import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/schema/decorators';
@Table('user')
export class UserTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) email!: string;
  @Column({ type: 'text' }) first_name!: string;
  @Column({ type: 'text' }) last_name!: string;
  @Column({ type: 'text', nullable: true }) avatar_path!: string | null;
  @Column({ type: 'text', nullable: true }) avatar_mime_type!: string | null;
  @Column({ type: 'integer', nullable: true }) avatar_size!: number | null;
  @Column({ type: 'text' }) password_hash!: string;
  @Column({ type: 'text' }) role!: Generated<'admin' | 'user'>;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @UpdateDateColumn() updated_at!: Generated<Timestamp>;
}
