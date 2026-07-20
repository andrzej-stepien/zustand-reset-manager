# zustand-reset-manager

Central, type-safe reset for many [Zustand](https://github.com/pmndrs/zustand)
stores at once - reset **one** store, a **group**, or **all** of them with a
single call. Works with React (`create`) and vanilla (`createStore`), Zustand
v4 and v5.

- **Zero runtime dependencies.** `zustand` is the only (peer) dependency.
- **Factory reset.** Your initializer is re-run on reset, so dynamic values
  such as `crypto.randomUUID()` are regenerated - not frozen at first render.
- **Full Zustand signature.** The initializer keeps its exact
  `(set, get, api) => state` shape - including middleware. Creators wrapped in
  `persist`, `devtools`, or `immer` type through without casts.
- **`persist`-aware.** Reset can clear the persisted storage, and an in-flight
  rehydration never clobbers it - if one lands after the reset, the reset is
  re-applied on top (without ever blocking on a broken storage).
- **`preserve` selected fields.** Keep a few keys (theme, language) while
  resetting everything else.
- **HMR-safe and bundle-safe.** Re-registering the same name (Vite/webpack hot
  reload) never throws, and the registry lives on `globalThis` so duplicate
  copies of the package still share one registry.

## The problem

Zustand documents how to reset a single store, but real apps hit friction the
moment they have 20 of them: "reset everything on logout", "reset state between
tests", getting TypeScript inference right, and deciding what the correct
initial state even *is* when it contains dynamic values. `zustand-reset-manager`
gives you a tiny registry and three reset functions that solve exactly that.

## Installation

```bash
npm install zustand-reset-manager zustand
```

`zustand` is a peer dependency (`>=4`).

## Quick start

```ts
import { createResettableStore, resetAllStores } from "zustand-reset-manager";

// Same signature as Zustand's `create` - just add a name.
const useUserStore = createResettableStore("user", (set) => ({
  user: null as string | null,
  setUser: (user: string) => set({ user }),
}));

// ...use it exactly like a normal Zustand store:
useUserStore.getState().setUser("ada");

// On logout, reset everything you registered:
resetAllStores();
```

### Groups

```ts
const useSessionStore = createResettableStore(
  { name: "session", group: "session" },
  (set) => ({ token: null, /* ... */ }),
);

const useTenantStore = createResettableStore(
  { name: "employee", group: "tenant" },
  (set) => ({ employees: [], /* ... */ }),
);

resetStores("session"); // reset every store in the "session" group
resetStores("tenant");
```

### Explicit typing (curried form)

Mirrors Zustand's `create<T>()(...)` when you want to type the state with an
interface instead of inferring it:

```ts
interface UserState {
  user: string | null;
  setUser: (user: string) => void;
}

const useUserStore = createResettableStore<UserState>("user")((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

### Vanilla (outside React)

```ts
import { createResettableVanillaStore } from "zustand-reset-manager";

const sessionStore = createResettableVanillaStore("session", (set) => ({
  token: null as string | null,
  setToken: (token: string) => set({ token }),
}));
```

Prefer the `zustand-reset-manager/vanilla` subpath in non-React code. It imports
only `zustand/vanilla`, so it never pulls in the React entry of Zustand (nor,
transitively, React):

```ts
import {
  createResettableVanillaStore,
  resetAllStores,
} from "zustand-reset-manager/vanilla";
```

Both entries share the exact same global registry, so `resetAllStores()` from
either one resets every store.

### `persist`: reset on logout, clear storage

Stores created with the `persist` middleware are detected automatically (no
extra imports, no config). Pass an options object to opt into the async,
persist-aware behavior - these calls return a `Promise` you can await:

```ts
import { persist, createJSONStorage } from "zustand/middleware";
import { createResettableStore, resetAllStores } from "zustand-reset-manager";

// Curried form keeps middleware inference with an explicit state type.
const useCartStore = createResettableStore<CartState>("cart")(
  persist(
    (set) => ({
      items: [] as string[],
      add: (item: string) => set((s) => ({ items: [...s.items, item] })),
    }),
    { name: "cart", storage: createJSONStorage(() => localStorage) },
  ),
);

// On logout: reset in-memory state AND wipe the persisted copies from storage.
async function logout() {
  await resetAllStores({ clearPersistedState: true });
}
```

- Without `clearPersistedState`, the in-memory state is still reset; the reset's
  own write overwrites the persisted value with the fresh initial state.
- With `clearPersistedState: true`, `store.persist.clearStorage()` is also called
  so the storage entry is removed entirely.
- If a store is still doing its initial (async) rehydration when you reset, the
  reset applies immediately and self-heals: if the in-flight rehydration lands
  afterwards (with state read from before the reset), a one-shot
  `onFinishHydration` listener re-applies the reset over it in the same tick.
  The reset deliberately does NOT wait for rehydration - when the storage read
  fails, persist swallows the error without notifying finish-hydration
  listeners, so waiting could hang forever (e.g. a logout awaiting
  `resetAllStores` on a broken storage).

### `preserve`: keep some fields across a reset

```ts
// Keep the user's theme and language; reset everything else to defaults.
await resetStore<PreferencesState>("preferences", {
  preserve: ["theme", "language"],
});
```

`preserve` is typed as `(keyof T)[]` when you supply the state type explicitly
(`resetStore<T>(name, { preserve: [...] })`); otherwise it accepts any string
key, since reset functions address a store by its name and cannot infer `T`.

One interaction to be aware of: when a persisted store is reset while its
initial rehydration is still in flight, the immediate reset preserves values
from the current (pre-hydration) state - but if the rehydration then lands, the
self-healing re-reset preserves values from the freshly **hydrated** state. In
other words, for `preserve`d keys the persisted value wins over the
pre-hydration default. That is usually what you want (a persisted user
preference survives), just don't expect the pre-hydration value to stick.

### Resetting between tests

```ts
import { resetAllStoresForTesting } from "zustand-reset-manager/testing";

afterEach(() => {
  resetAllStoresForTesting();
});
```

## Orchestration

Coordinate resets across many stores: react to them with global hooks, tag them
with a `reason`, and control the order they run in with declared dependencies.

### Hooks + `reason`: one place to react to a logout

`addResetListener({ beforeReset?, afterReset? })` registers a global listener and
returns an `unsubscribe` function. Every reset triggered through `resetStore`,
`resetStores`, or `resetAllStores` calls `beforeReset` right before a store is
reset and `afterReset` right after (for async resets, once the reset has
settled). Both callbacks receive `{ name, group, reason }`.

`reason` is a free-form string you pass in the reset options (`"logout"`,
`"tenant-switch"`, `"test"`, ...). It does not change the reset - it only rides
along to the hooks so they can branch on the cause.

```ts
import { addResetListener, resetAllStores } from "zustand-reset-manager";

const unsubscribe = addResetListener({
  beforeReset: ({ name, reason }) => {
    if (reason === "logout") console.debug(`clearing ${name} on logout`);
  },
  afterReset: ({ name }) => analytics.track("store_reset", { name }),
});

async function logout() {
  await resetAllStores({ reason: "logout", clearPersistedState: true });
}

// on teardown
unsubscribe();
```

An exception thrown from a listener is caught and logged
(`console.error`, prefixed `[zustand-reset-manager]`); it never interrupts the
reset or the other listeners.

### `dependsOn`: reset order

Declare that a store must be reset AFTER the stores it depends on. During a bulk
reset (`resetStores` / `resetAllStores`) the batch is topologically sorted so
every dependency runs first.

```ts
// auth resets before profile; profile resets before dashboard.
createResettableStore({ name: "auth" }, authInit);
createResettableStore({ name: "profile", dependsOn: ["auth"] }, profileInit);
createResettableStore({ name: "dashboard", dependsOn: ["profile"] }, dashboardInit);

resetAllStores(); // order: auth -> profile -> dashboard
```

Semantics:

- A dependency on a store that is not part of the current batch (a different
  group, or not registered at all) is a soft edge - it is ignored for ordering.
- A dependency cycle cannot be ordered: it logs a dev-only warning and falls
  back to registration order.
- `dependsOn` only affects bulk resets; a single `resetStore(name)` never
  consults it.
- Async resets (called with an options object) run **one topological level at a
  time, in sequence**, and the stores **within a level run in parallel**
  (`Promise.all`). Independent stores are reset concurrently; a dependent store
  waits for the whole level of its dependencies to settle first.

## API reference

### `createResettableStore(nameOrConfig, initializer)`

React store. `nameOrConfig` is either a `string` (the name) or
`{ name: string; group?: string; dependsOn?: string[] }`. Returns the usual
Zustand bound hook. The
signature mirrors Zustand's `create`, including middleware mutators, so
`persist`/`devtools`/`immer`-wrapped creators type through without casts. Also
callable curried: `createResettableStore<T>(name)(initializer)` - use the
curried form with an explicit state type to keep middleware inference (exactly
like Zustand's `create<T>()(...)`).

### `createResettableVanillaStore(nameOrConfig, initializer)`

Same as above but wraps `createStore` from `zustand/vanilla` and returns a
plain store api. Use outside React. Also available from the
`zustand-reset-manager/vanilla` subpath, which does not pull in React.

### `resetStore(name)` / `resetStore(name, options)`

Reset a single store to a freshly-initialized state. Called with no options it
is synchronous and returns `void`. Called with an `options` object it returns a
`Promise<void>`.

`options`:

- `clearPersistedState?: boolean` - also clear the store's persisted storage
  (persist middleware only).
- `preserve?: (keyof T)[]` - keys whose current value survives the reset.
- `reason?: string` - free-form label forwarded to reset listeners; does not
  affect the reset itself.

### `resetStores(group)` / `resetStores(group, options)`

Reset every store registered with the given `group`. Same `options` and
sync/`Promise` behavior as `resetStore`.

### `resetAllStores()` / `resetAllStores(options)`

Reset every registered store. Same `options` and sync/`Promise` behavior as
`resetStore`. The classic "reset everything on logout" - with
`{ clearPersistedState: true }` it also wipes persisted state.

### `addResetListener(listener): () => void`

Register a global reset listener `{ beforeReset?, afterReset? }`; returns an
idempotent `unsubscribe` function. Each callback receives
`{ name, group, reason }`. `beforeReset` fires before a store is reset,
`afterReset` after it settles. Listener exceptions are caught and logged and
never interrupt the reset or other listeners. See
[Orchestration](#orchestration).

### `unregisterStore(name): boolean`

Remove a store from the registry. Call this for dynamically created stores
(per-view, per-dialog) - the registry is the sole owner of the reference, so a
store that is never unregistered is never garbage-collected.

### `getRegisteredStoreNames(): string[]`

The names of every currently registered store (debugging / test assertions).

### `zustand-reset-manager/testing`

- `resetAllStoresForTesting()` - the same operation as `resetAllStores()`, under
  a dedicated name for use in `afterEach`.

## Why re-run the initializer instead of caching initial state

The naive approach is to snapshot the first state object and copy it back on
reset:

```ts
// DON'T: caches the very first object
const initial = store.getState();
const reset = () => store.setState(initial, true);
```

This has two problems:

1. **Dynamic values freeze.** If your initial state contains
   `requestId: crypto.randomUUID()` or `createdAt: Date.now()`, every reset
   restores the *original* id/timestamp instead of a fresh one.
2. **Shared mutable references leak.** A cached `items: []` or nested object is
   the *same* reference every time; if anything mutated it in place, the
   "reset" state is already dirty.

`zustand-reset-manager` instead keeps your **initializer** and re-runs it:

```ts
initialStateFactory: () => ({
  requestId: crypto.randomUUID(), // new id on every reset
  items: [],                      // brand-new array on every reset
});
```

Reset is `setState(initializer(set, get, api), true)` - a full replace with a
freshly-built state. Dynamic values are regenerated and mutable containers are
recreated.

## Caveats

- **Actions get new references after a reset (plain stores).** Because the
  initializer is re-run, the action functions it returns are **new function
  instances** after each reset. They keep working (they close over the stable
  `set`/`get`), but a component that subscribes to an action *by reference*
  (`useStore((s) => s.doThing)`) will re-render on reset. Subscribe to data, not
  to action identity, if that matters to you.
- **Persisted stores reset to their captured initial state.** For `persist`
  stores, reset does **not** re-run the (middleware-wrapped) initializer -
  doing so would re-trigger hydration and double-wrap `setState`. Instead it
  restores the initial state the store captured at creation (via
  `getInitialState`). Consequences: dynamic values (`crypto.randomUUID()`) are
  **not** regenerated on reset for persisted stores, and the same
  caveat about shared mutable containers as the cache approach applies. Plain
  (non-persist) stores keep the full re-run behavior. Resetting a persisted
  store requires zustand >=4.5 - older versions expose no `getInitialState`,
  so reset falls back to re-running the initializer, which may restore stale
  state from storage.
- **Persist resets should be awaited.** Pass an options object (even an empty
  `{}`) and `await` the call when a store uses `persist`, so
  `clearPersistedState` completes before you continue. (The reset itself never
  blocks on an in-flight rehydration - see above.)
- **`replace: true` requires the full state.** Reset uses
  `setState(fullState, true)`; this is fine here because the initializer (or
  captured initial state) always produces the complete state. (Relevant if you
  compare against Zustand v5's stricter `replace` typing.)
- **Duplicate package copies share one registry.** The registry lives on
  `globalThis` under `Symbol.for("zustand-reset-manager/registry")`, so two
  copies of this package (micro-frontends, or a duplicated install) share a
  single registry and `resetAllStores()` reaches every store. Deduplicating the
  dependency is still recommended, but no longer required for correctness.
- **Dynamically created stores must be unregistered.** The registry holds a hard
  reference; call `unregisterStore(name)` when a per-view store goes away.

## Roadmap

- **Done** - inter-store dependencies and reset ordering (`dependsOn`),
  `beforeReset` / `afterReset` hooks, and a `reason` on every reset. See
  [Orchestration](#orchestration).
- **Next** - devtools surfacing the reset reason, ready-made logout / tenant-
  change integrations.

## License

MIT
