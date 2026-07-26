import { Decoder, Stream } from '@garmin/fitsdk';

import { FitMessages } from 'src/domain/fit/fit-messages';

/**
 * The only module in the codebase that touches the Garmin SDK.
 *
 * Everything downstream consumes the `FitMessages` structural type, so if the SDK's API or
 * field naming differs from what is assumed here, this file is the single place to correct
 * it and `parse-fit.ts` stays untouched.
 */

export class FitDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FitDecodeError';
  }
}

export const decodeFit = (contents: Buffer): FitMessages => {
  let stream: Stream;
  try {
    stream = Stream.fromBuffer(contents);
  } catch (error) {
    throw new FitDecodeError('Could not read the uploaded file as a FIT stream', { cause: error });
  }

  if (!Decoder.isFIT(stream)) {
    throw new FitDecodeError('File is not a valid FIT file');
  }

  let result: { messages: unknown; errors: Error[] };
  try {
    result = new Decoder(stream).read();
  } catch (error) {
    throw new FitDecodeError('FIT decoding failed', { cause: error });
  }

  if (!result.messages || typeof result.messages !== 'object') {
    throw new FitDecodeError('FIT decoding produced no messages', { cause: result.errors });
  }

  // Partial decode errors are tolerated on purpose: a truncated ride recorded when a device
  // battery died still contains usable data, and discarding it would be worse than keeping it.
  return result.messages as FitMessages;
};
