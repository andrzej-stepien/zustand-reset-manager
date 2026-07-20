import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/testing.ts", "src/vanilla.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Split shared code into common chunks so the `.`, `./testing`, and
  // `./vanilla` entries share the same modules. The registry itself lives on
  // `globalThis` (see registry.ts), so it is one instance even across bundles.
  splitting: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  // zustand (and its own react peer) must stay external.
  external: ["zustand", "react"],
});
