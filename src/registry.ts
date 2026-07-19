import type { RegistryEntry } from "./types";

/**
 * The single, module-level registry of resettable stores.
 *
 * NOTE: if two copies of this package end up in the same bundle, there will be
 * two registries and `resetAllStores()` will only reset half the stores. See
 * the "Caveats" section of the README.
 */
const registry = new Map<string, RegistryEntry>();

// Local, dependency-free declaration so we don't pull in `@types/node`.
// Bundlers (Vite/webpack) statically replace `process.env.NODE_ENV`.
declare const process:
  | { env: { NODE_ENV?: string } }
  | undefined;

function isDev(): boolean {
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
  return registry.delete(name);
}

/** @internal */
export function getEntry(name: string): RegistryEntry | undefined {
  return registry.get(name);
}

/** @internal */
export function getAllEntries(): RegistryEntry[] {
  return Array.from(registry.values());
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
  return Array.from(registry.keys());
}
