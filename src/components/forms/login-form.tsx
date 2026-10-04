"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Github, Lock, Mail } from "lucide-react";
import { getOfflineSnapshotForEmail, setOfflineAccess } from "@/lib/offline/store";

export function LoginForm({ mode = "web" }: { mode?: "web" | "app" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function continueOffline(candidateEmail?: string) {
    const typedEmail = candidateEmail?.trim().toLowerCase() ?? "";
    if (!typedEmail) {
      setError("Informe o e-mail da conta sincronizada para entrar offline.");
      return false;
    }
    const snapshot = getOfflineSnapshotForEmail(typedEmail);
    const cachedEmail = snapshot.user?.email?.toLowerCase();

    if (!cachedEmail) {
      setError("Este dispositivo ainda não tem dados sincronizados para acesso offline.");
      return false;
    }

    if (typedEmail && typedEmail !== cachedEmail) {
      setError("Use o mesmo e-mail da última sincronização para entrar offline.");
      return false;
    }

    setOfflineAccess({
      email: snapshot.user?.email ?? "",
      userId: snapshot.user?.id,
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
      let response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      const csrfFailed = (url?: string | null) => {
        if (!url) return false;
        const target = new URL(url, window.location.origin);
        return target.pathname === "/api/auth/signin" && target.searchParams.has("csrf");
      };
      if (csrfFailed(response?.url)) {
        response = await signIn("credentials", { email, password, redirect: false });
      }

      setLoading(false);

      if (!response?.ok || response.error || csrfFailed(response.url)) {
        setError("Credenciais invalidas");
        return;
      }

      setOfflineAccess({ email, userId: null, name: "Aluno", unlockedAt: new Date().toISOString() });
      router.push("/dashboard");
    } catch {
      setLoading(false);
      if (!navigator.onLine && continueOffline(email)) {
        return;
      }
      setError("Não foi possível autenticar agora.");
    }
  }

  const isApp = mode === "app";
  const inputCls = `h-12 rounded-control border border-slate-300 pl-10 pr-4 text-base text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-elevated dark:text-white ${isApp ? "bg-primary/5" : "bg-surface"}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</label>
        <div className="relative">
          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            id="login-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className={`w-full ${inputCls}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Senha</label>
          <Link href="/auth/forgot" className="text-xs font-medium text-primary hover:underline">
            Esqueceu a senha?
          </Link>
        </div>
        <div className="relative">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className={`w-full ${inputCls} pr-10`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-control text-textSecondary hover:text-primary"
            aria-label="Mostrar ou ocultar senha"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error ? <p id="login-error" role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 min-h-12 w-full rounded-control bg-primary py-3 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <button
        type="button"
        onClick={() => continueOffline(email)}
        disabled={loading}
        className="min-h-11 w-full rounded-control border border-slate-300 bg-transparent py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Entrar offline com dados salvos
      </button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-primary/20" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-textSecondary">ou continue com</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-primary/20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled aria-label="Login com Google indisponível" title="Em breve" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface py-2.5 text-sm font-medium text-textSecondary opacity-70 dark:border-primary/20 dark:bg-primary/5 dark:text-textSecondary">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-slate-700">G</span>
          Google
        </button>
        <button type="button" disabled aria-label="Login com GitHub indisponível" title="Em breve" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface py-2.5 text-sm font-medium text-textSecondary opacity-70 dark:border-primary/20 dark:bg-primary/5 dark:text-textSecondary">
          <Github size={16} /> GitHub
        </button>
      </div>

      <p className="pt-2 text-center text-sm text-textSecondary dark:text-textSecondary">
        Ainda não tem uma conta?{" "}
        <Link href="/auth/register" className="font-semibold text-primary hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
