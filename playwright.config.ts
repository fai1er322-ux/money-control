import { defineConfig, devices } from "@playwright/test";

// PW_CHANNEL=chrome (or msedge) runs against an installed browser instead of the bundled one.
const channel = process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:4173", trace: "on-first-retry" },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], ...channel, viewport: { width: 375, height: 812 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...channel, viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
