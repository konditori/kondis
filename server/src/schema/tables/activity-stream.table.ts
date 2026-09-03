import { Column, Table } from 'src/schema/decorators';
import type { StreamType } from 'src/types';

export interface ActivityStreamTable {
  activity_id: string;
  type: StreamType;
  data: number[];
}

@Table('activity_stream')
export class ActivityStreamTableEntity {
  @Column({ type: 'text' })
  activity_id!: string;

  @Column({ type: 'text' })
  type!: StreamType;

  @Column({ type: 'json' })
  data!: number[];
}
