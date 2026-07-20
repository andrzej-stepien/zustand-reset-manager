/**
 * `zustand-reset-manager/vanilla` - the vanilla-only entry.
 *
 * This entry imports `zustand/vanilla` exclusively, so it never pulls in the
 * React entry of Zustand (and, transitively, React). Use it in non-React code
 * (Node services, workers, framework-agnostic packages). It shares the exact
 * same global registry as the main entry, so `resetAllStores()` from either
 * entry resets every store.
 */

export { createResettableVanillaStore } from "./createResettableVanillaStore";

export { resetStore, resetStores, resetAllStores } from "./reset";

export { unregisterStore, getRegisteredStoreNames } from "./registry";

export type {
  ResettableStoreConfig,
  ResetOptions,
  Initializer,
  StateCreator,
  StoreApi,
} from "./types";
