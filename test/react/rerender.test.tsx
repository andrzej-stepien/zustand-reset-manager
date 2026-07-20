import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import {
  createResettableStore,
  getRegisteredStoreNames,
  resetAllStores,
  resetStore,
  unregisterStore,
} from "../../src/index";

afterEach(() => {
  cleanup();
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

/** An asynchronous fake `StateStorage` (Promise-returning), pre-seedable. */
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

describe("React re-render on reset", () => {
  it("re-renders a component with fresh state after resetStore", () => {
    const useCart = createResettableStore<CartState>("cart")((set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
    }));

    function CartView() {
      const count = useCart((s) => s.items.length);
      const add = useCart((s) => s.add);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button type="button" onClick={() => add("apple")}>
            add
          </button>
        </div>
      );
    }

    render(<CartView />);
    expect(screen.getByTestId("count").textContent).toBe("0");

    // Dirty the state through a real DOM event (fireEvent wraps in act()).
    fireEvent.click(screen.getByText("add"));
    fireEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("count").textContent).toBe("2");

    // Reset is a plain setState outside of React's event loop -> wrap in act().
    act(() => {
      resetStore("cart");
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("re-renders via resetAllStores as well", () => {
    const useCart = createResettableStore<CartState>("cart")((set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
    }));

    function CartView() {
      const count = useCart((s) => s.items.length);
      return <span data-testid="count">{count}</span>;
    }

    render(<CartView />);
    act(() => {
      useCart.getState().add("apple");
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    act(() => {
      resetAllStores();
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("lets post-reset actions work from the component (fresh action refs)", () => {
    const useCart = createResettableStore<CartState>("cart")((set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
    }));

    function CartView() {
      const items = useCart((s) => s.items);
      const add = useCart((s) => s.add);
      return (
        <div>
          <span data-testid="items">{items.join(",")}</span>
          <button type="button" onClick={() => add("apple")}>
            add
          </button>
        </div>
      );
    }

    render(<CartView />);
    fireEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("items").textContent).toBe("apple");

    // Reset installs a fresh action closure (re-run initializer for a plain
    // store). The hook selector re-subscribes to the new `add` reference.
    act(() => {
      resetStore("cart");
    });
    expect(screen.getByTestId("items").textContent).toBe("");

    // Clicking now invokes the NEW action reference; it must still mutate the
    // live store and re-render the component.
    fireEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("items").textContent).toBe("apple");
  });

  it("shows fresh state after a reset that self-heals a late rehydration", async () => {
    const storage = createAsyncStorage();
    // Pre-seed storage so the in-flight rehydration would restore stale items.
    storage.map.set(
      "cart-rehydrate",
      JSON.stringify({ state: { items: ["stale"] }, version: 0 }),
    );

    const useCart = createResettableStore<CartState>("cart")(
      persist(
        (set) => ({
          items: [],
          add: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        {
          name: "cart-rehydrate",
          storage: createJSONStorage(() => storage),
        },
      ),
    );

    // Async hydration is still pending right after creation.
    expect(useCart.persist.hasHydrated()).toBe(false);

    function CartView() {
      const items = useCart((s) => s.items);
      return <span data-testid="items">{items.join(",")}</span>;
    }

    render(<CartView />);
    expect(screen.getByTestId("items").textContent).toBe("");

    // Reset while rehydration is in flight (applies immediately + self-heals).
    await act(async () => {
      await resetStore<CartState>("cart", { clearPersistedState: true });
    });
    expect(screen.getByTestId("items").textContent).toBe("");

    // Let the in-flight (stale) rehydration land; the one-shot finish-hydration
    // listener must re-apply the reset so the component never shows "stale".
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(useCart.persist.hasHydrated()).toBe(true);
    expect(screen.getByTestId("items").textContent).toBe("");
  });
});
