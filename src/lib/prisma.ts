import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// In dev, avoid holding onto a stale client shape after schema changes.
// In prod, keep a single shared instance per process.
export const prisma =
  process.env.NODE_ENV === "production"
    ? global.prisma ?? new PrismaClient()
    : new PrismaClient();

if (process.env.NODE_ENV === "production") {
  global.prisma = prisma;
}

