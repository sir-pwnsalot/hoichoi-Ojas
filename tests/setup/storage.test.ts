import { afterEach, describe, expect, it, vi } from "vitest";
import { putObject, StorageConfigError } from "@/lib/storage";

describe("storage on Vercel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses local-disk writes in production without a Blob token", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const err = await putObject("gen/x.png", new Uint8Array([1]), "image/png").catch((e) => e);
    expect(err).toBeInstanceOf(StorageConfigError);
    expect((err as Error).message).toMatch(/BLOB_READ_WRITE_TOKEN missing in production/);
  });
});
