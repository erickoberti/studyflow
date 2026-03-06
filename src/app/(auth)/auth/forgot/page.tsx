"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";

export default function ForgotPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <form
        className="rounded-card border border-slate-200 bg-white p-6 shadow-soft"
        action={(formData) => {
          startTransition(async () => {
            const res = await requestPasswordReset(formData);
            setMessage(res.message);
          });
        }}
      >
        <h1 className="text-2xl font-black text-ink">Recuperar senha</h1>
        <p className="mt-1 text-sm text-slate-500">Para esta versão, o token é mostrado na tela.</p>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <button type="submit" disabled={isPending} className="mt-4 w-full rounded-lg bg-brand py-2 font-semibold text-white">
          {isPending ? "Gerando..." : "Gerar token"}
        </button>
        <Link href="/auth/reset" className="mt-3 block text-sm text-brand hover:underline">
          Já tenho token
        </Link>
      </form>
    </div>
  );
}
