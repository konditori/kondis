import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('activity_like')
export class ActivityLikeTable {
  @Column({ type: 'text' }) activity_id!: string;
  @Column({ type: 'text' }) user_id!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
