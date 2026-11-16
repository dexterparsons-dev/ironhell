/**
 * Generate PWA icons (180x180, 192x192, 512x512) — same pixel-art skull as IH-14.
 * Pure Node.js, no external deps.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

// 16x16 pixel-art skull design (1 = rust/orange, 0 = black)
const skull = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0],
  [0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0],
  [0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0],
  [0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,0,1,1,0,1,1,0,0,0,0],
  [0,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
];

const BG = [0x0a, 0x0a, 0x0a];
const FG = [0xd4, 0x65, 0x2a];

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function generateIcon(size) {
  const pixel = size / 16;
  const raw = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    const gy = Math.floor(y / pixel);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / pixel);
      const on = skull[gy]?.[gx] === 1;
      const c = on ? FG : BG;
      raw[offset++] = c[0];
      raw[offset++] = c[1];
      raw[offset++] = c[2];
      raw[offset++] = 0xFF;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// For 180x180 we need a size divisible by 16 for clean pixels.
// 180/16 = 11.25 — not perfect, but close enough for pixel art.
// We'll use nearest-neighbor scaling from a 16x16 source.

const sizes = [
  { size: 180, name: 'apple-touch-icon-180x180.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
];

mkdirSync('pwa', { recursive: true });

for (const { size, name } of sizes) {
  const png = generateIcon(size);
  writeFileSync(`pwa/${name}`, png);
  console.log(`${name} (${png.length} bytes)`);
}
