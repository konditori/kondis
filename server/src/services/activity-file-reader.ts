import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { FileSizeLimitError } from 'src/contracts/storage.repository';
import type { BaseServiceDeps } from 'src/services/base.service';
import type { FitMessages, ParsedActivity } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

export type ActivityFileReaderDeps = Pick<
  BaseServiceDeps,
  'fitRepository' | 'gpxRepository' | 'tcxRepository' | 'storageRepository'
>;
const extname = (path: string): string => path.slice(path.lastIndexOf('.'));

// Format decoding and bounded reads shared by imports and metric recomputation.
export class ActivityFileReader {
  constructor(private readonly deps: ActivityFileReaderDeps) {}
  decode(path: string, contents: Buffer): FitMessages {
    const extension = extname(path).toLowerCase();
    let messages: FitMessages;

    switch (extension) {
      case '.fit': {
        messages = this.deps.fitRepository.decode(contents);
        break;
      }
      case '.gpx': {
        messages = this.deps.gpxRepository.decode(contents);
        break;
      }
      case '.tcx': {
        messages = this.deps.tcxRepository.decode(contents);
        break;
      }
      default: {
        throw new Error(`Unsupported activity format: ${extension || 'unknown extension'}`);
      }
    }

    this.assertActivityMessageLimits(messages);
    return messages;
  }

  async read(path: string): Promise<Buffer> {
    try {
      return await this.deps.storageRepository.readLimited(path, UPLOAD_LIMITS.activityFileBytes);
    } catch (error) {
      if (error instanceof FileSizeLimitError) {
        throw new Error(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`, { cause: error });
      }
      throw error;
    }
  }

  compute(path: string, contents: Buffer): ParsedActivity {
    return parseFitMessages(this.decode(path, contents));
  }

  private assertActivityMessageLimits(messages: FitMessages): void {
    const recordCount = messages.recordMesgs?.length ?? 0;
    if (recordCount > UPLOAD_LIMITS.activityRecords) {
      throw new Error(`Activity contains too many records (maximum ${UPLOAD_LIMITS.activityRecords})`);
    }

    const lapCount = messages.lapMesgs?.length ?? 0;
    if (lapCount > UPLOAD_LIMITS.activityLaps) {
      throw new Error(`Activity contains too many laps (maximum ${UPLOAD_LIMITS.activityLaps})`);
    }
  }
}
