import { describe, expectTypeOf, it } from "vitest";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createResettableStore } from "../src/index";

interface CounterState {
  count: number;
  items: string[];
  inc: () => void;
  addItem: (item: string) => void;
}

// These type-level tests document that stacked middleware creators flow through
// `createResettableStore` (curried form) WITHOUT any casts - the same inference
// contract Zustand's own `create<T>()(...)` provides.
describe("stacked middleware typing (no casts needed)", () => {
  it("types devtools(persist(immer(...))) and surfaces the persist mutator", () => {
    const useStore = createResettableStore<CounterState>("mw-types-devtools")(
      devtools(
        persist(
          immer((set) => ({
            count: 0,
            items: [] as string[],
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            addItem: (item) =>
              set((s) => {
                s.items.push(item);
              }),
          })),
          { name: "mw-types-devtools" },
        ),
        { name: "mw-types-devtools" },
      ),
    );

    expectTypeOf(useStore.getState()).toEqualTypeOf<CounterState>();
    expectTypeOf(useStore.getState().count).toEqualTypeOf<number>();
    // The persist mutator surfaces `.persist` on the store without a cast.
    expectTypeOf(useStore.persist.hasHydrated()).toEqualTypeOf<boolean>();
    expectTypeOf(useStore.persist.clearStorage).toBeFunction();
    // The devtools mutator augments setState with the optional action arg.
    useStore.setState({ count: 1 }, false, "inc");
  });

  it("types immer(persist(...)) and surfaces the persist mutator", () => {
    const useStore = createResettableStore<CounterState>("mw-types-immer")(
      immer(
        persist(
          (set) => ({
            count: 0,
            items: [] as string[],
            inc: () =>
              set((s) => {
                s.count += 1;
              }),
            addItem: (item) =>
              set((s) => {
                s.items.push(item);
              }),
          }),
          { name: "mw-types-immer" },
        ),
      ),
    );

    expectTypeOf(useStore.getState()).toEqualTypeOf<CounterState>();
    expectTypeOf(useStore.persist.clearStorage).toBeFunction();
  });
});
