import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, Timestamp } from 'src/schema/decorators';

@Table('follow_request')
export class FollowRequestTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) requester_id!: string;
  @Column({ type: 'text' }) target_id!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
