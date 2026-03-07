"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Github, Lock, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (response?.error) {
      setError("Credenciais inválidas");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-[1.05rem] font-medium text-slate-200">E-mail</label>
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-[#0f1426] px-4 py-4">
          <Mail size={22} className="text-slate-400" />
          <input
            name="email"
            type="email"
            required
            placeholder="seu@email.com"
            className="w-full bg-transparent text-3xl text-white placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[1.05rem] font-medium text-slate-200">Senha</label>
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-[#0f1426] px-4 py-4">
          <Lock size={22} className="text-slate-400" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Sua senha secreta"
            className="w-full bg-transparent text-3xl text-white placeholder:text-slate-500 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Mostrar ou ocultar senha"
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-slate-400">
          <input type="checkbox" className="h-4 w-4 rounded border-primary/40 bg-transparent" />
          Lembrar de mim
        </label>
        <Link href="/auth/forgot" className="font-semibold text-primary hover:underline">
          Esqueci a senha
        </Link>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-primary to-[#8a63f7] px-4 py-4 text-2xl font-extrabold text-white shadow-soft disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="pt-2">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
          <span className="h-px flex-1 bg-primary/20" />
          ou continue com
          <span className="h-px flex-1 bg-primary/20" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" className="rounded-2xl border border-primary/30 bg-[#0f1426] py-3 text-sm font-bold text-slate-200">
            Google
          </button>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-[#0f1426] py-3 text-sm font-bold text-slate-200">
            <Github size={16} /> GitHub
          </button>
        </div>
      </div>

      <p className="pt-2 text-center text-base text-slate-400">
        Ainda não tem uma conta?{" "}
        <Link href="/auth/register" className="font-bold text-primary hover:underline">
          Criar conta
        </Link>
      </p>

      <div className="pt-3 text-center text-sm text-slate-500">
        <span>Termos de Uso</span>
        <span className="mx-4">Privacidade</span>
        <span>Suporte</span>
      </div>
    </form>
  );
}
