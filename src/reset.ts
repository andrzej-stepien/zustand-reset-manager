import { getAllEntries, getEntry, getGroupEntries } from "./registry";
import type { Initializer, StoreApi } from "./types";

/**
 * Build the reset closure for a store. Reset works by RE-RUNNING the original
 * initializer against the live store api and replacing the whole state
 * (`setState(fresh, true)`).
 *
 * Re-running (instead of caching the first initial object) means dynamic values
 * such as `crypto.randomUUID()` are regenerated on every reset. It also means
 * action functions are recreated: after a reset they are NEW references (see
 * the README "Caveats"). They keep working because they close over the same
 * stable `api.setState` / `api.getState`.
 */
export function createResetFn<T>(
  api: StoreApi<T>,
  initializer: Initializer<T>,
): () => void {
  return () => {
    const fresh = initializer(
      api.setState as StoreApi<T>["setState"],
      api.getState,
      api,
    );
    // `replace: true` requires the FULL next state - which is exactly what the
    // initializer returns. This is the v4/v5-compatible way to fully reset.
    (api.setState as (state: T, replace: true) => void)(fresh, true);
  };
}

/** Reset a single store to a freshly-initialized state. */
export function resetStore(name: string): void {
  const entry = getEntry(name);
  if (!entry) {
    console.warn(
      `[zustand-reset-manager] resetStore("${name}"): no store registered ` +
        `under that name.`,
    );
    return;
  }
  entry.reset();
}

/** Reset every store that was registered with the given `group`. */
export function resetStores(group: string): void {
  const entries = getGroupEntries(group);
  if (entries.length === 0) {
    console.warn(
      `[zustand-reset-manager] resetStores("${group}"): no stores registered ` +
        `in that group.`,
    );
    return;
  }
  for (const entry of entries) {
    entry.reset();
  }
}

/** Reset every registered store. The classic "reset everything on logout". */
export function resetAllStores(): void {
  for (const entry of getAllEntries()) {
    entry.reset();
  }
}
