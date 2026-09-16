import { TransactionRepository } from 'src/contracts/transaction.repository';
import type { KondisDatabase, KondisTransaction } from 'src/types';

export class PostgresTransactionRepository extends TransactionRepository {
  constructor(private readonly db: KondisDatabase) {
    super();
  }

  withTransaction<T>(fn: (transaction: KondisTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(fn);
  }
}
