import { describe, expectTypeOf, it } from "vitest";
import {
  addResetListener,
  createResettableStore,
  createResettableVanillaStore,
  resetAllStores,
} from "../src/index";
import type { ResetListenerContext } from "../src/index";

interface UserState {
  user: string | null;
  setUser: (user: string) => void;
}

describe("orchestration option typing", () => {
  it("accepts group + dependsOn in the config object (no casts)", () => {
    const useStore = createResettableStore<UserState>(
      { name: "user", group: "session", dependsOn: ["auth"] },
      (set) => ({ user: null, setUser: (user) => set({ user }) }),
    );
    expectTypeOf(useStore.getState()).toEqualTypeOf<UserState>();
  });

  it("still accepts the plain string form (backward compatible)", () => {
    const useStore = createResettableStore<UserState>("user", (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }));
    expectTypeOf(useStore.getState()).toEqualTypeOf<UserState>();

    // Vanilla + curried form with config still works too.
    const store = createResettableVanillaStore<UserState>({
      name: "v",
      dependsOn: ["user"],
    })((set) => ({ user: null, setUser: (user) => set({ user }) }));
    expectTypeOf(store.getState()).toEqualTypeOf<UserState>();
  });

  it("accepts reason in ResetOptions without a cast", () => {
    // Options object -> Promise<void> return.
    expectTypeOf(resetAllStores({ reason: "logout" })).toEqualTypeOf<Promise<void>>();
    // reason combines with the existing options.
    void resetAllStores({ reason: "test", preserve: [], clearPersistedState: true });
  });
});

describe("addResetListener typing", () => {
  it("returns an unsubscribe function and types the context", () => {
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<ResetListenerContext>();
        expectTypeOf(ctx.name).toEqualTypeOf<string>();
        expectTypeOf(ctx.group).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.reason).toEqualTypeOf<string | undefined>();
      },
      afterReset: (ctx) => {
        expectTypeOf(ctx.name).toEqualTypeOf<string>();
      },
    });
    expectTypeOf(unsubscribe).toEqualTypeOf<() => void>();
  });

  it("accepts a partial listener (only one phase)", () => {
    addResetListener({ beforeReset: () => {} });
    addResetListener({ afterReset: () => {} });
    addResetListener({});
  });
});
