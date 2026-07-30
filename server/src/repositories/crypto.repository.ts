import { Injectable } from '@nestjs/common';
import { xxh3 } from '@node-rs/xxhash';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CryptoRepository {
  xxHash(contents: Uint8Array): string {
    return xxh3.Xxh3.withSeed().update(contents).digest().toString(16).padStart(16, '0');
  }

  uuid(): string {
    return randomUUID();
  }
}
