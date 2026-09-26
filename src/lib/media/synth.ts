import sharp from "sharp";
import { createFile } from "mp4box";

// Synthetic assets with exact, known byte-level properties. Used by the test
// fixtures (tests/fixtures) and by the rule-breaker demo, which needs real
// bytes that break a platform rule. Nothing here is ever "fixed up" to pass.

// Flat gradient PNG/JPEG/WebP: small file, exact dimensions.
export async function synthImage(
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp" = "png",
): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7b1fa2"/><stop offset="1" stop-color="#ff6f00"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  const img = sharp(Buffer.from(svg));
  const out = format === "png" ? img.png() : format === "jpeg" ? img.jpeg({ quality: 80 }) : img.webp();
  return new Uint8Array(await out.toBuffer());
}

// Random-noise PNG: incompressible, so the file is ~width*height*3 bytes.
// 1720x2150 is exactly 4:5 and >= 1080 wide (valid for Instagram in every
// way except size) and comes out at ~11 MB.
export async function synthNoisePng(width: number, height: number, seed = 1): Promise<Uint8Array> {
  const raw = Buffer.alloc(width * height * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < raw.length; i++) {
    // xorshift32 — deterministic, so the fixture is stable across runs
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    raw[i] = s & 0xff;
  }
  const png = await sharp(raw, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer();
  return new Uint8Array(png);
}

// A structurally valid MP4 (ftyp + moov + mdat) with one avc1 video track of
// the given dimensions and duration. Sample payloads are placeholders — the
// adapters only parse the container (moov), exactly as a platform's upload
// pre-check would before transcoding.
export function synthMp4(width: number, height: number, durationSec: number): Uint8Array {
  const file = createFile();
  const avcC = new Uint8Array([1, 0x42, 0xc0, 0x1e, 0xff, 0xe0, 0x00]).buffer;
  const trackId = file.addTrack({
    type: "avc1",
    width,
    height,
    timescale: 1000,
    avcDecoderConfigRecord: avcC,
  });
  const samples = Math.max(1, Math.round(durationSec));
  const per = Math.round((durationSec * 1000) / samples);
  for (let i = 0; i < samples; i++) {
    file.addSample(trackId, new Uint8Array(16), { duration: per, is_sync: true });
  }
  const stream = file.getBuffer();
  return new Uint8Array(stream.buffer as ArrayBuffer, 0, stream.byteLength);
}
