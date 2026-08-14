import { Injectable } from '@nestjs/common';

export type ImportProgressStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ImportProgress = {
  importId: string;
  userId: string;
  status: ImportProgressStatus;
  total: number | null;
  processed: number;
  failed: number;
  duplicates: number;
  error: string | null;
};

@Injectable()
export class ImportProgressStore {
  private readonly imports = new Map<string, ImportProgress>();

  create(importId: string, userId: string): void {
    this.imports.set(importId, {
      importId,
      userId,
      status: 'queued',
      total: null,
      processed: 0,
      failed: 0,
      duplicates: 0,
      error: null,
    });
  }

  get(importId: string, userId: string): ImportProgress | undefined {
    const progress = this.imports.get(importId);
    return progress?.userId === userId ? progress : undefined;
  }

  setProcessing(importId: string, total: number): void {
    const progress = this.imports.get(importId);
    if (!progress) {
      return;
    }
    progress.total = total;
    progress.status = total === 0 ? 'completed' : 'processing';
  }

  increment(importId: string, failed = false, duplicate = false): void {
    const progress = this.imports.get(importId);
    if (!progress) {
      return;
    }
    progress.processed += 1;
    if (failed) {
      progress.failed += 1;
    }
    if (duplicate) {
      progress.duplicates += 1;
    }
    if (progress.status !== 'failed' && progress.total !== null && progress.processed >= progress.total) {
      progress.status = 'completed';
    }
  }

  fail(importId: string, error: string): void {
    const progress = this.imports.get(importId);
    if (!progress) {
      return;
    }
    progress.status = 'failed';
    progress.error = error;
  }
}
