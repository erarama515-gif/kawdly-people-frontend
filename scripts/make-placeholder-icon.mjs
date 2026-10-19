/**
 * Kawdly People — generate the PLACEHOLDER application icon (T5).
 *
 * Writes `electron/build/icon.png` (256x256 RGBA) and `electron/build/icon.ico`
 * (a single 256x256 PNG-compressed entry, the Vista+ ICO form).
 *
 * ---------------------------------------------------------------------------
 * Why a generator instead of just committing two binaries
 * ---------------------------------------------------------------------------
 * A committed .ico with no provenance is indistinguishable from a real brand
 * asset six months from now, and nobody deletes a file they are not sure about.
 * This script makes the placeholder obviously a placeholder, reproducible, and
 * reviewable in a diff. When real artwork arrives, delete this file and commit
 * the artwork — electron-builder.yml does not need to change.
 *
 * Deliberately dependency-free: `node:zlib` provides the deflate stream a PNG
 * needs, so this adds nothing to package.json. Adding `sharp` or `png-to-ico`
 * to produce a placeholder would be a poor trade.
 *
 * Colours are the ones the splash already uses (electron/src/ui-html.ts), so the
 * installer, the taskbar and the first window agree with each other.
 *
 * Run: node scripts/make-placeholder-icon.mjs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

const SIZE = 256;
/** Samples per axis for edge smoothing. 3 is plenty at this size. */
const SUPERSAMPLE = 3;

const BACKGROUND = [0x0b, 0x12, 0x20]; // splash background
const GLYPH = [0x38, 0xbd, 0xf8]; // splash accent (sky)
const CORNER_RADIUS = 48;

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'electron', 'build');

// ─── geometry ─────────────────────────────────────────────────────────────────

/** Inside the rounded square that forms the icon's plate. */
function insidePlate(x, y) {
  const r = CORNER_RADIUS;
  const inX = x >= r && x <= SIZE - r;
  const inY = y >= r && y <= SIZE - r;
  if (inX || inY) {
    return x >= 0 && x <= SIZE && y >= 0 && y <= SIZE;
  }
  const cx = x < r ? r : SIZE - r;
  const cy = y < r ? r : SIZE - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Distance from point p to the segment a→b. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * A capital K: a vertical stem plus two diagonals meeting at its midpoint.
 * Stroke half-width 13 px gives a weight that still reads at 16x16.
 */
function insideGlyph(x, y) {
  const half = 13;
  const stem = distanceToSegment(x, y, 84, 62, 84, 194) <= half;
  const upper = distanceToSegment(x, y, 86, 128, 178, 62) <= half;
  const lower = distanceToSegment(x, y, 86, 128, 178, 194) <= half;
  return stem || upper || lower;
}

// ─── raster ───────────────────────────────────────────────────────────────────

function renderRgba() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      let plateHits = 0;
      let glyphHits = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          if (insidePlate(x, y)) {
            plateHits += 1;
            if (insideGlyph(x, y)) {
              glyphHits += 1;
            }
          }
        }
      }

      const alpha = plateHits / samples;
      const glyphRatio = plateHits === 0 ? 0 : glyphHits / plateHits;
      const offset = (py * SIZE + px) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          BACKGROUND[channel] * (1 - glyphRatio) + GLYPH[channel] * glyphRatio,
        );
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
}

// ─── PNG ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type. 0 = None: the image is tiny
  // and flat, so a smarter filter would buy bytes nobody is counting.
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ICO ──────────────────────────────────────────────────────────────────────

/**
 * Single-image ICO wrapping the PNG verbatim.
 *
 * Width/height bytes are 0, which the format defines as 256 — the field is one
 * byte and 256 does not fit. Windows Vista and later read PNG-compressed ICO
 * entries natively, and electron-builder requires at least 256x256 for NSIS.
 */
function encodeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width  = 256
  entry[1] = 0; // height = 256
  entry[2] = 0; // palette size (not paletted)
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

// ─── main ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const png = encodePng(renderRgba());
const ico = encodeIco(png);

fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), png);
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);

console.log(`icon.png  ${String(png.length).padStart(7)} bytes  (${SIZE}x${SIZE} RGBA)`);
console.log(`icon.ico  ${String(ico.length).padStart(7)} bytes  (1 entry, PNG-compressed)`);
console.log(`written to ${OUT_DIR}`);
