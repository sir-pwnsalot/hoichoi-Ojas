import type { NextRequest } from "next/server";
import { z } from "zod";
import { AssetConflictError, attachComposedAsset, VariantNotFoundError } from "@/lib/assets";
import { UnsupportedAssetError } from "@/lib/media/probe";

// POST /api/assets — composed asset (PNG/JPEG/WebP image or MP4 video) from
// the browser composers. Contract documented in docs/HANDOFF.md (M2).
//   multipart/form-data: file=<Blob>, variantId=<P-0001>
//   raw body:            POST /api/assets?variantId=P-0001 with the bytes as body
// Everything stored (sha256, width, height, bytes, duration) is read from
// the bytes; the client's filename/content-type are ignored.

const MAX_BYTES = 4_500_000; // Vercel Function request body limit
const VariantId = z.string().regex(/^P-\d{4,}$/, "variantId must look like P-0001");

async function readUpload(req: NextRequest): Promise<{ variantId: unknown; bytes: Uint8Array }> {
  const queryId = req.nextUrl.searchParams.get("variantId");
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new BadRequest('multipart body needs a "file" field');
    // Legacy composer calls only send the file as "variant-<id>.<ext>".
    const fromName = file instanceof File ? /^variant-(P-\d+)\./.exec(file.name)?.[1] : undefined;
    return {
      variantId: form.get("variantId") ?? queryId ?? fromName,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };
  }
  return { variantId: queryId, bytes: new Uint8Array(await req.arrayBuffer()) };
}

class BadRequest extends Error {}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return error(413, "FILE_TOO_LARGE", `Upload exceeds ${MAX_BYTES} bytes`);
  try {
    const { variantId, bytes } = await readUpload(req);
    const id = VariantId.safeParse(variantId);
    if (!id.success) return error(400, "BAD_VARIANT_ID", id.error.issues[0]?.message ?? "variantId required");
    if (bytes.byteLength === 0) return error(400, "EMPTY_BODY", "No file bytes received");
    if (bytes.byteLength > MAX_BYTES) return error(413, "FILE_TOO_LARGE", `Upload exceeds ${MAX_BYTES} bytes`);

    const asset = await attachComposedAsset(id.data, bytes);
    return Response.json(asset, { status: 201 });
  } catch (err) {
    if (err instanceof BadRequest) return error(400, "BAD_REQUEST", err.message);
    if (err instanceof UnsupportedAssetError) return error(415, "UNSUPPORTED_FORMAT", err.message);
    if (err instanceof VariantNotFoundError) return error(404, "VARIANT_NOT_FOUND", err.message);
    if (err instanceof AssetConflictError) return error(409, "VARIANT_LOCKED", err.message);
    console.error("[api/assets] upload failed", err);
    return error(500, "INTERNAL", "Asset upload failed");
  }
}
