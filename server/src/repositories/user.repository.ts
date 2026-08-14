import { Inject, Injectable } from '@nestjs/common';
import { KYSELY, KondisDatabase } from 'src/db/database';
@Injectable()
export class UserRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}
  count() {
    return this.db
      .selectFrom('user')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
  }
  findByEmail(email: string) {
    return this.db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
  }
  findById(id: string) {
    return this.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirst();
  }
  all() {
    return this.db.selectFrom('user').selectAll().orderBy('created_at', 'asc').execute();
  }
  create(input: { email: string; name: string; password_hash: string; role: 'admin' | 'user' }) {
    return this.db.insertInto('user').values(input).returningAll().executeTakeFirstOrThrow();
  }
  async adoptOrphanedData(userId: string) {
    await this.db.updateTable('upload').set({ user_id: userId }).where('user_id', 'is', null).execute();
    await this.db.updateTable('activity').set({ user_id: userId }).where('user_id', 'is', null).execute();
  }
}
