import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/testing.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Extract the shared registry into a common chunk so `.` and `./testing`
  // share ONE registry instance (critical for resetAllStores in tests).
  splitting: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  // zustand (and its own react peer) must stay external.
  external: ["zustand", "react"],
});
