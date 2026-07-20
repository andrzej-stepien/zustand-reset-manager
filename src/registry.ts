import type { RegistryEntry } from "./types";

/**
 * The registry is stored on `globalThis` under a well-known `Symbol.for` key so
 * that two copies of this package (micro-frontends, or a duplicated install in
 * `node_modules`) share ONE registry - `resetAllStores()` then reaches every
 * store, no matter which copy registered it. `Symbol.for` returns the same
 * symbol for the same key across module realms, which is exactly what we want.
 */
const REGISTRY_KEY = Symbol.for("zustand-reset-manager/registry");

type RegistryHost = Record<symbol, Map<string, RegistryEntry> | undefined>;

function getRegistry(): Map<string, RegistryEntry> {
  const host = globalThis as unknown as RegistryHost;
  let registry = host[REGISTRY_KEY];
  if (!registry) {
    registry = new Map<string, RegistryEntry>();
    host[REGISTRY_KEY] = registry;
  }
  return registry;
}

// Local, dependency-free declaration so we don't pull in `@types/node`.
// Bundlers (Vite/webpack) statically replace `process.env.NODE_ENV`.
declare const process:
  | { env: { NODE_ENV?: string } }
  | undefined;

/** @internal Shared dev-only guard so warnings stay out of production logs. */
export function isDev(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Register (or, on a duplicate name, overwrite) a store.
 *
 * Re-registering the same name is expected under HMR (Vite/webpack re-run the
 * module on hot reload), so this never throws. It overwrites the previous
 * entry and warns - but only in development, to keep production logs clean.
 */
export function registerEntry(entry: RegistryEntry): void {
  const registry = getRegistry();
  if (registry.has(entry.name) && isDev()) {
    console.warn(
      `[zustand-reset-manager] A store named "${entry.name}" is already ` +
        `registered. Overwriting the previous registration. If this is not a ` +
        `hot-reload, use a unique name per store.`,
    );
  }
  registry.set(entry.name, entry);
}

/**
 * Remove a store from the registry. Call this for dynamically created stores
 * (per-view, per-dialog) to avoid leaking references - the registry is the
 * sole owner of the store reference in typical usage.
 *
 * @returns `true` if a store was removed, `false` if the name was unknown.
 */
export function unregisterStore(name: string): boolean {
  return getRegistry().delete(name);
}

/** @internal */
export function getEntry(name: string): RegistryEntry | undefined {
  return getRegistry().get(name);
}

/** @internal */
export function getAllEntries(): RegistryEntry[] {
  return Array.from(getRegistry().values());
}

/** @internal */
export function getGroupEntries(group: string): RegistryEntry[] {
  return getAllEntries().filter((entry) => entry.group === group);
}

/**
 * List the names of every currently registered store. Handy for debugging and
 * for asserting registry hygiene in tests.
 */
export function getRegisteredStoreNames(): string[] {
  return Array.from(getRegistry().keys());
}
