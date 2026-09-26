import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { variants } from "@/db/schema";
import { getObject } from "@/lib/storage";

// GET /api/base-image?variantId=P-0001[&frame=0] — the generated, text-free
// base image for a variant, served same-origin so the canvas composers can
// draw it without tainting the canvas. Shorts variants have 2–3 frames;
// X-Frame-Count says how many.

const Query = z.object({
  variantId: z.string().regex(/^P-\d{4,}$/),
  frame: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({
    variantId: req.nextUrl.searchParams.get("variantId") ?? undefined,
    frame: req.nextUrl.searchParams.get("frame") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: { code: "BAD_QUERY", message: parsed.error.issues[0]?.message } }, { status: 400 });
  }
  const { variantId, frame } = parsed.data;
  const rows = await db
    .select({ baseImageUrls: variants.baseImageUrls })
    .from(variants)
    .where(eq(variants.id, variantId))
    .limit(1);
  const urls = rows[0]?.baseImageUrls ?? [];
  const url = urls[frame];
  if (!url) {
    return Response.json(
      { error: { code: "NO_BASE_IMAGE", message: `Variant ${variantId} has no base image frame ${frame}` } },
      { status: 404 },
    );
  }
  const obj = await getObject(url);
  if (!obj) return Response.json({ error: { code: "MISSING_OBJECT", message: "Stored image not found" } }, { status: 404 });
  return new Response(Buffer.from(obj.bytes), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Frame-Count": String(urls.length),
    },
  });
}
