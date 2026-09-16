export abstract class CryptoRepository {
  abstract comparePassword(password: string, hash: string): Promise<boolean>;
  abstract hashPassword(password: string, workFactor: number): Promise<string>;
  abstract randomToken(byteLength: number): string;
  abstract safeEqual(left: string, right: string): boolean;
  abstract sha256(value: string | Uint8Array): Promise<string>;
  abstract uuid(): string;
}
