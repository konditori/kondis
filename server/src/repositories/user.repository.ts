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
  getAvatar(id: string) {
    return this.db
      .selectFrom('user')
      .select(['id', 'avatar_path', 'avatar_mime_type', 'avatar_size'])
      .where('id', '=', id)
      .executeTakeFirst();
  }
  setAvatar(id: string, avatarPath: string, mimeType: string, size: number) {
    return this.db
      .updateTable('user')
      .set({ avatar_path: avatarPath, avatar_mime_type: mimeType, avatar_size: size })
      .where('id', '=', id)
      .returning(['avatar_path', 'avatar_mime_type', 'avatar_size'])
      .executeTakeFirstOrThrow();
  }
  setNameParts(id: string, first_name: string, last_name: string) {
    return this.db.updateTable('user').set({ first_name, last_name }).where('id', '=', id).executeTakeFirst();
  }
  clearAvatar(id: string) {
    return this.db
      .updateTable('user')
      .set({ avatar_path: null, avatar_mime_type: null, avatar_size: null })
      .where('id', '=', id)
      .returning(['avatar_path', 'avatar_mime_type', 'avatar_size'])
      .executeTakeFirstOrThrow();
  }
  create(input: {
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string;
    role: 'admin' | 'user';
  }) {
    return this.db.insertInto('user').values(input).returningAll().executeTakeFirstOrThrow();
  }
  async adoptOrphanedData(userId: string) {
    await this.db.updateTable('upload').set({ user_id: userId }).where('user_id', 'is', null).execute();
    await this.db.updateTable('activity').set({ user_id: userId }).where('user_id', 'is', null).execute();
  }
}
