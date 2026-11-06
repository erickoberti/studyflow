import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getActiveStudyGuideForUser } from "@/lib/study-guide";
import { extendCycleProgram, saveCycleProgram } from "@/lib/programmed-cycle-service";
import { programInputSchema } from "@/lib/programmed-cycle";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    try { if (new URL(origin).host !== host) return NextResponse.json({ message: "Origem inválida." }, { status: 403 }); }
    catch { return NextResponse.json({ message: "Origem inválida." }, { status: 403 }); }
  }
  const guide = await getActiveStudyGuideForUser(session.user.id);
  if (!guide) return NextResponse.json({ message: "Selecione um guia." }, { status: 409 });
  try {
    const raw = await request.json();
    if (raw?.command === "extend") {
      if (!Number.isSafeInteger(raw.version)) throw new Error("Versão inválida.");
      await extendCycleProgram(session.user.id, guide.id, raw.version);
    } else {
      const input = programInputSchema.safeParse(raw);
      if (!input.success) return NextResponse.json({ message: input.error.issues[0]?.message ?? "Programação inválida." }, { status: 400 });
      if (input.data.version === 0 && raw?.confirmMigration !== true) throw new Error("Revise e confirme a comparação com seu ciclo atual antes de ativar.");
      if (input.data.version === 0 && !input.data.legacyFingerprint) throw new Error("Recarregue a comparação com seu ciclo atual antes de ativar.");
      await saveCycleProgram(session.user.id, guide.id, input.data);
    }
    for (const path of ["/ciclo", "/ciclo/configuracao", "/registro", "/dashboard", "/base"]) revalidatePath(path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível salvar. Nenhuma alteração foi confirmada." }, { status: 409 });
  }
}
