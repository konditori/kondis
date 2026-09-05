import type { KondisTransaction } from 'src/types';

export interface TransactionPort {
  withTransaction<T>(fn: (transaction: KondisTransaction) => Promise<T>): Promise<T>;
}
