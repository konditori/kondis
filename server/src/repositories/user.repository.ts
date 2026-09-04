import type { NewUserInput } from 'src/dtos/user.dto';
import type { KondisDatabase } from 'src/types';

export class UserRepository {
  constructor(private readonly db: KondisDatabase) {}

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

  create(input: NewUserInput) {
    return this.db.insertInto('user').values(input).returningAll().executeTakeFirstOrThrow();
  }

  createInitialAdmin(input: NewUserInput) {
    return this.db
      .insertInto('user')
      .values(input)
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .executeTakeFirst();
  }
}
