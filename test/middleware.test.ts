import { afterEach, describe, expect, it } from "vitest";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { StateStorage } from "zustand/middleware";
import {
  createResettableStore,
  getRegisteredStoreNames,
  resetStore,
  unregisterStore,
} from "../src/index";

afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

/** A synchronous fake `StateStorage` backed by an in-memory map. */
function createSyncStorage(): StateStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

interface CounterState {
  count: number;
  items: string[];
  inc: () => void;
  addItem: (item: string) => void;
}

describe("middleware combos - devtools(persist(immer(...)))", () => {
  it("resets state, keeps immer mutations working, and clears storage", async () => {
    const storage = createSyncStorage();
    const useStore = createResettableStore<CounterState>("mw-devtools")(
      devtools(
        persist(
          immer((set) => ({
            count: 0,
            items: [],
            // immer-style mutating recipes.
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            addItem: (item) =>
              set((s) => {
                s.items.push(item);
              }),
          })),
          { name: "mw-devtools", storage: createJSONStorage(() => storage) },
        ),
        { name: "mw-devtools" },
      ),
    );

    useStore.getState().inc();
    useStore.getState().addItem("apple");
    expect(useStore.getState().count).toBe(1);
    expect(useStore.getState().items).toEqual(["apple"]);
    expect(storage.map.get("mw-devtools")).toContain("apple");

    await resetStore("mw-devtools", { clearPersistedState: true });

    expect(useStore.getState().count).toBe(0);
    expect(useStore.getState().items).toEqual([]);
    expect(storage.map.has("mw-devtools")).toBe(false);

    // immer-based actions still work on the post-reset state.
    useStore.getState().inc();
    useStore.getState().addItem("pear");
    expect(useStore.getState().count).toBe(1);
    expect(useStore.getState().items).toEqual(["pear"]);
  });
});

describe("middleware combos - immer(persist(...))", () => {
  it("resets state, keeps immer mutations working, and clears storage", async () => {
    const storage = createSyncStorage();
    const useStore = createResettableStore<CounterState>("mw-immer-outer")(
      immer(
        persist(
          (set) => ({
            count: 0,
            items: [],
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            addItem: (item) =>
              set((s) => {
                s.items.push(item);
              }),
          }),
          {
            name: "mw-immer-outer",
            storage: createJSONStorage(() => storage),
          },
        ),
      ),
    );

    useStore.getState().inc();
    useStore.getState().addItem("apple");
    expect(useStore.getState().count).toBe(1);
    expect(useStore.getState().items).toEqual(["apple"]);
    expect(storage.map.get("mw-immer-outer")).toContain("apple");

    await resetStore("mw-immer-outer", { clearPersistedState: true });

    expect(useStore.getState().count).toBe(0);
    expect(useStore.getState().items).toEqual([]);
    expect(storage.map.has("mw-immer-outer")).toBe(false);

    // immer mutations still work after the reset.
    useStore.getState().inc();
    expect(useStore.getState().count).toBe(1);
  });

  it("resets a plain (no-clear) persisted immer store and overwrites storage", () => {
    const storage = createSyncStorage();
    const useStore = createResettableStore<CounterState>("mw-immer-plain")(
      immer(
        persist(
          (set) => ({
            count: 0,
            items: [],
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            addItem: (item) =>
              set((s) => {
                s.items.push(item);
              }),
          }),
          {
            name: "mw-immer-plain",
            storage: createJSONStorage(() => storage),
          },
        ),
      ),
    );

    useStore.getState().addItem("apple");
    expect(storage.map.get("mw-immer-plain")).toContain("apple");

    // Sync reset (no options) still overwrites storage with the fresh state.
    resetStore("mw-immer-plain");

    expect(useStore.getState().items).toEqual([]);
    expect(storage.map.has("mw-immer-plain")).toBe(true);
    expect(storage.map.get("mw-immer-plain")).not.toContain("apple");
  });
});
