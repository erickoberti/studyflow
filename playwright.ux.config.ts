import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "ux-clarity.spec.ts",
  workers: 1,
  timeout: 120_000,
  use: { ...base.use, serviceWorkers: "block" },
  projects: [{ name: "responsive", use: { viewport: { width: 1440, height: 900 } } }],
  webServer: { command: process.env.E2E_PRODUCTION === "true" ? "npm run start -- -p 3100" : "npm run dev -- -p 3100", url: "http://127.0.0.1:3100/auth/login", reuseExistingServer: true, timeout: 120_000, env: { NEXTAUTH_URL: process.env.E2E_PRODUCTION === "true" ? "https://ci.example.invalid" : "http://127.0.0.1:3100" } },
});
