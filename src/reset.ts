import { getAllEntries, getEntry, getGroupEntries, isDev } from "./registry";
import type {
  Initializer,
  InternalResetOptions,
  ResetOptions,
  StoreApi,
} from "./types";

/**
 * The subset of the `persist` middleware's `store.persist` API that we use.
 * Detected by feature-detection so we never import from `zustand/middleware`
 * at runtime (keeping this a zero-dependency package).
 */
interface PersistApiLike {
  clearStorage: () => void | Promise<void>;
  hasHydrated: () => boolean;
  onFinishHydration: (fn: (state: unknown) => void) => () => void;
}

/**
 * Feature-detect the `persist` middleware on a store api. A persisted store
 * exposes `api.persist` with the methods below; a plain store does not.
 */
function getPersistApi(api: unknown): PersistApiLike | undefined {
  // A React bound store is a FUNCTION (the hook) with the store api assigned as
  // properties; a vanilla store is a plain object. Accept both.
  if (
    api === null ||
    (typeof api !== "object" && typeof api !== "function") ||
    !("persist" in api)
  ) {
    return undefined;
  }
  const persist = (api as { persist?: unknown }).persist;
  if (
    persist !== null &&
    typeof persist === "object" &&
    typeof (persist as { clearStorage?: unknown }).clearStorage === "function" &&
    typeof (persist as { hasHydrated?: unknown }).hasHydrated === "function" &&
    typeof (persist as { onFinishHydration?: unknown }).onFinishHydration ===
      "function"
  ) {
    return persist as PersistApiLike;
  }
  return undefined;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Compute the fresh state to reset TO.
 *
 * - Plain stores: RE-RUN the initializer against the live api so dynamic values
 *   (`crypto.randomUUID()`, `Date.now()`) are regenerated and the fresh action
 *   closures bind to the live `set`/`get`.
 * - Persisted stores: re-running would re-trigger the persist middleware
 *   (reading old storage, double-wrapping `setState`), so we instead use the
 *   initial state the store captured at creation via `getInitialState()`. Its
 *   action closures already point at the live store, so they keep working.
 */
function computeFreshState<T>(
  api: StoreApi<T>,
  initializer: Initializer<T>,
  hasPersist: boolean,
): T {
  if (hasPersist) {
    const getInitialState = (api as StoreApi<T>).getInitialState;
    if (typeof getInitialState === "function") {
      // Shallow clone so every reset produces a new top-level object (the
      // persist `setItem` fires on a real state change) without mutating the
      // captured initial state.
      return { ...(getInitialState() as Record<string, unknown>) } as T;
    }
    // zustand <4.5: the store api has no `getInitialState`, so the only option
    // left is the initializer re-run below - which may re-trigger hydration.
    if (isDev()) {
      console.warn(
        "[zustand-reset-manager] Resetting a persisted store requires " +
          "zustand >=4.5 (store api has no getInitialState). Falling back " +
          "to re-running the initializer, which may restore stale state " +
          "from storage.",
      );
    }
  }
  return initializer(api.setState as StoreApi<T>["setState"], api.getState, api);
}

function applyPreserve<T>(
  api: StoreApi<T>,
  fresh: T,
  preserve: readonly PropertyKey[] | undefined,
): T {
  if (!preserve || preserve.length === 0) {
    return fresh;
  }
  const current = api.getState() as Record<PropertyKey, unknown>;
  const merged = { ...(fresh as Record<PropertyKey, unknown>) };
  for (const key of preserve) {
    if (key in current) {
      merged[key] = current[key];
    }
  }
  return merged as T;
}

/**
 * Build the reset closure for a store. Handles plain stores (0.1 behavior) and
 * persisted stores (waits for in-flight rehydration, optionally clears storage).
 */
export function createResetFn<T>(
  api: StoreApi<T>,
  initializer: Initializer<T>,
): (options?: InternalResetOptions) => void | Promise<void> {
  return (options) => {
    const persist = getPersistApi(api);

    const performReset = (): void | Promise<void> => {
      const fresh = applyPreserve(
        api,
        computeFreshState(api, initializer, persist !== undefined),
        options?.preserve,
      );
      // `replace: true` requires the FULL next state - which is what the
      // initializer / captured initial state provides. For persisted stores
      // this `setState` also re-persists the fresh state (overwriting storage).
      (api.setState as (state: T, replace: true) => void)(fresh, true);

      if (options?.clearPersistedState && persist) {
        const cleared = persist.clearStorage();
        if (isThenable(cleared)) {
          return cleared.then(() => undefined);
        }
      }
      return undefined;
    };

    // If a persisted store is still doing its initial (async) rehydration, wait
    // for it to finish first - otherwise the in-flight rehydration would land
    // AFTER our reset and overwrite the fresh state we just set.
    if (persist && persist.hasHydrated() === false) {
      return new Promise<void>((resolve, reject) => {
        const unsubscribe = persist.onFinishHydration(() => {
          unsubscribe();
          try {
            const result = performReset();
            if (isThenable(result)) {
              result.then(() => resolve(), reject);
            } else {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    return performReset();
  };
}

/* -------------------------------------------------------------------------- */
/*  Public reset API                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reset a single store to a freshly-initialized state.
 *
 * Called with no options it is synchronous and returns `void`. Called with an
 * options object (`clearPersistedState`, `preserve`) it returns a `Promise<void>`
 * that resolves once the (possibly persist-related, possibly async) work is done.
 */
export function resetStore(name: string): void;
export function resetStore<T = Record<string, unknown>>(
  name: string,
  options: ResetOptions<T>,
): Promise<void>;
export function resetStore<T = Record<string, unknown>>(
  name: string,
  options?: ResetOptions<T>,
): void | Promise<void> {
  const entry = getEntry(name);
  if (!entry) {
    console.warn(
      `[zustand-reset-manager] resetStore("${name}"): no store registered ` +
        `under that name.`,
    );
    return options ? Promise.resolve() : undefined;
  }
  const result = entry.reset(options as InternalResetOptions | undefined);
  if (options) {
    return Promise.resolve(result).then(() => undefined);
  }
  return result as void;
}

/** Reset every store that was registered with the given `group`. */
export function resetStores(group: string): void;
export function resetStores<T = Record<string, unknown>>(
  group: string,
  options: ResetOptions<T>,
): Promise<void>;
export function resetStores<T = Record<string, unknown>>(
  group: string,
  options?: ResetOptions<T>,
): void | Promise<void> {
  const entries = getGroupEntries(group);
  if (entries.length === 0) {
    console.warn(
      `[zustand-reset-manager] resetStores("${group}"): no stores registered ` +
        `in that group.`,
    );
    return options ? Promise.resolve() : undefined;
  }
  if (options) {
    return Promise.all(
      entries.map((entry) =>
        Promise.resolve(entry.reset(options as InternalResetOptions)),
      ),
    ).then(() => undefined);
  }
  for (const entry of entries) {
    entry.reset();
  }
  return undefined;
}

/** Reset every registered store. The classic "reset everything on logout". */
export function resetAllStores(): void;
export function resetAllStores<T = Record<string, unknown>>(
  options: ResetOptions<T>,
): Promise<void>;
export function resetAllStores<T = Record<string, unknown>>(
  options?: ResetOptions<T>,
): void | Promise<void> {
  const entries = getAllEntries();
  if (options) {
    return Promise.all(
      entries.map((entry) =>
        Promise.resolve(entry.reset(options as InternalResetOptions)),
      ),
    ).then(() => undefined);
  }
  for (const entry of entries) {
    entry.reset();
  }
  return undefined;
}
