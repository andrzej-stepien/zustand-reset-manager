import { registerEntry } from "./registry";
import { createResetFn } from "./reset";
import type { Initializer, ResettableStoreConfig, StoreApi } from "./types";

/**
 * Shared, Zustand-free helpers used by both store creators. Keeping these out of
 * the creator files means the `zustand-reset-manager/vanilla` entry never pulls
 * in the React entry of Zustand.
 */

export function normalizeConfig(
  nameOrConfig: string | ResettableStoreConfig,
): ResettableStoreConfig {
  return typeof nameOrConfig === "string"
    ? { name: nameOrConfig }
    : nameOrConfig;
}

export function register<T>(
  config: ResettableStoreConfig,
  api: StoreApi<T>,
  initializer: Initializer<T>,
): void {
  registerEntry({
    name: config.name,
    group: config.group,
    dependsOn: config.dependsOn,
    reset: createResetFn(api, initializer),
  });
}
