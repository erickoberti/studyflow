import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
process.env.STUDYFLOW_READ_ONLY_AUDIT = "true";
const production = process.env.E2E_PRODUCTION === "true";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "modernization.spec.ts",
  timeout: 600_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", serviceWorkers: "block", trace: "retain-on-failure", actionTimeout: 15_000, navigationTimeout: 60_000 },
  webServer: { command: production ? "npm run start -- -p 3100" : "npm run dev -- -p 3100", url: "http://127.0.0.1:3100/auth/login", timeout: 120_000, reuseExistingServer: false, stdout: "ignore", stderr: "pipe", env: { NEXTAUTH_URL: production ? "https://ci.example.invalid" : "http://127.0.0.1:3100" } },
});
