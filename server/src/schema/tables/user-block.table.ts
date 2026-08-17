import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('user_block')
export class UserBlockTable {
  @Column({ type: 'text' }) blocker_id!: string;
  @Column({ type: 'text' }) blocked_id!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
