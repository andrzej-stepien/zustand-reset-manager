import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createResettableStore,
  createResettableVanillaStore,
  getRegisteredStoreNames,
  resetAllStores,
  resetStore,
  resetStores,
  unregisterStore,
} from "../src/index";

// Keep the global registry clean between tests.
afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

interface CounterState {
  count: number;
  increment: () => void;
}

describe("resetStore (single, React store)", () => {
  it("restores the initial state and keeps actions working", () => {
    const useStore = createResettableStore<CounterState>("counter", (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    resetStore("counter");
    expect(useStore.getState().count).toBe(0);

    // Actions still work after reset.
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);
  });

  it("warns and does nothing for an unknown name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetStore("does-not-exist");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("resetStores (group)", () => {
  it("resets only the stores in the given group", () => {
    const useA = createResettableStore<CounterState>(
      { name: "a", group: "session" },
      (set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }),
    );
    const useB = createResettableStore<CounterState>(
      { name: "b", group: "session" },
      (set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }),
    );
    const useC = createResettableStore<CounterState>(
      { name: "c", group: "tenant" },
      (set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }),
    );

    useA.getState().increment();
    useB.getState().increment();
    useC.getState().increment();

    resetStores("session");

    expect(useA.getState().count).toBe(0);
    expect(useB.getState().count).toBe(0);
    expect(useC.getState().count).toBe(1); // untouched
  });
});

describe("resetAllStores", () => {
  it("resets every registered store regardless of group", () => {
    const useA = createResettableStore<CounterState>({ name: "a", group: "g1" }, (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    const storeB = createResettableVanillaStore<CounterState>("b", (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    useA.getState().increment();
    storeB.getState().increment();

    resetAllStores();

    expect(useA.getState().count).toBe(0);
    expect(storeB.getState().count).toBe(0);
  });
});

describe("initializer is re-run on reset (factory semantics)", () => {
  it("regenerates dynamic values instead of caching the first object", () => {
    interface RequestState {
      requestId: string;
      items: number[];
    }
    const useStore = createResettableStore<RequestState>("request", () => ({
      requestId: crypto.randomUUID(),
      items: [],
    }));

    const first = useStore.getState().requestId;
    useStore.setState({ items: [1, 2, 3] });

    resetStore("request");

    const second = useStore.getState().requestId;
    expect(useStore.getState().items).toEqual([]);
    // A cached-object approach would return the SAME id here.
    expect(second).not.toBe(first);
  });
});

describe("vanilla createStore support", () => {
  it("resets a vanilla store and keeps its actions working", () => {
    const store = createResettableVanillaStore<CounterState>("vanilla", (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    store.getState().increment();
    expect(store.getState().count).toBe(1);

    resetStore("vanilla");
    expect(store.getState().count).toBe(0);

    store.getState().increment();
    expect(store.getState().count).toBe(1);
  });
});

describe("curried / explicit-typing form", () => {
  it("supports createResettableStore<T>(name)(initializer)", () => {
    const useStore = createResettableStore<CounterState>("curried")((set) => ({
      count: 5,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    expect(useStore.getState().count).toBe(5);
    useStore.getState().increment();
    resetStore("curried");
    expect(useStore.getState().count).toBe(5);
  });
});

describe("registry hygiene", () => {
  it("unregisterStore removes a store so resetAllStores ignores it", () => {
    const store = createResettableVanillaStore<CounterState>("temp", (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    expect(getRegisteredStoreNames()).toContain("temp");

    store.getState().increment();
    expect(unregisterStore("temp")).toBe(true);
    expect(getRegisteredStoreNames()).not.toContain("temp");

    resetAllStores();
    // Still 1 because it was unregistered before the reset.
    expect(store.getState().count).toBe(1);
  });

  it("overwrites a duplicate name with a dev warning (HMR-safe)", () => {
    // Vitest runs with NODE_ENV=test (non-production), so the dev warn fires.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    createResettableVanillaStore<CounterState>("dup", (set) => ({
      count: 1,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    const second = createResettableVanillaStore<CounterState>("dup", (set) => ({
      count: 2,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    expect(warn).toHaveBeenCalledOnce();
    expect(getRegisteredStoreNames().filter((n) => n === "dup")).toHaveLength(1);

    second.getState().increment();
    resetStore("dup");
    expect(second.getState().count).toBe(2);

    warn.mockRestore();
  });
});
