import { isDev } from "./registry";
import type { RegistryEntry } from "./types";

/**
 * Order a batch of registry entries into topological LEVELS based on their
 * `dependsOn` declarations. A declaration `dependsOn: ["a"]` on entry `b` means
 * "reset a before b", i.e. an edge `a -> b` that places `a` in an earlier level.
 *
 * Each returned level is a set of stores with no remaining dependency on one
 * another, so a caller may reset the stores within a level in parallel and the
 * levels themselves in sequence.
 *
 * Rules:
 * - A dependency naming a store that is not part of `entries` (a different
 *   group, or simply not registered) is ignored - a soft edge. Only in-batch
 *   dependencies constrain the order.
 * - A self-dependency is ignored.
 * - A dependency cycle cannot be ordered: it emits a dev-only warning (matching
 *   registry.ts) and falls back to registration order (one store per level, in
 *   the order the entries were given).
 *
 * Order within a level, and the fallback order, follow the input order, which
 * the registry hands out in registration order.
 */
export function orderEntriesByDependencies(
  entries: readonly RegistryEntry[],
): RegistryEntry[][] {
  const indexOf = new Map<string, number>();
  entries.forEach((entry, index) => indexOf.set(entry.name, index));

  const inBatch = (name: string): boolean => indexOf.has(name);
  const byRegistrationOrder = (a: RegistryEntry, b: RegistryEntry): number =>
    (indexOf.get(a.name) ?? 0) - (indexOf.get(b.name) ?? 0);

  // indegree[entry] = number of in-batch stores this entry depends on.
  // dependents[dep] = entries that depend on `dep` (the edges dep -> entry).
  const indegree = new Map<string, number>();
  const dependents = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    indegree.set(entry.name, 0);
  }
  for (const entry of entries) {
    for (const dep of entry.dependsOn ?? []) {
      if (dep === entry.name || !inBatch(dep)) {
        continue;
      }
      indegree.set(entry.name, (indegree.get(entry.name) ?? 0) + 1);
      const list = dependents.get(dep);
      if (list) {
        list.push(entry);
      } else {
        dependents.set(dep, [entry]);
      }
    }
  }

  const levels: RegistryEntry[][] = [];
  let frontier = entries.filter((entry) => indegree.get(entry.name) === 0);
  let emitted = 0;
  while (frontier.length > 0) {
    frontier.sort(byRegistrationOrder);
    levels.push(frontier);
    emitted += frontier.length;
    const next: RegistryEntry[] = [];
    for (const entry of frontier) {
      for (const dependent of dependents.get(entry.name) ?? []) {
        const remaining = (indegree.get(dependent.name) ?? 0) - 1;
        indegree.set(dependent.name, remaining);
        if (remaining === 0) {
          next.push(dependent);
        }
      }
    }
    frontier = next;
  }

  if (emitted !== entries.length) {
    if (isDev()) {
      console.warn(
        "[zustand-reset-manager] A dependency cycle was detected among the " +
          "stores being reset. Falling back to registration order - check the " +
          "`dependsOn` declarations of the stores in this batch.",
      );
    }
    return entries.map((entry) => [entry]);
  }

  return levels;
}
