import type { UnitSystem } from 'src/enum';
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

  async upsert(userId: string, timezone: string, units: UnitSystem): Promise<void> {
    await this.db
      .insertInto('mcp_preference')
      .values({ user_id: userId, timezone, units })
      .onConflict((conflict) => conflict.column('user_id').doUpdateSet({ timezone, units }))
      .execute();
  }
}
