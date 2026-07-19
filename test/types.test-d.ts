import { describe, expectTypeOf, it } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";
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
