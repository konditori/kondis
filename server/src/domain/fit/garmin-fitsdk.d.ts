/**
 * Ambient declaration for `@garmin/fitsdk`, which ships as JavaScript.
 *
 * If a future version bundles its own `.d.ts`, delete this file rather than leaving both in
 * place: an ambient `declare module` takes precedence and would shadow the real types.
 */
declare module '@garmin/fitsdk' {
  export class Stream {
    static fromBuffer(buffer: Uint8Array): Stream;
    static fromByteArray(bytes: number[]): Stream;
  }

  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    checkIntegrity(): boolean;
    read(options?: Record<string, unknown>): { messages: unknown; errors: Error[] };
  }
}
