import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

// Generate raw RGBA buffer and encode to compliant PNG using Node's built-in zlib
function createPng(width, height, isMaskable = false) {
  const rowSize = width * 4 + 1; // 1 filter byte per row
  const rawBuffer = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.5 : 0.44); // squircle/rounded box if not maskable

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Distance from center
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const distSq = dx * dx + dy * dy;

      // Background gradient: dark navy (#0f172a to #020617)
      const gradT = (x + y) / (width + height);
      let r = Math.round(15 * (1 - gradT) + 2 * gradT);
      let g = Math.round(23 * (1 - gradT) + 6 * gradT);
      let b = Math.round(42 * (1 - gradT) + 23 * gradT);
      let a = 255;

      if (!isMaskable) {
        // Rounded corner container
        const cornerRadius = width * 0.22;
        const cornerDx = Math.max(0, dx - (cx - cornerRadius));
        const cornerDy = Math.max(0, dy - (cy - cornerRadius));
        if (cornerDx * cornerDx + cornerDy * cornerDy > cornerRadius * cornerRadius) {
          a = 0;
        }
      }

      // Draw Origami Paper Plane inside bounds
      if (a > 0) {
        // Normalized plane coordinates
        const scale = (width / 512) * (isMaskable ? 0.72 : 0.85);
        const offsetX = cx - 210 * scale;
        const offsetY = cy - 200 * scale;

        const px = (x - offsetX) / scale;
        const py = (y - offsetY) / scale;

        // Triangle 1: Right wing (380,36 -> 70,240 -> 196,288)
        if (pointInTriangle(px, py, 380, 36, 70, 240, 196, 288)) {
          r = 99; g = 102; b = 241; // Indigo #6366f1
        }
        // Triangle 2: Center fold (380,36 -> 196,288 -> 256,380)
        else if (pointInTriangle(px, py, 380, 36, 196, 288, 256, 380)) {
          r = 129; g = 140; b = 248; // Indigo light #818cf8
        }
        // Triangle 3: Left wing shadow (380,36 -> 256,380 -> 350,140)
        else if (pointInTriangle(px, py, 380, 36, 256, 380, 350, 140)) {
          r = 55; g = 48; b = 163; // Deep indigo #3730a3
        }
        // Triangle 4: Rear crease (196,288 -> 256,380 -> 236,308)
        else if (pointInTriangle(px, py, 196, 288, 256, 380, 236, 308)) {
          r = 49; g = 46; b = 129; // Deep shadow #312e81
        }
      }

      rawBuffer[pixelOffset] = r;
      rawBuffer[pixelOffset + 1] = g;
      rawBuffer[pixelOffset + 2] = b;
      rawBuffer[pixelOffset + 3] = a;
    }
  }

  return encodePng(width, height, rawBuffer);
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = sign(px, py, x1, y1, x2, y2);
  const d2 = sign(px, py, x2, y2, x3, y3);
  const d3 = sign(px, py, x3, y3, x1, y1);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function sign(p1x, p1y, p2x, p2y, p3x, p3y) {
  return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
}

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePng(width, height, rawBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Non-interlaced

  const compressedData = zlib.deflateSync(rawBuffer, { level: 9 });
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Output directory
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons in /public...');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(32, 32, false));
console.log('All PWA icons generated successfully!');
