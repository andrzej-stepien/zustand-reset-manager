import { create } from "zustand";
import type { UseBoundStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { registerEntry } from "./registry";
import { createResetFn } from "./reset";
import type { Initializer, ResettableStoreConfig, StoreApi } from "./types";

function normalizeConfig(
  nameOrConfig: string | ResettableStoreConfig,
): ResettableStoreConfig {
  return typeof nameOrConfig === "string"
    ? { name: nameOrConfig }
    : nameOrConfig;
}

function register<T>(
  config: ResettableStoreConfig,
  api: StoreApi<T>,
  initializer: Initializer<T>,
): void {
  registerEntry({
    name: config.name,
    group: config.group,
    reset: createResetFn(api, initializer),
  });
}

/* -------------------------------------------------------------------------- */
/*  React store (wraps `create` from "zustand")                               */
/* -------------------------------------------------------------------------- */

/**
 * Create a registered, resettable **React** store. Signature-compatible with
 * Zustand's `create`: the initializer keeps its full `(set, get, api) => state`
 * shape, so existing stores migrate by wrapping without rewriting.
 *
 * Curried form (for explicit state typing):
 * `createResettableStore<State>("user")((set) => ({ ... }))`.
 */
export function createResettableStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
): (initializer: Initializer<T>) => UseBoundStore<StoreApi<T>>;
/**
 * Inferred form: `createResettableStore("user", (set) => ({ ... }))`.
 */
export function createResettableStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer: Initializer<T>,
): UseBoundStore<StoreApi<T>>;
export function createResettableStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer?: Initializer<T>,
):
  | UseBoundStore<StoreApi<T>>
  | ((initializer: Initializer<T>) => UseBoundStore<StoreApi<T>>) {
  const config = normalizeConfig(nameOrConfig);

  const build = (init: Initializer<T>): UseBoundStore<StoreApi<T>> => {
    const useBoundStore = create<T>()(init);
    register(config, useBoundStore as unknown as StoreApi<T>, init);
    return useBoundStore;
  };

  return initializer === undefined ? build : build(initializer);
}

/* -------------------------------------------------------------------------- */
/*  Vanilla store (wraps `createStore` from "zustand/vanilla")                */
/* -------------------------------------------------------------------------- */

/**
 * Create a registered, resettable **vanilla** store. Signature-compatible with
 * Zustand's `createStore`. Use this outside React.
 */
export function createResettableVanillaStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
): (initializer: Initializer<T>) => StoreApi<T>;
export function createResettableVanillaStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer: Initializer<T>,
): StoreApi<T>;
export function createResettableVanillaStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer?: Initializer<T>,
): StoreApi<T> | ((initializer: Initializer<T>) => StoreApi<T>) {
  const config = normalizeConfig(nameOrConfig);

  const build = (init: Initializer<T>): StoreApi<T> => {
    const store = createStore<T>()(init);
    register(config, store, init);
    return store;
  };

  return initializer === undefined ? build : build(initializer);
}
