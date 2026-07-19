import { resetAllStores } from "./reset";

/**
 * Reset every registered store. Intended for use between tests so state does
 * not leak across test cases:
 *
 * ```ts
 * import { resetAllStoresForTesting } from "zustand-reset-manager/testing";
 *
 * afterEach(() => {
 *   resetAllStoresForTesting();
 * });
 * ```
 *
 * This is the exact same operation as `resetAllStores()` from the main entry -
 * it exists as a dedicated, clearly-named export for the test use case.
 */
export function resetAllStoresForTesting(): void {
  resetAllStores();
}

// Also re-exported under its canonical name for convenience.
export { resetAllStores } from "./reset";
