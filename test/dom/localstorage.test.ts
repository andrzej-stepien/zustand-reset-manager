import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createResettableStore,
  getRegisteredStoreNames,
  resetStore,
  unregisterStore,
} from "../../src/index";

// happy-dom provides a real `window.localStorage`. These tests exercise the
// persist middleware against it (not an in-memory fake) and assert on the raw
// entry addressed by the persist `name` key.

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
  localStorage.clear();
});

interface CartState {
  items: string[];
  add: (item: string) => void;
}

describe("persist against real window.localStorage", () => {
  it("clearPersistedState removes the entry from window.localStorage", async () => {
    const useCart = createResettableStore<CartState>("cart-ls")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart-ls", storage: createJSONStorage(() => localStorage) },
      ),
    );

    useCart.getState().add("apple");
    expect(localStorage.getItem("cart-ls")).toContain("apple");

    await resetStore("cart-ls", { clearPersistedState: true });

    expect(useCart.getState().items).toEqual([]);
    // The key is physically gone from storage.
    expect(localStorage.getItem("cart-ls")).toBeNull();
    expect(Object.keys(localStorage)).not.toContain("cart-ls");
  });

  it("reset WITHOUT clearPersistedState overwrites the entry with fresh state", () => {
    const useCart = createResettableStore<CartState>("cart-ls2")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart-ls2", storage: createJSONStorage(() => localStorage) },
      ),
    );

    useCart.getState().add("apple");
    expect(localStorage.getItem("cart-ls2")).toContain("apple");

    // No options -> synchronous reset; persist re-writes storage via setState.
    resetStore("cart-ls2");

    expect(useCart.getState().items).toEqual([]);
    // The key survives but now holds the fresh (empty) state.
    const raw = localStorage.getItem("cart-ls2");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("apple");
    expect(JSON.parse(raw as string).state.items).toEqual([]);
  });
});
