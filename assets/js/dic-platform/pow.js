/*
 * Solves the sign-in proof-of-work challenge (server/src/guard.js): finds a
 * number n such that SHA-256("<salt>:<n>") starts with `bits` zero bits.
 * Runs in a Web Worker so the page stays responsive (about half a second on
 * a phone at 17 bits); falls back to small slices on the main thread.
 */

/* Everything below runs inside the worker too (stringified), so it stays self-contained. */
function powSearch(salt, bits, start, count) {
  const K = new Int32Array([
    0x428a2f98, 0x71374491, -0x4a3f0431, -0x164a245b, 0x3956c25b, 0x59f111f1, -0x6dc07d5c, -0x54e3a12b,
    -0x27f85568, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, -0x7f214e02, -0x6423f959, -0x3e640e8c,
    -0x1b64963f, -0x1041b87a, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    -0x67c1aeae, -0x57ce3993, -0x4ffcd838, -0x40a68039, -0x391ff40d, -0x2a586eb9, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, -0x7e3d36d2, -0x6d8dd37b,
    -0x5d40175f, -0x57e599b5, -0x3db47490, -0x3893ae5d, -0x2e6d17e7, -0x2966f9dc, -0xbf1ca7b, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, -0x7b3787ec, -0x7338fdf8, -0x6f410006, -0x5baf9315, -0x41065c09, -0x398e870e,
  ]);
  const H0 = [0x6a09e667, -0x4498517b, 0x3c6ef372, -0x5ab00ac6, 0x510e527f, -0x64fa9774, 0x1f83d9ab, 0x5be0cd19];
  const W = new Int32Array(64);
  const prefix = salt + ":";
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let n = start; n < start + count; n++) {
    const msg = prefix + n;                       // ASCII, < 56 bytes: one block
    const len = msg.length;
    W.fill(0, 0, 16);
    for (let i = 0; i < len; i++) W[i >> 2] |= msg.charCodeAt(i) << (24 - (i % 4) * 8);
    W[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    W[15] = len * 8;
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (W[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H0;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    const w0 = (a + H0[0]) | 0, w1 = (b + H0[1]) | 0;
    const zeros = w0 === 0 ? 32 + Math.clz32(w1) : Math.clz32(w0);
    if (zeros >= bits) return n;
  }
  return -1;
}

let worker;
function getWorker() {
  if (worker !== undefined) return worker;
  try {
    const src = `${powSearch}\nonmessage = (e) => { const { salt, bits } = e.data; for (let s = 0; ; s += 50000) { const n = powSearch(salt, bits, s, 50000); if (n >= 0) { postMessage(n); return; } } };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  } catch {
    worker = null; // e.g. blocked by a strict browser: solve on the page instead
  }
  return worker;
}

/** { challenge, bits } from GET /api/auth/challenge → { challenge, nonce } for POST /api/auth/code. */
export async function solveChallenge({ challenge, bits }) {
  if (!bits) return {};
  const salt = challenge.split(".")[0];
  const w = getWorker();
  let n;
  if (w) {
    n = await new Promise((resolve, reject) => {
      w.onmessage = (e) => resolve(e.data);
      w.onerror = (e) => { e.preventDefault(); worker = null; reject(e); };
      w.postMessage({ salt, bits });
    }).catch(() => null);
  }
  for (let s = 0; n == null || n < 0; s += 20000) {
    n = powSearch(salt, bits, s, 20000);
    if (n < 0) await new Promise((r) => setTimeout(r)); // let the page breathe between slices
  }
  return { challenge, nonce: String(n) };
}
