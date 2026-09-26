import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global.ts"],
    env: { DATABASE_URL: "file:.test.db", BLOB_READ_WRITE_TOKEN: "" },
    testTimeout: 20_000,
    // One shared SQLite file: run test files one at a time.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
