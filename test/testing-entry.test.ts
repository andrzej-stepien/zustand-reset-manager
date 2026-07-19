import { afterEach, describe, expect, it } from "vitest";
import {
  createResettableVanillaStore,
  getRegisteredStoreNames,
  unregisterStore,
} from "../src/index";
import { resetAllStoresForTesting } from "../src/testing";

afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

describe("zustand-reset-manager/testing", () => {
  it("resetAllStoresForTesting resets stores registered via the main entry", () => {
    const store = createResettableVanillaStore<{ n: number; bump: () => void }>(
      "shared",
      (set) => ({ n: 0, bump: () => set((s) => ({ n: s.n + 1 })) }),
    );

    store.getState().bump();
    expect(store.getState().n).toBe(1);

    // The dedicated testing helper sees the SAME registry as the main entry.
    resetAllStoresForTesting();
    expect(store.getState().n).toBe(0);
  });
});
