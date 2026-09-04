import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { parseTheme, themeAttribute, themeOrDefault } from "../src/lib/theme/theme.ts";

describe("theme preference", () => {
  test("recognises the three valid preferences", () => {
    assert.equal(parseTheme("system"), "system");
    assert.equal(parseTheme("light"), "light");
    assert.equal(parseTheme("dark"), "dark");
  });

  test("rejects anything else rather than guessing", () => {
    for (const value of ["Dark", "", "auto", null, undefined, 1, {}]) {
      assert.equal(parseTheme(value), null, `should reject ${JSON.stringify(value)}`);
    }
  });

  test("falls back to following the device", () => {
    assert.equal(themeOrDefault("nonsense"), "system");
    assert.equal(themeOrDefault(undefined), "system");
    assert.equal(themeOrDefault("dark"), "dark");
  });

  test("system stamps no attribute, so the OS setting still wins", () => {
    // Stamping data-theme="light" for a system user would force light on
    // someone whose device is set to dark — the opposite of "system".
    assert.equal(themeAttribute("system"), undefined);
    assert.equal(themeAttribute("light"), "light");
    assert.equal(themeAttribute("dark"), "dark");
  });
});
