import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

// Asset storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise
// public/uploads (dev only). URLs returned are either absolute blob URLs or
// site-relative "/uploads/..." paths. On Vercel the function filesystem is
// read-only (except /tmp), so a missing Blob token there is a config error,
// never a local write.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

// Local-disk writes are allowed only outside Vercel / production builds.
export function localWritesAllowed(): boolean {
  return !process.env.VERCEL && process.env.NODE_ENV !== "production";
}

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobAccess(): "public" | "private" {
  return process.env.BLOB_ACCESS === "private" ? "private" : "public";
}

function safePathname(pathname: string): string {
  const clean = path.posix.normalize(pathname).replace(/^\/+/, "");
  if (clean.startsWith("..") || clean.includes("\0")) throw new Error(`Bad storage path "${pathname}"`);
  return clean;
}

export async function putObject(pathname: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const key = safePathname(pathname);
  if (blobEnabled()) {
    const res = await put(key, Buffer.from(bytes), {
      access: blobAccess(),
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return res.url;
  }
  if (!localWritesAllowed()) {
    throw new StorageConfigError(
      "BLOB_READ_WRITE_TOKEN missing in production: refusing to write to public/uploads (read-only filesystem). Connect a Vercel Blob store to this project.",
    );
  }
  const file = path.join(UPLOADS_DIR, ...key.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return `/uploads/${key}`;
}

// Reads bytes back by URL (as returned from putObject) or by pathname.
// Returns null when the object doesn't exist.
export async function getObject(urlOrPathname: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (urlOrPathname.startsWith("/uploads/") || !blobEnabled()) {
    const key = safePathname(urlOrPathname.replace(/^\/?uploads\//, ""));
    try {
      const buf = await readFile(path.join(UPLOADS_DIR, ...key.split("/")));
      return { bytes: new Uint8Array(buf), contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }
  const res = await get(urlOrPathname, { access: blobAccess() });
  if (!res || res.statusCode !== 200) return null;
  const bytes = new Uint8Array(await new Response(res.stream).arrayBuffer());
  return { bytes, contentType: res.blob.contentType };
}

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
