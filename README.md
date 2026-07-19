# zustand-reset-manager

Central, type-safe reset for many [Zustand](https://github.com/pmndrs/zustand)
stores at once - reset **one** store, a **group**, or **all** of them with a
single call. Works with React (`create`) and vanilla (`createStore`), Zustand
v4 and v5.

- **Zero runtime dependencies.** `zustand` is the only (peer) dependency.
- **Factory reset.** Your initializer is re-run on reset, so dynamic values
  such as `crypto.randomUUID()` are regenerated - not frozen at first render.
- **Full Zustand signature.** The initializer keeps its exact
  `(set, get, api) => state` shape, so existing stores migrate by wrapping,
  without rewriting.
- **HMR-safe.** Re-registering the same name (Vite/webpack hot reload) never
  throws.

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

### Resetting between tests

```ts
import { resetAllStoresForTesting } from "zustand-reset-manager/testing";

afterEach(() => {
  resetAllStoresForTesting();
});
```

## API reference

### `createResettableStore(nameOrConfig, initializer)`

React store. `nameOrConfig` is either a `string` (the name) or
`{ name: string; group?: string }`. Returns the usual Zustand bound hook
(`UseBoundStore<StoreApi<T>>`). Also callable curried:
`createResettableStore<T>(name)(initializer)`.

### `createResettableVanillaStore(nameOrConfig, initializer)`

Same as above but wraps `createStore` from `zustand/vanilla` and returns a
plain `StoreApi<T>`. Use outside React.

### `resetStore(name)`

Reset a single store to a freshly-initialized state.

### `resetStores(group)`

Reset every store registered with the given `group`.

### `resetAllStores()`

Reset every registered store.

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

- **Actions get new references after a reset.** Because the initializer is
  re-run, the action functions it returns are **new function instances** after
  each reset. They keep working (they close over the stable `set`/`get`), but a
  component that subscribes to an action *by reference*
  (`useStore((s) => s.doThing)`) will re-render on reset. Subscribe to data, not
  to action identity, if that matters to you.
- **Multiple copies of this package = multiple registries.** If two different
  bundles (micro-frontends, or a duplicated install in `node_modules`) each load
  their own copy of `zustand-reset-manager`, there are two independent
  registries and `resetAllStores()` will only reset the stores registered in its
  own copy. Deduplicate the dependency (single version, hoisted) to avoid this.
- **`replace: true` requires the full state.** Reset uses
  `setState(fullState, true)`; this is fine here because the initializer always
  produces the complete state. (Relevant if you compare against Zustand v5's
  stricter `replace` typing.)
- **Dynamically created stores must be unregistered.** The registry holds a hard
  reference; call `unregisterStore(name)` when a per-view store goes away.

## Roadmap

- **0.2** - `persist` support: `clearPersistedState`, waiting for rehydration,
  `localStorage`/`sessionStorage`/custom storage, preserving selected fields
  (`preserve: ["theme"]`), a `globalThis`-based registry to survive duplicate
  copies.
- **0.3** - inter-store dependencies and reset ordering, `beforeReset` /
  `afterReset` hooks, logout/MSAL/tenant-change integration, devtools showing
  the reset reason.

## License

MIT
