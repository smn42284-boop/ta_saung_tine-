import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined")
  try {
    if (!window.localStorage)
      throw new Error("Browser storage is unavailable.");
  } catch {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(String(key)) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(String(key)),
      setItem: (key, value) => values.set(String(key), String(value)),
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  }

if (typeof window !== "undefined")
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

if (typeof window !== "undefined")
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
