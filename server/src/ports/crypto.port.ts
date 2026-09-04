export type CryptoPort = {
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  hashPassword: (password: string, workFactor: number) => Promise<string>;
  randomToken: (byteLength: number) => string;
  safeEqual: (left: string, right: string) => boolean;
  sha256: (value: string) => string;
  uuid: () => string;
  xxHash: (contents: Uint8Array) => string;
};
