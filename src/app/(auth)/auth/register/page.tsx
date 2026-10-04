"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { registerUser } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";

const fieldClass = "mt-1.5 h-12 w-full rounded-control border border-slate-300 bg-surface px-3 text-base text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-elevated dark:text-white";

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-h-[100dvh] bg-backgroundLight px-4 py-[max(1.5rem,env(safe-area-inset-top))] dark:bg-backgroundDark sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-card border border-slate-200 bg-surface p-6 dark:border-white/5 dark:bg-panelDark sm:p-8">
          <Link href="/auth/login" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-textSecondary hover:text-primary dark:text-textSecondary"><ArrowLeft size={16} /> Voltar ao login</Link>
          <div className="mt-4 flex items-center justify-center gap-3" aria-label="StudyFlow">
            <BrandLogo className="h-12 w-12 rounded-2xl object-cover" />
            <span className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">StudyFlow</span>
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Criar conta</h1>
            <p className="mt-2 text-sm text-textSecondary dark:text-textSecondary">Comece a organizar seus estudos.</p>
          </div>
          <form className="mt-7 space-y-4" action={(formData) => {
            setMessage(null);
            startTransition(async () => {
              const res = await registerUser(formData);
              setSuccess(res.ok);
              setMessage(res.message);
            });
          }}>
            <label htmlFor="register-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Nome
              <input id="register-name" name="name" autoComplete="name" required disabled={isPending || success} className={fieldClass} />
            </label>
            <label htmlFor="register-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail
              <input id="register-email" name="email" type="email" autoComplete="email" required disabled={isPending || success} className={fieldClass} />
            </label>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200"><label htmlFor="register-password">Senha</label>
              <input id="register-password" name="password" type="password" autoComplete="new-password" required disabled={isPending || success} aria-describedby="register-password-help" className={fieldClass} />
              <span id="register-password-help" className="mt-1 block text-xs font-normal text-textSecondary">Mínimo de 6 caracteres.</span>
            </div>
            {message ? <p role={success ? "status" : "alert"} className={`rounded-control border px-3 py-2.5 text-sm font-medium ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"}`}>{message}</p> : null}
            {success ? <Link href="/auth/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-4 font-semibold text-white">Ir para login</Link> : <button type="submit" disabled={isPending} className="min-h-12 w-full rounded-control bg-primary px-4 font-semibold text-white disabled:opacity-60">{isPending ? "Criando..." : "Criar conta"}</button>}
          </form>
          <p className="mt-5 text-center text-sm text-textSecondary dark:text-textSecondary">Já tem uma conta? <Link href="/auth/login" className="font-semibold text-primary hover:underline">Entrar</Link></p>
        </div>
      </div>
    </div>
  );
}
