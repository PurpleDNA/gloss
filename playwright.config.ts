import { defineConfig } from "@playwright/test";

/**
 * Extensions only load in a headed context, so these run against WSLg's display.
 * Every spec drives the real built extension out of dist/ — run `npm run build`
 * first, which `npm run test:e2e` does for you.
 */
export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: { actionTimeout: 7_000, trace: "retain-on-failure" },
});
