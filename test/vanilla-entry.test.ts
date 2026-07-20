import { afterEach, describe, expect, it } from "vitest";
import {
  createResettableVanillaStore,
  getRegisteredStoreNames,
  unregisterStore,
} from "../src/vanilla";
import { resetStore } from "../src/index";

afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

interface CounterState {
  n: number;
  bump: () => void;
}

describe("zustand-reset-manager/vanilla entry", () => {
  it("exports the vanilla creator + reset API and shares the main registry", () => {
    const store = createResettableVanillaStore<CounterState>(
      "vanilla-entry",
      (set) => ({ n: 0, bump: () => set((s) => ({ n: s.n + 1 })) }),
    );

    store.getState().bump();
    expect(store.getState().n).toBe(1);

    // Registered via the vanilla entry, visible + resettable via the main entry.
    expect(getRegisteredStoreNames()).toContain("vanilla-entry");
    resetStore("vanilla-entry");
    expect(store.getState().n).toBe(0);
  });
});
