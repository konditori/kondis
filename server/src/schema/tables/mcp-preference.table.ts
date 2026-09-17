import { UnitSystem } from 'src/enum';
import { Column, Generated, Table } from 'src/schema/decorators';

@Table('mcp_preference')
export class McpPreferenceTable {
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'text', default: 'UTC' })
  timezone!: Generated<string>;

  @Column({ type: 'text', default: UnitSystem.Metric })
  units!: Generated<UnitSystem>;
}
