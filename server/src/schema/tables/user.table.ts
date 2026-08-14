import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, Table, UpdateDateColumn } from 'src/schema/decorators';
import { Timestamp } from 'src/schema/decorators';
@Table('user')
export class UserTable {
  @PrimaryGeneratedColumn() id!: Generated<string>;
  @Column({ type: 'text' }) email!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text' }) password_hash!: string;
  @Column({ type: 'text' }) role!: Generated<'admin' | 'user'>;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
  @UpdateDateColumn() updated_at!: Generated<Timestamp>;
}
