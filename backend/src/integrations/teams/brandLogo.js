/**
 * Brand logo for the Teams cards, taken from a PNG in the project (BRAND_LOGO_PATH) and embedded
 * in the card as a data URI, so Teams never downloads it from a URL.
 *
 * Teams limits a whole card to ~28 KB, so the image is trimmed to its visible content (transparent
 * margins removed) and downscaled to LOGO_SIZE px with Node's zlib only (no image dependencies).
 * Supports non-interlaced PNGs of any colour type with bit depth ≤ 8. Any problem → no logo + warning.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const LOGO_SIZE = 96; // longest side in px: shown at 40 px, sharp on 2x screens
const MAX_DATA_URI_BYTES = 12_000; // leave room in the card for the content
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

let cached; // undefined = not loaded yet, null = no logo

/** `data:image/png;base64,...` for the configured logo, or null when there is none. */
export function getBrandLogoDataUri() {
  if (cached !== undefined) return cached;
  cached = null;
  if (!env.BRAND_LOGO_PATH) return cached;
  const file = path.resolve(BACKEND_ROOT, env.BRAND_LOGO_PATH);
  try {
    const png = encodePng(resize(trim(decodePng(fs.readFileSync(file))), LOGO_SIZE));
    const uri = `data:image/png;base64,${png.toString('base64')}`;
    if (uri.length > MAX_DATA_URI_BYTES) throw new Error(`logo still too large after resizing (${uri.length} bytes)`);
    cached = uri;
  } catch (err) {
    logger.warn({ file, error: err.message }, 'Brand logo not available; Teams cards will be sent without logo');
  }
  return cached;
}

// ------------------------------------------------------------------------------------ decode

function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let o = 8;
  let ihdr;
  let palette = [];
  let trns = null;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'PLTE') palette = Array.from({ length: len / 3 }, (_, i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const { width, height, depth, colorType, interlace } = ihdr ?? {};
  if (!ihdr) throw new Error('missing IHDR');
  if (interlace) throw new Error('interlaced PNGs are not supported');
  if (depth > 8) throw new Error('16-bit PNGs are not supported');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bpp = Math.max(1, (channels * depth) / 8); // bytes per pixel for filtering
  const stride = Math.ceil((width * channels * depth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  const maxVal = (1 << depth) - 1;

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    unfilter(filter, line, prev, bpp);
    prev = line;
    for (let x = 0; x < width; x++) {
      const sample = (i) => {
        if (depth === 8) return line[x * channels + i];
        const bit = (x * channels + i) * depth;
        return (line[bit >> 3] >> (8 - depth - (bit & 7))) & maxVal;
      };
      const p = (y * width + x) * 4;
      if (colorType === 3) {
        const idx = sample(0);
        const [r, g, b] = palette[idx] ?? [0, 0, 0];
        rgba.set([r, g, b, trns && idx < trns.length ? trns[idx] : 255], p);
      } else {
        const scale = (v) => (depth === 8 ? v : Math.round((v * 255) / maxVal));
        const c = Array.from({ length: channels }, (_, i) => scale(sample(i)));
        if (colorType === 0) rgba.set([c[0], c[0], c[0], 255], p);
        else if (colorType === 4) rgba.set([c[0], c[0], c[0], c[1]], p);
        else if (colorType === 2) rgba.set([c[0], c[1], c[2], 255], p);
        else rgba.set(c, p);
      }
    }
  }
  return { width, height, data: rgba };
}

function unfilter(type, line, prev, bpp) {
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    let add = 0;
    if (type === 1) add = a;
    else if (type === 2) add = b;
    else if (type === 3) add = (a + b) >> 1;
    else if (type === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    line[i] = (line[i] + add) & 0xff;
  }
}

// ------------------------------------------------------------------------- trim and resize

/** Crops fully transparent margins (no-op for opaque images). */
function trim(img) {
  const { width, height, data } = img;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('image is fully transparent');
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) data.copy(out, y * w * 4, ((minY + y) * width + minX) * 4, ((minY + y) * width + maxX + 1) * 4);
  return { width: w, height: h, data: out };
}

/** Area-average downscale so the longest side is `size` (premultiplied alpha, no dark fringes). */
function resize(img, size) {
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = Buffer.alloc(w * h * 4);
  const fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.min(img.height, Math.ceil((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.min(img.width, Math.ceil((x + 1) * fx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const p = (sy * img.width + sx) * 4;
          const al = img.data[p + 3];
          r += img.data[p] * al; g += img.data[p + 1] * al; b += img.data[p + 2] * al; a += al; n++;
        }
      }
      const q = (y * w + x) * 4;
      if (a) out.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)], q);
    }
  }
  return { width: w, height: h, data: out };
}

// ------------------------------------------------------------------------------------ encode

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** RGBA 8-bit PNG, filter "Sub" on every row (compresses flat logos well). */
function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 1;
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (data[y * stride + i] - (i >= 4 ? data[y * stride + i - 4] : 0)) & 0xff;
  }
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
