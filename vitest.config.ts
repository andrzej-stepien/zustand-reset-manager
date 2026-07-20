import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // vitest 4 removed `environmentMatchGlobs`, so we split by projects: the
    // bulk of the suite runs in `node`, while React re-render and real
    // `localStorage` tests need a DOM and run in `happy-dom`.
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          // Flat files only - the DOM tests live under test/react/ and
          // test/dom/ and must NOT be picked up by the node project.
          include: ["test/*.test.ts"],
          typecheck: {
            // Run the type-level tests (expectTypeOf) as part of `vitest run`.
            enabled: true,
            include: ["test/**/*.test-d.ts"],
          },
        },
      },
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["test/react/**/*.test.tsx", "test/dom/**/*.test.ts"],
        },
      },
    ],
  },
});
