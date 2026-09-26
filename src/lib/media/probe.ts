import { createHash } from "node:crypto";
import sharp from "sharp";
import { createFile, MP4BoxBuffer, type Movie } from "mp4box";

// Facts about an asset, read FROM THE BYTES — never from the upload's
// claimed filename/content-type or anything the client says. Adapters
// (non-negotiable #4) validate against these.

export type AssetFormat = "png" | "jpeg" | "webp" | "mp4" | "webm";

export interface AssetProbe {
  format: AssetFormat;
  mime: string;
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

export class UnsupportedAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedAssetError";
  }
}

function sniff(b: Uint8Array): AssetFormat | null {
  const ascii = (start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (b.length >= 12 && ascii(4, 4) === "ftyp") return "mp4";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

const MIME: Record<AssetFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

function probeMp4(bytes: Uint8Array): { width: number; height: number; durationSec: number } {
  const file = createFile();
  const state: { info: Movie | null; error: string | null } = { info: null, error: null };
  file.onReady = (i) => {
    state.info = i;
  };
  file.onError = (_module: string, message: string) => {
    state.error = message;
  };
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, 0), true);
  file.flush();
  const movie = state.info;
  if (!movie) throw new UnsupportedAssetError(`unparseable MP4${state.error ? `: ${state.error}` : ""}`);
  const video = movie.videoTracks[0];
  if (!video?.video) throw new UnsupportedAssetError("MP4 has no video track");

  // MediaRecorder MP4s are fragmented: moov duration is often 0, so also
  // consider the fragment duration and the summed sample durations.
  const candidates: number[] = [];
  if (movie.duration && movie.timescale) candidates.push(movie.duration / movie.timescale);
  if (movie.fragment_duration?.den) candidates.push(movie.fragment_duration.num / movie.fragment_duration.den);
  const trak = file.getTrackById(video.id);
  if (trak?.samples_duration && video.timescale) candidates.push(trak.samples_duration / video.timescale);
  if (video.duration && video.timescale) candidates.push(video.duration / video.timescale);
  const durationSec = Math.max(0, ...candidates);

  return { width: video.video.width, height: video.video.height, durationSec };
}

export async function probeAsset(input: Uint8Array): Promise<AssetProbe> {
  const format = sniff(input);
  if (!format) throw new UnsupportedAssetError("unrecognised file format (expected PNG, JPEG, WebP, MP4 or WebM)");
  const sha256 = createHash("sha256").update(input).digest("hex");
  const base = { format, mime: MIME[format], sha256, bytes: input.byteLength };

  if (format === "mp4") return { ...base, ...probeMp4(input) };
  if (format === "webm") {
    // Chrome's WebM MediaRecorder output carries no duration header; we
    // record null rather than guess. Adapters reject non-MP4 video anyway.
    return { ...base, width: null, height: null, durationSec: null };
  }
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) throw new UnsupportedAssetError("image has no readable dimensions");
  return { ...base, width: meta.width, height: meta.height, durationSec: null };
}
