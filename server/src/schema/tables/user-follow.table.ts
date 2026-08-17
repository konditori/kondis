import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('user_follow')
export class UserFollowTable {
  @Column({ type: 'text' }) follower_id!: string;
  @Column({ type: 'text' }) followee_id!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
