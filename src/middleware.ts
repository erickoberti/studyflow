import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot",
  "/auth/reset",
  "/api/auth",
  "/manifest.webmanifest",
  "/icons",
  "/_next",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicPaths.some((path) => pathname.startsWith(path));

  if (isPublic) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/auth/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

