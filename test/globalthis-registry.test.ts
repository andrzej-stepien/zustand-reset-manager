import { afterEach, describe, expect, it, vi } from "vitest";

interface CounterState {
  n: number;
  bump: () => void;
}

describe("globalThis registry is shared across module copies", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("two fresh module evaluations share ONE registry", async () => {
    // Simulate two copies of the package: `vi.resetModules()` forces a fresh
    // evaluation of the whole module graph, so `modA` and `modB` are distinct
    // module instances (their functions are different references). Because the
    // registry lives on `globalThis` under a `Symbol.for` key, both copies must
    // still see the same set of registered stores.
    vi.resetModules();
    const modA = await import("../src/index");
    vi.resetModules();
    const modB = await import("../src/index");

    // Distinct module instances (proves this is not just the module cache).
    expect(modA.resetAllStores).not.toBe(modB.resetAllStores);

    const store = modA.createResettableVanillaStore<CounterState>(
      "shared-global",
      (set) => ({ n: 0, bump: () => set((s) => ({ n: s.n + 1 })) }),
    );

    store.getState().bump();
    expect(store.getState().n).toBe(1);

    // Copy B sees the store registered through copy A...
    expect(modB.getRegisteredStoreNames()).toContain("shared-global");

    // ...and can reset it.
    modB.resetAllStores();
    expect(store.getState().n).toBe(0);

    modB.unregisterStore("shared-global");
    expect(modA.getRegisteredStoreNames()).not.toContain("shared-global");
  });
});
