"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import Link from "next/link";
import { registerUser } from "@/app/actions";

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(137,90,246,0.25),transparent_45%)]" />
      <form
        className="relative w-full max-w-md rounded-2xl border border-primary/20 bg-[#161126] p-7 shadow-soft"
        action={(formData) => {
          startTransition(async () => {
            const res = await registerUser(formData);
            setMessage(res.message);
          });
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <Image src="/brand/studyflow-logo.png" alt="StudyFlow" width={38} height={38} className="h-9 w-9 rounded-lg object-cover" priority unoptimized />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primarySoft">STUDYFLOW</p>
        </div>

        <h1 className="text-3xl font-black text-white">Criar conta</h1>
        <div className="mt-4 space-y-3">
          <input name="name" placeholder="Nome" required className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-3 text-white outline-none focus:border-primary" />
          <input name="email" type="email" placeholder="Email" required className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-3 text-white outline-none focus:border-primary" />
          <input name="password" type="password" placeholder="Senha (minimo 6)" required className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-3 text-white outline-none focus:border-primary" />
        </div>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <button type="submit" disabled={isPending} className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-white shadow-soft disabled:opacity-50">
          {isPending ? "Criando..." : "Criar conta"}
        </button>
        <Link href="/auth/login" className="mt-3 block text-sm text-primarySoft hover:underline">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}



