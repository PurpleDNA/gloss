// Minimal dependency-free PNG writer, so the repo carries no binary assets
// and icons can be regenerated with `npm run icons`.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const INDIGO = [79, 70, 229];
const AMBER = [251, 191, 36];
const WHITE = [255, 255, 255];

/** Signed-distance coverage for a rounded rect, sampled 4x4 per pixel. */
function roundedRectCoverage(px, py, x, y, w, h, r) {
  let hits = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const fx = px + (sx + 0.5) / 4;
      const fy = py + (sy + 0.5) / 4;
      const dx = Math.max(x + r - fx, 0, fx - (x + w - r));
      const dy = Math.max(y + r - fy, 0, fy - (y + h - r));
      if (Math.hypot(dx, dy) <= r) hits++;
    }
  }
  return hits / 16;
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size / 128; // design at 128, scale down

  // Three "lines of text"; the middle one is highlighted — a gloss.
  const bars = [
    { x: 30, y: 38, w: 68, h: 11, r: 5.5, c: WHITE, a: 0.55 },
    { x: 30, y: 58, w: 84, h: 13, r: 6.5, c: AMBER, a: 1 },
    { x: 30, y: 81, w: 52, h: 11, r: 5.5, c: WHITE, a: 0.55 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // background plate
      let cov = roundedRectCoverage(x, y, 4 * s, 4 * s, 120 * s, 120 * s, 28 * s);
      let [r, g, b] = INDIGO;
      let a = cov;

      for (const bar of bars) {
        const bc =
          roundedRectCoverage(x, y, bar.x * s, bar.y * s, bar.w * s, bar.h * s, bar.r * s) *
          bar.a * cov;
        if (bc > 0) {
          r = Math.round(r * (1 - bc) + bar.c[0] * bc);
          g = Math.round(g * (1 - bc) + bar.c[1] * bc);
          b = Math.round(b * (1 - bc) + bar.c[2] * bc);
        }
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, buf);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`public/icons/${size}.png`, render(size));
  console.log(`public/icons/${size}.png`);
}

// Store listing artwork. Not shipped in the package — upload separately.
mkdirSync("store/assets", { recursive: true });
writeFileSync("store/assets/logo-300.png", render(300));
console.log("store/assets/logo-300.png");
