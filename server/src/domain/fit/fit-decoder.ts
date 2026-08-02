import FitParser from 'fit-file-parser';

import { FitMessages } from 'src/domain/fit/fit-messages';

export class FitDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FitDecodeError';
  }
}

/**
 * These all match the FIT defaults, but they are stated explicitly because the rest of the
 * codebase assumes SI units throughout. A change of default upstream would otherwise silently
 * rescale every stored activity.
 *
 * `force` keeps partially corrupt files: a truncated ride recorded when a device battery died
 * still contains usable data, and discarding it would be worse than keeping it.
 */
const parser = new FitParser({
  force: true,
  speedUnit: 'm/s',
  lengthUnit: 'm',
  temperatureUnit: 'celsius',
  mode: 'list',
});

type ParsedFit = Awaited<ReturnType<FitParser['parseAsync']>>;

/**
 * Failures the parser raises before it has read a single message, i.e. the file was never a FIT
 * file to begin with. Anything else means the header was fine but the body could not be read.
 */
const NOT_A_FIT_FILE = new Set(['File to small to be a FIT file', 'Incorrect header size', "Missing '.FIT' in header"]);

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

/**
 * fit-file-parser names fields as the FIT profile does, in snake_case. `FitMessages` uses the
 * camelCase spelling, so the two differ by nothing but this mechanical rename.
 */
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
    // The parser rejects `Buffer<ArrayBufferLike>` because a SharedArrayBuffer-backed buffer
    // would satisfy it, which Node never produces. It reads the buffer through its byteOffset
    // and byteLength, so pooled buffers are sliced correctly and nothing is copied.
    //
    // The callback runs synchronously: parsing is pure computation over the buffer.
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
