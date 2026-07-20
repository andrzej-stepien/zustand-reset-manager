import { describe, expectTypeOf, it } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
  createResettableStore,
  createResettableVanillaStore,
} from "../src/index";

interface UserState {
  user: string | null;
  setUser: (user: string) => void;
}

describe("type inference", () => {
  it("preserves the explicit state type through the wrapper", () => {
    const useStore = createResettableStore<UserState>("user", (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }));

    expectTypeOf(useStore).toEqualTypeOf<UseBoundStore<StoreApi<UserState>>>();
    expectTypeOf(useStore.getState()).toEqualTypeOf<UserState>();
    expectTypeOf(useStore.getState().user).toEqualTypeOf<string | null>();
    expectTypeOf(useStore.getState().setUser).parameter(0).toEqualTypeOf<string>();
  });

  it("infers the state type from the initializer return", () => {
    const useStore = createResettableStore("inferred", () => ({
      a: 1,
      b: "hello",
    }));

    expectTypeOf(useStore.getState().a).toEqualTypeOf<number>();
    expectTypeOf(useStore.getState().b).toEqualTypeOf<string>();
  });

  it("returns a vanilla StoreApi for the vanilla variant", () => {
    const store = createResettableVanillaStore<UserState>("v", (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }));

    expectTypeOf(store).toEqualTypeOf<StoreApi<UserState>>();
    expectTypeOf(store.getState()).toEqualTypeOf<UserState>();
  });

  it("supports the curried explicit-typing form", () => {
    const make = createResettableStore<UserState>("curried");
    expectTypeOf(make).toBeFunction();
    const useStore = make((set) => ({ user: null, setUser: (user) => set({ user }) }));
    expectTypeOf(useStore).toEqualTypeOf<UseBoundStore<StoreApi<UserState>>>();
    expectTypeOf(useStore.getState()).toEqualTypeOf<UserState>();
  });
});

interface CartState {
  items: string[];
  add: (item: string) => void;
}

describe("middleware mutator typing (no casts needed)", () => {
  it("types a persist-wrapped React store and exposes .persist (curried form)", () => {
    // Curried form keeps mutator inference with an explicit state type, exactly
    // like Zustand's own `create<T>()(...)`.
    const useCart = createResettableStore<CartState>("cart-types-persist")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: "cart-types-persist" },
      ),
    );

    expectTypeOf(useCart.getState()).toEqualTypeOf<CartState>();
    expectTypeOf(useCart.getState().items).toEqualTypeOf<string[]>();
    // The persist mutator surfaces `.persist` on the store without any cast.
    expectTypeOf(useCart.persist.hasHydrated()).toEqualTypeOf<boolean>();
    expectTypeOf(useCart.persist.clearStorage).toBeFunction();
  });

  it("types a devtools-wrapped React store without casts", () => {
    interface CounterState {
      count: number;
      inc: () => void;
    }
    const useCounter = createResettableStore<CounterState>("counter-types")(
      devtools(
        (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
        { name: "counter-types" },
      ),
    );

    expectTypeOf(useCounter.getState()).toEqualTypeOf<CounterState>();
    expectTypeOf(useCounter.getState().count).toEqualTypeOf<number>();
    // devtools augments setState with an optional action argument.
    useCounter.setState({ count: 1 }, false, "inc");
  });

  it("types persist on the vanilla variant", () => {
    interface SessionState {
      token: string | null;
    }
    const store = createResettableVanillaStore<SessionState>("session-types")(
      persist(() => ({ token: null as string | null }), {
        name: "session-types",
      }),
    );

    expectTypeOf(store.getState()).toEqualTypeOf<SessionState>();
    expectTypeOf(store.persist.clearStorage).toBeFunction();
  });
});

describe("setState replace semantics (Zustand v4 + v5)", () => {
  it("requires the FULL state when replace is true", () => {
    const useStore = createResettableStore<UserState>("replace", (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }));

    // Full state with replace:true is allowed - this is exactly what reset does.
    useStore.setState({ user: "a", setUser: () => {} }, true);

    // In v5, a PARTIAL state with replace:true is a type error.
    // @ts-expect-error replace:true requires the complete state, not a partial
    useStore.setState({ user: "a" }, true);

    // A partial state WITHOUT replace is fine (merge semantics).
    useStore.setState({ user: "a" });
  });
});
