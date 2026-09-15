import { deflateSync } from 'node:zlib';

// Tiny deterministic RGB PNGs generated from numbers, without binary fixtures or image dependencies.
export function png(seed: number): Buffer {
  const chunk = (name: string, data: Buffer) => {
    const payload = Buffer.concat([Buffer.from(name), data]);
    let crc = 0xff_ff_ff_ff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xed_b8_83_20 : 0);
      }
    }
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xff_ff_ff_ff) >>> 0);
    return Buffer.concat([size, payload, checksum]);
  };
  const width = 32;
  const height = 24;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width * 3; x++) {
      pixels[y * (1 + width * 3) + 1 + x] = (x * 31 + y * 17 + seed * 41) % 256;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
