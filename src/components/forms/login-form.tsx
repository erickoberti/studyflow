"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Github, Lock, Mail } from "lucide-react";
import { getOfflineSnapshot, setOfflineAccess } from "@/lib/offline/store";

export function LoginForm({ mode = "web" }: { mode?: "web" | "app" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function continueOffline(candidateEmail?: string) {
    const snapshot = getOfflineSnapshot();
    const cachedEmail = snapshot.user?.email?.toLowerCase();
    const typedEmail = candidateEmail?.trim().toLowerCase() ?? "";

    if (!cachedEmail) {
      setError("Este dispositivo ainda nao tem dados sincronizados para acesso offline.");
      return false;
    }

    if (typedEmail && typedEmail !== cachedEmail) {
      setError("Use o mesmo e-mail da ultima sincronizacao para entrar offline.");
      return false;
    }

    setOfflineAccess({
      email: snapshot.user?.email ?? "",
      name: snapshot.user?.name ?? "Aluno",
      unlockedAt: new Date().toISOString(),
    });
    router.push("/offline/dashboard");
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    if (!navigator.onLine) {
      setLoading(false);
      continueOffline(email);
      return;
    }

    try {
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (response?.error) {
        setError("Credenciais invalidas");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      if (!navigator.onLine && continueOffline(email)) {
        return;
      }
      setError("Nao foi possivel autenticar agora.");
    }
  }

  const isApp = mode === "app";
  const inputCls = isApp
    ? "h-12 rounded-lg border border-primary/25 bg-primary/10 pl-10 pr-4 text-base text-slate-900 outline-none focus:border-primary dark:text-white"
    : "h-11 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-primary dark:border-primary/20 dark:bg-primary/10 dark:text-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">E-mail</label>
        <div className="relative">
          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className={`w-full ${inputCls}`}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Senha</label>
          <Link href="/auth/forgot" className="text-xs font-medium text-primary hover:underline">
            Esqueceu a senha?
          </Link>
        </div>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className={`w-full ${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
            aria-label="Mostrar ou ocultar senha"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-primary py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <button
        type="button"
        onClick={() => continueOffline(email)}
        className="w-full rounded-lg border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary"
      >
        Entrar offline com dados salvos
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-primary/20" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">ou continue com</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-primary/20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-primary/20 dark:bg-primary/10 dark:text-slate-200 dark:hover:bg-primary/15">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-700">G</span>
          Google
        </button>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-primary/20 dark:bg-primary/10 dark:text-slate-200 dark:hover:bg-primary/15">
          <Github size={16} /> GitHub
        </button>
      </div>

      <p className="pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
        Ainda nao tem uma conta?{" "}
        <Link href="/auth/register" className="font-semibold text-primary hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
