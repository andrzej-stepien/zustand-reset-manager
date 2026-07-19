import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    typecheck: {
      // Run the type-level tests (expectTypeOf) as part of `vitest run`.
      enabled: true,
      include: ["test/**/*.test-d.ts"],
    },
  },
});
