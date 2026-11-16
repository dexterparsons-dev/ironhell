/**
 * Generate a 1024x1024 pixel-art skull icon (rust/orange on black) as PNG.
 * Uses raw PNG encoding without external dependencies.
 */
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

const SIZE = 1024;
const PIXEL = 64; // each "pixel art" cell is 64x64 real pixels → 16x16 grid

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

// Colors
const BG = [0x0a, 0x0a, 0x0a]; // near-black
const FG = [0xd4, 0x65, 0x2a]; // rust/orange

// Build raw RGBA image data
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4)); // filter byte per row
let offset = 0;
for (let y = 0; y < SIZE; y++) {
  raw[offset++] = 0; // no filter
  const gy = Math.floor(y / PIXEL);
  for (let x = 0; x < SIZE; x++) {
    const gx = Math.floor(x / PIXEL);
    const on = skull[gy]?.[gx] === 1;
    const c = on ? FG : BG;
    raw[offset++] = c[0];
    raw[offset++] = c[1];
    raw[offset++] = c[2];
    raw[offset++] = 0xFF;
  }
}

// PNG encoding helpers
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

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// Compress
const compressed = deflateSync(raw, { level: 6 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // signature
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
writeFileSync(outPath, png);
console.log(`Icon written to ${outPath} (${png.length} bytes)`);
