import { ConsoleLogger, Injectable } from '@nestjs/common';
import FitParser from 'fit-file-parser';
import type { FitMessages } from 'src/types';

export class FitDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FitDecodeError';
  }
}

const NOT_A_FIT_FILE = [
  'File too small to be a FIT file',
  'File to small to be a FIT file',
  'Incorrect header size',
  "Missing '.FIT' in header",
];

type ParsedFit = Awaited<ReturnType<FitParser['parseAsync']>>;

@Injectable()
export class FitRepository {
  private readonly fitParser = new FitParser({
    force: true, // Keep partially corrupt files, for example when a device battery dies while recording
    speedUnit: 'm/s',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    mode: 'list',
  });

  private readonly camelCaseKeys = new Map<string, string>();

  constructor(private readonly logger: ConsoleLogger) {
    this.logger.setContext(FitRepository.name);
  }

  decode(contents: Buffer): FitMessages {
    let decoded: ParsedFit | undefined;
    let failure: string | undefined;

    try {
      this.fitParser.parse(contents as Buffer<ArrayBuffer>, (error, data) => {
        failure = error;
        decoded = data;
      });
    } catch (error) {
      throw new FitDecodeError('FIT decoding failed', { cause: error });
    }

    if (failure !== undefined) {
      const message = failure ?? 'unknown FIT parser error';
      const isNotAFitFile = NOT_A_FIT_FILE.some((candidate) => message.includes(candidate));
      throw new FitDecodeError(
        isNotAFitFile ? `File is not a valid FIT file: ${message}` : `FIT decoding failed: ${message}`,
      );
    }

    if (decoded === undefined) {
      throw new FitDecodeError('FIT decoding produced no messages');
    }

    return {
      sessionMesgs: this.camelCaseMessages(decoded.sessions),
      recordMesgs: this.camelCaseMessages(decoded.records),
      lapMesgs: this.camelCaseMessages(decoded.laps),
    };
  }

  private camelCaseKey(key: string): string {
    return key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
  }

  private toCamelCase(key: string): string {
    let cached = this.camelCaseKeys.get(key);
    if (cached === undefined) {
      cached = this.camelCaseKey(key);
      this.camelCaseKeys.set(key, cached);
    }
    return cached;
  }

  private camelCaseMessages<T>(messages: object[] | undefined): T[] {
    return (messages ?? []).map((message) => {
      const renamed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(message)) {
        renamed[this.toCamelCase(key)] = value;
      }
      return renamed as T;
    });
  }
}
