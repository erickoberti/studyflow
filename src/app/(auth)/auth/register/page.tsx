"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registerUser } from "@/app/actions";

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <form
        className="rounded-card border border-slate-200 bg-white p-6 shadow-soft"
        action={(formData) => {
          startTransition(async () => {
            const res = await registerUser(formData);
            setMessage(res.message);
          });
        }}
      >
        <h1 className="text-2xl font-black text-ink">Criar conta</h1>
        <div className="mt-4 space-y-3">
          <input name="name" placeholder="Nome" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <input name="email" type="email" placeholder="Email" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <input
            name="password"
            type="password"
            placeholder="Senha (mínimo 6)"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <button type="submit" disabled={isPending} className="mt-4 w-full rounded-lg bg-brand py-2 font-semibold text-white">
          {isPending ? "Criando..." : "Criar conta"}
        </button>
        <Link href="/auth/login" className="mt-3 block text-sm text-brand hover:underline">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}
