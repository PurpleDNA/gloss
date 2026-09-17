import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_PROVIDER, PROVIDERS, getProvider } from "../../src/providers/registry";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

describe("provider registry", () => {
  it("has unique ids", () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
  });

  it("names a default provider that exists", () => {
    expect(PROVIDERS.some((p) => p.id === DEFAULT_PROVIDER)).toBe(true);
  });

  it("falls back to the first provider for an unknown id", () => {
    // Settings can hold a provider id from a build that has since dropped it.
    expect(getProvider("does-not-exist")).toBe(PROVIDERS[0]);
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))("%s is fully described", (_id, p) => {
    expect(p.label).toBeTruthy();
    expect(p.keyHint).toBeTruthy();
    expect(typeof p.adapter).toBe("function");
    expect(p.models.length).toBeGreaterThan(0);
    expect(new Set(p.models.map((m) => m.id)).size).toBe(p.models.length);
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))(
    "%s offers its default model in the picker",
    (_id, p) => {
      // Otherwise the settings dropdown opens on "Custom…" for a fresh install.
      expect(p.models.map((m) => m.id)).toContain(p.defaultModel);
    },
  );

  it.each(PROVIDERS.map((p) => [p.id, p] as const))("%s links somewhere to get a key", (_id, p) => {
    expect(() => new URL(p.keyUrl)).not.toThrow();
  });

  it.each(PROVIDERS.map((p) => [p.id, p] as const))(
    "%s declares an origin the manifest can actually request",
    (_id, p) => {
      expect(manifest.optional_host_permissions).toContain(p.origin);
    },
  );

  it("requests no host permission it does not use", () => {
    const used = new Set(PROVIDERS.map((p) => p.origin));
    for (const origin of manifest.optional_host_permissions) expect(used).toContain(origin);
  });

  describe("providers that mint their own key", () => {
    const connectable = PROVIDERS.filter((p) => p.connect);

    it("is currently OpenRouter", () => {
      expect(connectable.map((p) => p.id)).toEqual(["openrouter"]);
    });

    it("marks OpenRouter's default model free, since connecting should cost nothing", () => {
      const openrouter = getProvider("openrouter");
      expect(openrouter.free).toBe(true);
      expect(openrouter.defaultModel).toMatch(/:free$/);
    });
  });
});

describe("manifest", () => {
  it("is manifest v3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("carries the permissions the code calls", () => {
    // identity is what launchWebAuthFlow needs; without it Connect silently fails.
    for (const p of ["activeTab", "scripting", "contextMenus", "identity", "sidePanel", "storage"]) {
      expect(manifest.permissions).toContain(p);
    }
  });

  it("requests no site access at install time", () => {
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("points at entry points the build actually emits", () => {
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.side_panel.default_path).toBe("sidepanel.html");
    expect(manifest.options_page).toBe("options.html");
  });
});
