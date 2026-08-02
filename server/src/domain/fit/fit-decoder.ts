import FitParser from 'fit-file-parser';

import { FitMessages } from 'src/types';

export class FitDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FitDecodeError';
  }
}

const parser = new FitParser({
  force: true, // Keep partially corrupt files, for example when a device battery dies while recording
  speedUnit: 'm/s',
  lengthUnit: 'm',
  temperatureUnit: 'celsius',
  mode: 'list',
});

type ParsedFit = Awaited<ReturnType<FitParser['parseAsync']>>;

const NOT_A_FIT_FILE = new Set(['File too small to be a FIT file', 'Incorrect header size', "Missing '.FIT' in header"]);

const camelCaseKey = (key: string): string =>
  key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());

// Every message is rebuilt, so the regex above would otherwise run once per field per record.
const camelCaseKeys = new Map<string, string>();

const toCamelCase = (key: string): string => {
  let cached = camelCaseKeys.get(key);
  if (cached === undefined) {
    cached = camelCaseKey(key);
    camelCaseKeys.set(key, cached);
  }
  return cached;
};

const camelCaseMessages = <T>(messages: object[] | undefined): T[] =>
  (messages ?? []).map((message) => {
    const renamed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(message)) {
      renamed[toCamelCase(key)] = value;
    }
    return renamed as T;
  });

export const decodeFit = (contents: Buffer): FitMessages => {
  let decoded: ParsedFit | undefined;
  let failure: string | undefined;

  try {
    parser.parse(contents as Buffer<ArrayBuffer>, (error, data) => {
      failure = error;
      decoded = data;
    });
  } catch (error) {
    throw new FitDecodeError('FIT decoding failed', { cause: error });
  }

  if (failure !== undefined) {
    throw new FitDecodeError(
      NOT_A_FIT_FILE.has(failure) ? `File is not a valid FIT file: ${failure}` : `FIT decoding failed: ${failure}`,
    );
  }

  if (decoded === undefined) {
    throw new FitDecodeError('FIT decoding produced no messages');
  }

  return {
    sessionMesgs: camelCaseMessages(decoded.sessions),
    recordMesgs: camelCaseMessages(decoded.records),
    lapMesgs: camelCaseMessages(decoded.laps),
  };
};
