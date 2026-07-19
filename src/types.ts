import type { StateCreator, StoreApi } from "zustand/vanilla";

/**
 * Configuration object accepted as the first argument of
 * `createResettableStore` / `createResettableVanillaStore`.
 */
export interface ResettableStoreConfig {
  /** Unique name used to address the store in the registry. */
  name: string;
  /** Optional group used by `resetStores(group)`. */
  group?: string;
}

/** A plain Zustand initializer: `(set, get, api) => State`. */
export type Initializer<T> = StateCreator<T, [], []>;

/**
 * An entry stored in the global registry. The `reset` closure captures the
 * store's api + initializer so the reset APIs stay decoupled from Zustand.
 */
export interface RegistryEntry {
  name: string;
  group?: string;
  reset: () => void;
}

export type { StateCreator, StoreApi };
