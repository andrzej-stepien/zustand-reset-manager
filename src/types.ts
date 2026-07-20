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

/**
 * A plain Zustand initializer: `(set, get, api) => State`. Used internally for
 * the reset closure - the public `createResettable*` overloads keep the full
 * mutator-aware `StateCreator<T, [], Mos>` signature.
 */
export type Initializer<T> = StateCreator<T, [], []>;

/**
 * Options accepted by `resetStore` / `resetStores` / `resetAllStores`.
 *
 * When any options object is passed, the reset call returns a `Promise<void>`
 * so persist-related work (waiting for rehydration, clearing storage) can be
 * awaited. Called with no options at all, the reset functions stay synchronous
 * and return `void` (the 0.1 behavior).
 *
 * @typeParam T - the store's state shape; makes `preserve` type-safe as
 *   `(keyof T)[]`. Defaults to `Record<string, unknown>` (so `preserve` accepts
 *   any string key) because reset functions address a store by its string name
 *   and cannot infer `T`. Pass it explicitly for key-checking:
 *   `resetStore<PrefsState>("preferences", { preserve: ["theme"] })`.
 */
export interface ResetOptions<T = Record<string, unknown>> {
  /**
   * Also clear the persisted state in the store's storage (only affects stores
   * created with the `persist` middleware). The in-memory state is reset
   * regardless; this additionally calls `store.persist.clearStorage()`.
   */
  clearPersistedState?: boolean;
  /**
   * Keys whose CURRENT value should survive the reset. Every other key is
   * restored to the initializer's value. Handy for keeping UI preferences
   * (`preserve: ["theme", "language"]`) across a logout reset.
   */
  preserve?: readonly (keyof T)[];
}

/**
 * The loosely-typed shape actually handed to a registry entry's reset closure.
 * `preserve` is erased to plain property keys because the closure does not know
 * the concrete state type at runtime.
 *
 * @internal
 */
export type InternalResetOptions = ResetOptions<Record<PropertyKey, unknown>>;

/**
 * An entry stored in the global registry. The `reset` closure captures the
 * store's api + initializer so the reset APIs stay decoupled from Zustand.
 */
export interface RegistryEntry {
  name: string;
  group?: string;
  reset: (options?: InternalResetOptions) => void | Promise<void>;
}

export type { StateCreator, StoreApi };
