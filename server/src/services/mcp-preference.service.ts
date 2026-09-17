import { UnitSystem } from 'src/enum';
import { timezoneSchema } from 'src/mcp/context';
import type { McpPreferenceRepository } from 'src/repositories/mcp-preference.repository';
import { z } from 'zod';

export const McpPreferenceSchema = z.object({
  timezone: timezoneSchema,
  units: z.enum(UnitSystem),
});

export class McpPreferenceService {
  constructor(private readonly preferences: McpPreferenceRepository) {}

  async get(userId: string) {
    return (await this.preferences.findByUserId(userId)) ?? { timezone: 'UTC', units: UnitSystem.Metric };
  }

  async update(userId: string, input: z.infer<typeof McpPreferenceSchema>) {
    const value = McpPreferenceSchema.parse(input);
    await this.preferences.upsert(userId, value.timezone, value.units);
    return value;
  }
}
