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
  /**
   * Names of other stores that must be reset BEFORE this one during a bulk
   * reset (`resetStores` / `resetAllStores`). The reset APIs topologically sort
   * the batch so every dependency runs first.
   *
   * - A dependency on a store that is not part of the current batch (a different
   *   group, or not registered at all) is ignored (soft edge).
   * - A dependency cycle triggers a dev-only warning and a fallback to
   *   registration order.
   *
   * Has no effect on a single-store `resetStore(name)` call.
   */
  dependsOn?: readonly string[];
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
  /**
   * Free-form label describing why the reset is happening (e.g. `"logout"`,
   * `"tenant-switch"`, `"test"`). It does not affect the reset itself; it is
   * forwarded verbatim to every registered reset listener's context so hooks
   * can branch on the cause.
   */
  reason?: string;
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
  dependsOn?: readonly string[];
  reset: (options?: InternalResetOptions) => void | Promise<void>;
}

/**
 * Context object handed to every reset listener callback. `reason` is whatever
 * was passed in `ResetOptions.reason` (or `undefined` for an option-less reset).
 */
export interface ResetListenerContext {
  /** The store's registry name. */
  name: string;
  /** The store's group, if it was registered with one. */
  group?: string;
  /** The `reason` from the triggering reset call, if any. */
  reason?: string;
}

/**
 * A global reset listener. Register it with `addResetListener` to observe every
 * store reset triggered through `resetStore` / `resetStores` / `resetAllStores`.
 *
 * - `beforeReset` fires right before a store is reset.
 * - `afterReset` fires right after; for async resets it fires once the reset has
 *   settled.
 *
 * Exceptions thrown from a listener are caught and logged; they never interrupt
 * the reset or other listeners.
 */
export interface ResetListener {
  beforeReset?: (context: ResetListenerContext) => void;
  afterReset?: (context: ResetListenerContext) => void;
}

export type { StateCreator, StoreApi };
