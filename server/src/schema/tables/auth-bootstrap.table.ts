import { Column, CreateDateColumn, Generated, Table, Timestamp } from 'src/schema/decorators';

@Table('auth_bootstrap')
export class AuthBootstrapTable {
  @Column({ type: 'boolean' }) id!: Generated<boolean>;
  @Column({ type: 'text' }) token_hash!: string;
  @CreateDateColumn() created_at!: Generated<Timestamp>;
}
