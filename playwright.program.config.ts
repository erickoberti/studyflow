import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const database = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (process.env.PROGRAM_CYCLE_INTEGRATION !== "true" || database?.hostname !== "127.0.0.1" || database.pathname !== "/studyflow_program_test") throw new Error("Este teste só executa no banco local fictício studyflow_program_test.");

export default defineConfig({
  ...base, testMatch: "programmed-cycle.spec.ts", workers: 1, timeout: 120_000,
  projects: [{ name: "programmed-cycle", use: { viewport: { width: 1440, height: 1000 } } }],
  use: { ...base.use, serviceWorkers: "block" },
  webServer: { command: process.env.E2E_PRODUCTION === "true" ? "npm run start -- -p 3100" : "npm run dev -- -p 3100", url: "http://127.0.0.1:3100/auth/login", reuseExistingServer: false, timeout: 120_000, env: { DATABASE_URL: process.env.DATABASE_URL!, NEXTAUTH_URL: process.env.E2E_PRODUCTION === "true" ? "https://ci.example.invalid" : "http://127.0.0.1:3100" } },
});
