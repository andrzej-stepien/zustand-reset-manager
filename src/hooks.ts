import type { ResetListener, ResetListenerContext } from "./types";

/**
 * Global reset listeners. Like the store registry (see registry.ts), the set is
 * kept on `globalThis` under a well-known `Symbol.for` key so that two copies of
 * this package (micro-frontends, a duplicated install) share ONE listener set -
 * a `beforeReset`/`afterReset` hook then fires no matter which copy triggered
 * the reset.
 */
const LISTENERS_KEY = Symbol.for("zustand-reset-manager/reset-listeners");

type ListenerHost = Record<symbol, Set<ResetListener> | undefined>;

function getListeners(): Set<ResetListener> {
  const host = globalThis as unknown as ListenerHost;
  let listeners = host[LISTENERS_KEY];
  if (!listeners) {
    listeners = new Set<ResetListener>();
    host[LISTENERS_KEY] = listeners;
  }
  return listeners;
}

/**
 * Register a global reset listener. The returned function unsubscribes it and is
 * safe to call more than once (subsequent calls are a no-op).
 *
 * ```ts
 * const unsubscribe = addResetListener({
 *   beforeReset: ({ name, reason }) => console.log("resetting", name, reason),
 *   afterReset: ({ name }) => console.log("done", name),
 * });
 * // later
 * unsubscribe();
 * ```
 *
 * Listeners observe every store reset triggered through `resetStore`,
 * `resetStores`, and `resetAllStores`. Exceptions thrown from a listener are
 * caught and logged (`console.error`), so a misbehaving listener can never
 * interrupt the reset itself or any other listener.
 */
export function addResetListener(listener: ResetListener): () => void {
  const listeners = getListeners();
  listeners.add(listener);
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    listeners.delete(listener);
  };
}

function runListeners(
  phase: "beforeReset" | "afterReset",
  context: ResetListenerContext,
): void {
  // Iterate over a snapshot so a listener that (un)subscribes during the call
  // does not disturb the current pass.
  for (const listener of Array.from(getListeners())) {
    const callback = listener[phase];
    if (!callback) {
      continue;
    }
    try {
      callback(context);
    } catch (error) {
      console.error(
        `[zustand-reset-manager] A ${phase} listener threw and was ignored:`,
        error,
      );
    }
  }
}

/** @internal Fire every registered `beforeReset` hook. */
export function fireBeforeReset(context: ResetListenerContext): void {
  runListeners("beforeReset", context);
}

/** @internal Fire every registered `afterReset` hook. */
export function fireAfterReset(context: ResetListenerContext): void {
  runListeners("afterReset", context);
}
