import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

test("manifest possui identidade, standalone e ícones instaláveis", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "StudyFlow"); assert.equal(manifest.display, "standalone"); assert.equal(manifest.scope, "/"); assert.equal(manifest.start_url, "/dashboard");
  assert.ok(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "192x192")); assert.ok(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512")); assert.ok(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable"));
  for (const icon of manifest.icons) assert.deepEqual([...readFileSync(resolve(root, "public", icon.src.replace(/^\//, ""))).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("cache mantém APIs e dados autenticados em NetworkOnly", () => {
  const config = readFileSync(resolve(root, "next.config.mjs"), "utf8");
  assert.match(config, /\/\\\/api\\\/\/i, handler: "NetworkOnly"/); assert.match(config, /_next\\\/data/); assert.match(config, /cleanupOutdatedCaches: true/); assert.match(config, /skipWaiting: true/); assert.match(config, /clientsClaim: true/);
  assert.match(config, /cacheStartUrl: false/); assert.match(config, /dynamicStartUrl: false/); assert.match(config, /additionalManifestEntries: \[\{ url: "\/offline\/dashboard"/);
  assert.doesNotMatch(config, /\/api.*(?:CacheFirst|NetworkFirst|StaleWhileRevalidate)/);
});

test("service worker gerado não persiste a rota inicial autenticada", () => {
  const worker = readFileSync(resolve(root, "public/sw.js"), "utf8");
  assert.doesNotMatch(worker, /cacheName:"start-url"/);
  assert.match(worker, /url:"\/offline\/dashboard",revision:"phase4-offline-shell-v1"/);
  assert.match(worker, /registerRoute\(\/\\\/api\\\/\/i,new \w+\.NetworkOnly/);
  assert.match(worker, /registerRoute\(\/\\\/_next\\\/data\\\/\/i,new \w+\.NetworkOnly/);
  assert.match(worker, /NetworkOnly\(\{plugins:\[new \w+\.PrecacheFallbackPlugin\(\{fallbackURL:"\/offline\/dashboard"\}\)\]\}\)/);
});

test("assets essenciais do PWA são públicos e atualização é verificada", () => {
  const middleware = readFileSync(resolve(root, "src/middleware.ts"), "utf8"); const status = readFileSync(resolve(root, "src/components/pwa-connection-status.tsx"), "utf8");
  for (const path of ["/manifest.webmanifest", "/brand", "/sw.js", "/workbox-"]) assert.ok(middleware.includes(`"${path}"`));
  for (const label of ["Online", "Offline", "Sincronizando", "pendência", "Erro de sincronização", "conflito"]) assert.ok(status.includes(label));
  assert.ok(status.includes("registration?.update()")); assert.ok(status.includes("controllerchange"));
});
