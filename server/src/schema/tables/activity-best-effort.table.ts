import { BestEffortType, BestEffortValueKind } from 'src/domain/running-best-effort';
import { Column, Generated, Table } from 'src/schema/decorators';

@Table('activity_best_effort')
export class ActivityBestEffortTable {
  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'text' })
  type!: BestEffortType;

  @Column({ type: 'double precision' })
  distance!: number;

  @Column({ type: 'double precision' })
  elapsed_time!: number;

  @Column({ type: 'double precision' })
  start_time!: number;

  @Column({ type: 'double precision' })
  end_time!: number;

  @Column({ type: 'double precision' })
  value!: number;

  @Column({ type: 'text' })
  value_kind!: BestEffortValueKind;

  @Column({ type: 'integer', default: 1 })
  year!: Generated<number>;

  @Column({ type: 'integer', default: 1 })
  overall_rank!: Generated<number>;

  @Column({ type: 'integer', default: 1 })
  year_rank!: Generated<number>;
}
