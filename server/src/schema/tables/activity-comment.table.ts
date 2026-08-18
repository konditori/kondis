import {
  Column,
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/schema/decorators';

@Table('activity_comment')
export class ActivityCommentTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) activity_id!: string;
  @Column({ type: 'text' }) user_id!: string;
  @Column({ type: 'text' }) body!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @UpdateDateColumn() updated_at!: Generated<Timestamp>;
}
