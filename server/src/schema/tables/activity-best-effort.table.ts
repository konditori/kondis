import { RunningBestEffortType } from 'src/domain/running-best-effort';
import { Column, Table } from 'src/schema/decorators';

@Table('activity_best_effort')
export class ActivityBestEffortTable {
  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'text' })
  type!: RunningBestEffortType;

  @Column({ type: 'double precision' })
  distance!: number;

  @Column({ type: 'double precision' })
  elapsed_time!: number;

  @Column({ type: 'double precision' })
  start_time!: number;

  @Column({ type: 'double precision' })
  end_time!: number;
}
