import type { KondisDatabase } from 'src/types';

export class McpPreferenceRepository {
  constructor(private readonly db: KondisDatabase) {}

  findByUserId(userId: string) {
    return this.db
      .selectFrom('mcp_preference')
      .select(['timezone', 'units'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }
}
