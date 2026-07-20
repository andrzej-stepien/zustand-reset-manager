import { createStore } from "zustand/vanilla";
import type {
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from "zustand/vanilla";
import { normalizeConfig, register } from "./register";
import type { Initializer, ResettableStoreConfig } from "./types";

/**
 * Create a registered, resettable **vanilla** store. Signature-compatible with
 * Zustand's `createStore`, including middleware mutators: creators wrapped in
 * `persist`, `devtools`, or `immer` type through without casts, mirroring the
 * overloads of the official `createStore`.
 *
 * Curried form (for explicit state typing, keeps mutator inference):
 * `createResettableVanillaStore<State>("session")(persist(init, opts))`.
 */
export function createResettableVanillaStore<
  T,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer: StateCreator<T, [], Mos>,
): Mutate<StoreApi<T>, Mos>;
export function createResettableVanillaStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
  initializer: StateCreator<T, [], Mos>,
) => Mutate<StoreApi<T>, Mos>;
export function createResettableVanillaStore(
  nameOrConfig: string | ResettableStoreConfig,
  initializer?: StateCreator<unknown, [], []>,
): unknown {
  const config = normalizeConfig(nameOrConfig);

  const build = (init: StateCreator<unknown, [], []>): StoreApi<unknown> => {
    const store = createStore(init);
    register(config, store, init as Initializer<unknown>);
    return store;
  };

  return initializer === undefined ? build : build(initializer);
}
