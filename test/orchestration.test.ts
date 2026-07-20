import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addResetListener,
  createResettableVanillaStore,
  getRegisteredStoreNames,
  resetAllStores,
  resetStore,
  resetStores,
  unregisterStore,
} from "../src/index";

interface CounterState {
  count: number;
  increment: () => void;
}

const counter =
  () =>
  (set: (fn: (s: CounterState) => Partial<CounterState>) => void): CounterState => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  });

// Keep the global registry clean between tests. Listeners returned by
// addResetListener are unsubscribed inside each test.
afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

describe("addResetListener (global hooks)", () => {
  it("fires beforeReset then afterReset with name, group and reason", () => {
    createResettableVanillaStore<CounterState>(
      { name: "a", group: "session" },
      counter(),
    );

    const calls: string[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) =>
        calls.push(`before:${ctx.name}:${ctx.group}:${ctx.reason}`),
      afterReset: (ctx) =>
        calls.push(`after:${ctx.name}:${ctx.group}:${ctx.reason}`),
    });

    resetStore("a");
    expect(calls).toEqual([
      "before:a:session:undefined",
      "after:a:session:undefined",
    ]);

    unsubscribe();
  });

  it("forwards the reason from ResetOptions to the hooks", async () => {
    createResettableVanillaStore<CounterState>("a", counter());

    const reasons: (string | undefined)[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => reasons.push(ctx.reason),
    });

    await resetStore("a", { reason: "logout" });
    expect(reasons).toEqual(["logout"]);

    unsubscribe();
  });

  it("stops firing after unsubscribe (idempotent)", () => {
    createResettableVanillaStore<CounterState>("a", counter());

    let count = 0;
    const unsubscribe = addResetListener({ beforeReset: () => (count += 1) });

    resetStore("a");
    expect(count).toBe(1);

    unsubscribe();
    unsubscribe(); // second call is a no-op

    resetStore("a");
    expect(count).toBe(1); // unchanged
  });

  it("a throwing listener is logged but does not break the reset or other listeners", () => {
    const store = createResettableVanillaStore<CounterState>("a", counter());
    store.getState().increment();
    expect(store.getState().count).toBe(1);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const otherRan: string[] = [];

    const unsub1 = addResetListener({
      beforeReset: () => {
        throw new Error("boom");
      },
    });
    const unsub2 = addResetListener({
      beforeReset: () => otherRan.push("before"),
      afterReset: () => otherRan.push("after"),
    });

    resetStore("a");

    // The reset still happened.
    expect(store.getState().count).toBe(0);
    // The other listener still ran both phases.
    expect(otherRan).toEqual(["before", "after"]);
    // The thrown error was logged with the package prefix.
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain("[zustand-reset-manager]");

    error.mockRestore();
    unsub1();
    unsub2();
  });
});

describe("dependsOn ordering", () => {
  it("resets dependencies before dependents in resetAllStores", () => {
    // c depends on b, b depends on a  =>  reset order a, b, c
    createResettableVanillaStore<CounterState>({ name: "c", dependsOn: ["b"] }, counter());
    createResettableVanillaStore<CounterState>({ name: "b", dependsOn: ["a"] }, counter());
    createResettableVanillaStore<CounterState>({ name: "a" }, counter());

    const order: string[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => order.push(ctx.name),
    });

    resetAllStores();
    expect(order).toEqual(["a", "b", "c"]);

    unsubscribe();
  });

  it("respects dependsOn within a single group (resetStores)", () => {
    createResettableVanillaStore<CounterState>(
      { name: "profile", group: "user", dependsOn: ["auth"] },
      counter(),
    );
    createResettableVanillaStore<CounterState>(
      { name: "auth", group: "user" },
      counter(),
    );
    // A store in another group must not be touched or ordered against.
    createResettableVanillaStore<CounterState>(
      { name: "telemetry", group: "other" },
      counter(),
    );

    const order: string[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => order.push(ctx.name),
    });

    resetStores("user");
    expect(order).toEqual(["auth", "profile"]);

    unsubscribe();
  });

  it("keeps the dependency order through the async (options) path", async () => {
    createResettableVanillaStore<CounterState>({ name: "c", dependsOn: ["b"] }, counter());
    createResettableVanillaStore<CounterState>({ name: "b", dependsOn: ["a"] }, counter());
    createResettableVanillaStore<CounterState>({ name: "a" }, counter());

    const order: string[] = [];
    const unsubscribe = addResetListener({
      afterReset: (ctx) => order.push(ctx.name),
    });

    await resetAllStores({ reason: "logout" });
    expect(order).toEqual(["a", "b", "c"]);

    unsubscribe();
  });

  it("ignores a dependency on a store that is not registered (soft edge)", () => {
    createResettableVanillaStore<CounterState>(
      { name: "a", dependsOn: ["ghost"] },
      counter(),
    );

    const order: string[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => order.push(ctx.name),
    });

    // Must not throw and must still reset the store.
    expect(() => resetAllStores()).not.toThrow();
    expect(order).toEqual(["a"]);

    unsubscribe();
  });

  it("warns (dev) on a dependency cycle and falls back to registration order", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // a <-> b cycle.
    createResettableVanillaStore<CounterState>({ name: "a", dependsOn: ["b"] }, counter());
    createResettableVanillaStore<CounterState>({ name: "b", dependsOn: ["a"] }, counter());

    const order: string[] = [];
    const unsubscribe = addResetListener({
      beforeReset: (ctx) => order.push(ctx.name),
    });

    resetAllStores();

    // Fallback = registration order.
    expect(order).toEqual(["a", "b"]);
    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("dependency cycle"),
      ),
    ).toBe(true);

    warn.mockRestore();
    unsubscribe();
  });
});
