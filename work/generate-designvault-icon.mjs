import fs from "node:fs";
import zlib from "node:zlib";

const output = process.argv[2];
const size = 1024;
const data = Buffer.alloc((size * 4 + 1) * size);

function setPixel(x, y, r, g, b, a = 255) {
  const row = y * (size * 4 + 1);
  const offset = row + 1 + x * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

function fillRect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      setPixel(xx, yy, color[0], color[1], color[2], color[3] ?? 255);
    }
  }
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, payload) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, payload])));
  return Buffer.concat([length, typeBuffer, payload, crc]);
}

for (let y = 0; y < size; y += 1) {
  data[y * (size * 4 + 1)] = 0;
}

fillRect(0, 0, size, size, [255, 255, 255, 255]);
fillRect(96, 96, 832, 28, [10, 10, 10, 255]);
fillRect(96, 900, 832, 28, [10, 10, 10, 255]);
fillRect(96, 96, 28, 832, [10, 10, 10, 255]);
fillRect(900, 96, 28, 832, [10, 10, 10, 255]);

// Blocky Swiss-ish DV mark.
fillRect(220, 280, 70, 400, [10, 10, 10, 255]);
fillRect(290, 280, 145, 70, [10, 10, 10, 255]);
fillRect(290, 610, 145, 70, [10, 10, 10, 255]);
fillRect(435, 350, 70, 260, [10, 10, 10, 255]);

for (let i = 0; i < 270; i += 1) {
  fillRect(560 + i, 280 + i, 58, 58, [10, 10, 10, 255]);
  fillRect(830 - i, 280 + i, 58, 58, [10, 10, 10, 255]);
}

fillRect(220, 772, 584, 30, [10, 10, 10, 255]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(data, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync(output, png);
