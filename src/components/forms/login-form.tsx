"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("Credenciais invalidas");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-3 text-white outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-300">Senha</label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-lg border border-primary/30 bg-[#120e20] px-3 py-3 text-white outline-none focus:border-primary"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-white shadow-soft disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
