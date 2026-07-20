import { afterEach, describe, expect, it } from "vitest";
import {
  createResettableStore,
  getRegisteredStoreNames,
  resetAllStores,
  resetStore,
  unregisterStore,
} from "../src/index";

afterEach(() => {
  for (const name of getRegisteredStoreNames()) {
    unregisterStore(name);
  }
});

interface PrefsState {
  theme: string;
  language: string;
  fontSize: number;
  set: (v: Partial<PrefsState>) => void;
}

describe("preserve (plain store)", () => {
  it("keeps preserved fields and resets everything else", async () => {
    const usePrefs = createResettableStore<PrefsState>("preferences", (set) => ({
      theme: "light",
      language: "en",
      fontSize: 14,
      set: (v) => set(v),
    }));

    usePrefs.getState().set({ theme: "dark", language: "fr", fontSize: 20 });

    await resetStore<PrefsState>("preferences", {
      preserve: ["theme", "language"],
    });

    const s = usePrefs.getState();
    expect(s.theme).toBe("dark"); // preserved
    expect(s.language).toBe("fr"); // preserved
    expect(s.fontSize).toBe(14); // reset to initializer value
  });

  it("resets normally when preserve is an empty list", async () => {
    const usePrefs = createResettableStore<PrefsState>("preferences", (set) => ({
      theme: "light",
      language: "en",
      fontSize: 14,
      set: (v) => set(v),
    }));

    usePrefs.getState().set({ theme: "dark", fontSize: 20 });
    await resetStore<PrefsState>("preferences", { preserve: [] });

    expect(usePrefs.getState().theme).toBe("light");
    expect(usePrefs.getState().fontSize).toBe(14);
  });

  it("preserve works through resetAllStores", async () => {
    const usePrefs = createResettableStore<PrefsState>("preferences", (set) => ({
      theme: "light",
      language: "en",
      fontSize: 14,
      set: (v) => set(v),
    }));

    usePrefs.getState().set({ theme: "dark", fontSize: 20 });

    await resetAllStores<PrefsState>({ preserve: ["theme"] });

    expect(usePrefs.getState().theme).toBe("dark"); // preserved
    expect(usePrefs.getState().fontSize).toBe(14); // reset
  });
});
