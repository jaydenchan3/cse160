// generate_textures.js — one-shot script to write 64x64 placeholder PNGs to textures/.
// Pure Node (no deps). Uses built-in zlib for the PNG IDAT deflate.
// Run: node generate_textures.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 64;
const OUT_DIR = path.join(__dirname, 'textures');

// ---- PNG encoder ----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// pixels: Uint8Array length w*h*3 (RGB)
function encodePNG(w, h, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 2;   // color type = RGB
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace

  // raw scanlines: filter byte (0 = None) then RGB
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy ? pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
                : Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- texture generators ---------------------------------------------------

// Tiny seeded PRNG so textures are deterministic between runs
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makePixels() {
  return new Uint8Array(SIZE * SIZE * 3);
}

function setPx(p, x, y, r, g, b) {
  const i = (y * SIZE + x) * 3;
  p[i] = r; p[i+1] = g; p[i+2] = b;
}

function grass() {
  const p = makePixels();
  const rng = makeRng(1);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // base green with vertical lightness variation (blade-y)
      const n = rng();
      const r = 40  + Math.floor(n * 30);
      const g = 110 + Math.floor(n * 70);
      const b = 35  + Math.floor(n * 25);
      setPx(p, x, y, r, g, b);
    }
  }
  // dark speckle "blades"
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPx(p, x, y, 25, 70, 25);
  }
  // a few brighter highlights
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPx(p, x, y, 150, 200, 90);
  }
  return p;
}

function dirt() {
  const p = makePixels();
  const rng = makeRng(2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng();
      const r = 110 + Math.floor(n * 35);
      const g = 75  + Math.floor(n * 25);
      const b = 45  + Math.floor(n * 20);
      setPx(p, x, y, r, g, b);
    }
  }
  // dark pebble spots
  for (let i = 0; i < 60; i++) {
    const cx = Math.floor(rng() * SIZE);
    const cy = Math.floor(rng() * SIZE);
    const r  = 1 + Math.floor(rng() * 2);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy > r*r) continue;
        const x = (cx + dx + SIZE) % SIZE;
        const y = (cy + dy + SIZE) % SIZE;
        setPx(p, x, y, 60, 40, 25);
      }
    }
  }
  return p;
}

function stone() {
  const p = makePixels();
  const rng = makeRng(3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng();
      const v = 110 + Math.floor(n * 50);
      setPx(p, x, y, v, v, v + 5);
    }
  }
  // darker cracks/blotches
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(rng() * SIZE);
    const cy = Math.floor(rng() * SIZE);
    const len = 2 + Math.floor(rng() * 4);
    const horiz = rng() < 0.5;
    for (let k = 0; k < len; k++) {
      const x = (cx + (horiz ? k : 0)) % SIZE;
      const y = (cy + (horiz ? 0 : k)) % SIZE;
      setPx(p, x, y, 70, 70, 75);
    }
  }
  return p;
}

function gold() {
  const p = makePixels();
  const rng = makeRng(5);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = rng();
      const r = 200 + Math.floor(n * 45);
      const g = 170 + Math.floor(n * 55);
      const b = 25  + Math.floor(n * 35);
      setPx(p, x, y, r, g, b);
    }
  }
  // darker flecks
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPx(p, x, y, 130, 100, 20);
  }
  // bright glints — gold needs sparkle to read as gold and not just yellow
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPx(p, x, y, 255, 240, 130);
  }
  return p;
}

function wood() {
  const p = makePixels();
  const rng = makeRng(4);
  for (let y = 0; y < SIZE; y++) {
    // each row is one horizontal "grain" band
    const band = ((y >> 2) & 1) === 0;
    for (let x = 0; x < SIZE; x++) {
      const n = rng();
      let r = (band ? 130 : 105) + Math.floor(n * 25);
      let g = (band ? 85  : 65)  + Math.floor(n * 18);
      let b = (band ? 45  : 30)  + Math.floor(n * 12);
      setPx(p, x, y, r, g, b);
    }
  }
  // occasional dark "knot" lines
  for (let i = 0; i < 6; i++) {
    const y = Math.floor(rng() * SIZE);
    for (let x = 0; x < SIZE; x++) {
      setPx(p, x, y, 60, 35, 20);
    }
  }
  return p;
}

// ---- driver ---------------------------------------------------------------

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TEXTURES = [
  ['grass.png', grass()],
  ['dirt.png',  dirt()],
  ['stone.png', stone()],
  ['wood.png',  wood()],
  ['gold.png',  gold()],
];

for (const [name, pixels] of TEXTURES) {
  const png = encodePNG(SIZE, SIZE, pixels);
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
