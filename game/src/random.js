// Seeded randomness for Meridian Ridge Run: a small mulberry32 PRNG plus
// smooth value noise, so every mission seed always builds the same valley.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise in [-1, 1] over the x/z plane.
export function noise2(x, z, seed) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash2(xi, zi, seed) * 2 - 1;
  const b = hash2(xi + 1, zi, seed) * 2 - 1;
  const c = hash2(xi, zi + 1, seed) * 2 - 1;
  const d = hash2(xi + 1, zi + 1, seed) * 2 - 1;
  const u = smooth(xf);
  const v = smooth(zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Two octaves of value noise, still in roughly [-1, 1].
export function fbm2(x, z, seed) {
  return noise2(x, z, seed) * 0.65 + noise2(x * 2.3 + 11, z * 2.3 + 7, seed + 5) * 0.35;
}
