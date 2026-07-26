/**
 * The acyclic seam.
 *
 * This module contains types only: no logic, no imports from any other layer. Producers
 * (services) and consumers (handlers) both depend on it, and neither depends on the other.
 * That is what lets an upload trigger parsing without the uploader importing the parser.
 *
 * Payloads carry identifiers, never entities. Handlers re-read current state, so a retried
 * or delayed job can never operate on a stale snapshot, and payloads stay small.
 */

export enum JobName {
  PARSE_ACTIVITY_FILE = 'parse-activity-file',
}

export type JobItem = {
  name: JobName.PARSE_ACTIVITY_FILE;
  data: { uploadId: string };
};

/** Payload type for a specific job name. */
export type JobDataOf<TName extends JobName> = Extract<JobItem, { name: TName }>['data'];

/**
 * Mapped over every member of `JobName`, so adding a job without registering a handler is a
 * compile error rather than a silent no-op at runtime.
 */
export type JobHandlers = {
  [TName in JobName]: (data: JobDataOf<TName>) => Promise<void>;
};
