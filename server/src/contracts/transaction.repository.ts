import type { KondisTransaction } from 'src/types';

export abstract class TransactionRepository {
  abstract withTransaction<T>(fn: (transaction: KondisTransaction) => Promise<T>): Promise<T>;
}
