import { Injectable } from '@nestjs/common';

import { JobDataOf, JobName } from 'src/jobs/job.types';
import { ActivityService } from 'src/services/activity.service';

/**
 * Handlers sit above services and may import them freely. Services may not import handlers,
 * which is what keeps the graph acyclic. The lint rules in `eslint.config.mjs` enforce it.
 *
 * Kept as a thin adapter so the work itself stays in a service that can be called and tested
 * without any queue involved.
 */
@Injectable()
export class ParseActivityFileHandler {
  constructor(private readonly activities: ActivityService) {}

  async handle({ uploadId }: JobDataOf<JobName.PARSE_ACTIVITY_FILE>): Promise<void> {
    await this.activities.createFromUpload(uploadId);
  }
}
