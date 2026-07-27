import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { reportApplicationError } from "@/lib/logger";

const schema = z.object({ message: z.string().max(500), digest: z.string().max(200).optional(), path: z.string().max(500).optional() });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  reportApplicationError("client-boundary", new Error(parsed.data.message), { userId: session.user.id, digest: parsed.data.digest, path: parsed.data.path });
  return NextResponse.json({ ok: true }, { status: 202 });
}
