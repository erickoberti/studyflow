import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default withPWA({
  dest: "public",
  disable: isDev,
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: false,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  additionalManifestEntries: [{ url: "/offline/dashboard", revision: "phase4-offline-shell-v1" }],
  runtimeCaching: [
    { urlPattern: /\/api\//i, handler: "NetworkOnly", method: "GET", options: {} },
    { urlPattern: /\/_next\/data\//i, handler: "NetworkOnly", options: {} },
    { urlPattern: /\/_next\/static\//i, handler: "CacheFirst", options: { cacheName: "studyflow-static-assets", expiration: { maxEntries: 96, maxAgeSeconds: 2592000 }, cacheableResponse: { statuses: [0, 200] } } },
    { urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico)$/i, handler: "CacheFirst", options: { cacheName: "studyflow-images", expiration: { maxEntries: 48, maxAgeSeconds: 2592000 }, cacheableResponse: { statuses: [0, 200] } } },
    { urlPattern: /\.(?:woff|woff2|ttf|otf)$/i, handler: "CacheFirst", options: { cacheName: "studyflow-fonts", expiration: { maxEntries: 16, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } } },
    { urlPattern: /^https?:\/\/[^/]+\/(?:offline|auth)(?:\/.*)?$/i, handler: "NetworkFirst", options: { cacheName: "studyflow-public-pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 20, maxAgeSeconds: 86400 }, cacheableResponse: { statuses: [0, 200] } } },
    { urlPattern: /^https?:\/\/[^/]+\/(?!offline(?:\/|$)|auth(?:\/|$)).*/i, handler: "NetworkOnly", options: { precacheFallback: { fallbackURL: "/offline/dashboard" } } },
  ],
})(nextConfig);
