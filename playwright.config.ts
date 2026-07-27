import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 }, channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 5"], channel: "chrome" } },
  ],
  webServer: { command: "npm run dev -- -p 3100", url: "http://127.0.0.1:3100/auth/login", reuseExistingServer: false, timeout: 120_000, stdout: "ignore", stderr: "pipe", env: { NEXTAUTH_URL: "http://127.0.0.1:3100" } },
});
