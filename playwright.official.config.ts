import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
export default defineConfig({ testDir:'./e2e', testMatch:'official-references.spec.ts', workers:1, timeout:120000, use:{baseURL:process.env.VISUAL_BASE_URL ?? 'http://localhost:3100',channel:'chrome',serviceWorkers:'block'}, reporter:'list' });
