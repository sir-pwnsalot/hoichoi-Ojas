import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

// Asset storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise
// public/uploads (dev). URLs returned are either absolute blob URLs or
// site-relative "/uploads/..." paths.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

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
