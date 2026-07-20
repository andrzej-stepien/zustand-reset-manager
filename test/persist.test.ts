import { afterEach, describe, expect, it, vi } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import {
  createResettableStore,
  createResettableVanillaStore,
  getRegisteredStoreNames,
  resetStore,
  unregisterStore,
} from "../src/index";
import { createResetFn } from "../src/reset";
import type { Initializer, StoreApi } from "../src/types";

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

/** An asynchronous fake `StateStorage` (Promise-returning). */
function createAsyncStorage(): StateStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (name) => Promise.resolve(map.get(name) ?? null),
    setItem: (name, value) =>
      Promise.resolve().then(() => {
        map.set(name, value);
      }),
    removeItem: (name) =>
      Promise.resolve().then(() => {
        map.delete(name);
      }),
  };
}

interface CartState {
  items: string[];
  add: (item: string) => void;
}

describe("persist - synchronous storage", () => {
  it("resets memory and overwrites storage even WITHOUT clearPersistedState", () => {
    const storage = createSyncStorage();
    const useCart = createResettableStore<CartState>("cart")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart", storage: createJSONStorage(() => storage) },
      ),
    );

    useCart.getState().add("apple");
    expect(useCart.getState().items).toEqual(["apple"]);
    expect(storage.map.get("cart")).toContain("apple");

    // No options -> synchronous reset (0.1-style). Persist still overwrites
    // storage via its setState wrapper.
    resetStore("cart");

    expect(useCart.getState().items).toEqual([]);
    expect(storage.map.has("cart")).toBe(true);
    expect(storage.map.get("cart")).not.toContain("apple");
    // Action still works after reset.
    useCart.getState().add("pear");
    expect(useCart.getState().items).toEqual(["pear"]);
  });

  it("clearPersistedState removes the persisted entry from storage", async () => {
    const storage = createSyncStorage();
    const useCart = createResettableStore<CartState>("cart")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart", storage: createJSONStorage(() => storage) },
      ),
    );

    useCart.getState().add("apple");
    expect(storage.map.has("cart")).toBe(true);

    const result = resetStore("cart", { clearPersistedState: true });
    expect(result).toBeInstanceOf(Promise);
    await result;

    expect(useCart.getState().items).toEqual([]);
    expect(storage.map.has("cart")).toBe(false);
  });

  it("preserve keeps selected fields on a persisted store", async () => {
    interface PrefsState {
      theme: string;
      language: string;
      fontSize: number;
      setAll: (v: Partial<PrefsState>) => void;
    }
    const storage = createSyncStorage();
    const usePrefs = createResettableStore<PrefsState>("prefs")(
      persist(
        (set) => ({
          theme: "light",
          language: "en",
          fontSize: 14,
          setAll: (v) => set(v),
        }),
        { name: "prefs", storage: createJSONStorage(() => storage) },
      ),
    );

    usePrefs.getState().setAll({ theme: "dark", language: "fr", fontSize: 20 });

    await resetStore<PrefsState>("prefs", { preserve: ["theme", "language"] });

    const s = usePrefs.getState();
    expect(s.theme).toBe("dark"); // preserved
    expect(s.language).toBe("fr"); // preserved
    expect(s.fontSize).toBe(14); // reset
  });
});

describe("persist - asynchronous rehydration", () => {
  it("waits for in-flight rehydration to finish before resetting", async () => {
    const storage = createAsyncStorage();
    // Pre-seed the storage so an async rehydration is meaningful.
    storage.map.set(
      "cart",
      JSON.stringify({ state: { items: ["persisted"] }, version: 0 }),
    );

    const useCart = createResettableStore<CartState>("cart")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart", storage: createJSONStorage(() => storage) },
      ),
    );

    // Right after creation the async hydration is still pending.
    expect(useCart.persist.hasHydrated()).toBe(false);

    // Reset while hydration is in flight. It must wait for hydration to finish
    // (otherwise the rehydration would overwrite the reset), THEN reset.
    await resetStore<CartState>("cart", { clearPersistedState: true });

    expect(useCart.persist.hasHydrated()).toBe(true);
    expect(useCart.getState().items).toEqual([]);
    expect(storage.map.has("cart")).toBe(false);
  });

  it("without waiting, rehydration would win - the wait is what makes reset stick", async () => {
    const storage = createAsyncStorage();
    storage.map.set(
      "cart",
      JSON.stringify({ state: { items: ["persisted"] }, version: 0 }),
    );

    const useCart = createResettableStore<CartState>("cart")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart", storage: createJSONStorage(() => storage) },
      ),
    );

    // Await the reset (which internally waits for hydration).
    await resetStore("cart", {});

    // Let any further microtasks settle - nothing should overwrite the reset.
    await Promise.resolve();
    expect(useCart.getState().items).toEqual([]);
  });
});

describe("persist - vanilla variant", () => {
  it("resets a persisted vanilla store and clears storage", async () => {
    interface SessionState {
      token: string | null;
      setToken: (t: string) => void;
    }
    const storage = createSyncStorage();
    const store = createResettableVanillaStore<SessionState>("session")(
      persist(
        (set) => ({
          token: null,
          setToken: (token) => set({ token }),
        }),
        { name: "session", storage: createJSONStorage(() => storage) },
      ),
    );

    store.getState().setToken("abc");
    expect(store.getState().token).toBe("abc");
    expect(storage.map.has("session")).toBe(true);

    await resetStore("session", { clearPersistedState: true });

    expect(store.getState().token).toBeNull();
    expect(storage.map.has("session")).toBe(false);
  });
});

describe("persist - zustand <4.5 fallback (api without getInitialState)", () => {
  it("re-runs the initializer and warns in dev", () => {
    interface CounterState {
      count: number;
      inc: () => void;
    }

    // A fake persisted store api that mimics zustand <4.5: it exposes the
    // `persist` methods we feature-detect but has NO `getInitialState`.
    let state: CounterState;
    const fakeApi = {
      setState: (next: CounterState) => {
        state = next;
      },
      getState: () => state,
      subscribe: () => () => {},
      persist: {
        clearStorage: () => {},
        hasHydrated: () => true,
        onFinishHydration: () => () => {},
      },
    } as unknown as StoreApi<CounterState>;

    const initializer: Initializer<CounterState> = (set) => ({
      count: 0,
      inc: () => set((s) => ({ ...s, count: s.count + 1 })),
    });
    state = initializer(fakeApi.setState, fakeApi.getState, fakeApi);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const reset = createResetFn(fakeApi, initializer);
      state = { ...state, count: 5 };
      expect(fakeApi.getState().count).toBe(5);

      // (a) reset works via the initializer re-run fallback.
      reset();
      expect(fakeApi.getState().count).toBe(0);

      // (b) the dev-only warning fired (vitest sets NODE_ENV=test, so
      // isDev() is true here).
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0][0])).toContain("zustand >=4.5");
      expect(String(warnSpy.mock.calls[0][0])).toContain("getInitialState");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
