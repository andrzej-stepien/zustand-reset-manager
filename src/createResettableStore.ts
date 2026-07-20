import { create } from "zustand";
import type {
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
  UseBoundStore,
} from "zustand";
import { normalizeConfig, register } from "./register";
import type { Initializer, ResettableStoreConfig } from "./types";

/**
 * Create a registered, resettable **React** store. Signature-compatible with
 * Zustand's `create`, including middleware mutators: creators wrapped in
 * `persist`, `devtools`, or `immer` type through without casts, mirroring the
 * overloads of the official `create`.
 *
 * Inferred form: `createResettableStore("user", (set) => ({ ... }))`.
 *
 * Curried form (for explicit state typing, keeps mutator inference like
 * Zustand's `create<T>()(...)`):
 * `createResettableStore<State>("user")(persist(init, opts))`.
 */
export function createResettableStore<
  T,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(
  nameOrConfig: string | ResettableStoreConfig,
  initializer: StateCreator<T, [], Mos>,
): UseBoundStore<Mutate<StoreApi<T>, Mos>>;
export function createResettableStore<T>(
  nameOrConfig: string | ResettableStoreConfig,
): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
  initializer: StateCreator<T, [], Mos>,
) => UseBoundStore<Mutate<StoreApi<T>, Mos>>;
export function createResettableStore(
  nameOrConfig: string | ResettableStoreConfig,
  initializer?: StateCreator<unknown, [], []>,
): unknown {
  const config = normalizeConfig(nameOrConfig);

  const build = (
    init: StateCreator<unknown, [], []>,
  ): UseBoundStore<StoreApi<unknown>> => {
    const useBoundStore = create(init);
    register(config, useBoundStore as StoreApi<unknown>, init as Initializer<unknown>);
    return useBoundStore;
  };

  return initializer === undefined ? build : build(initializer);
}
