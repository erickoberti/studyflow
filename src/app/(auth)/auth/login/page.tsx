import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-card border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">StudyFlow Concurso</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-slate-500">Use o login demo: demo@studyflow.com / 123456</p>
        <div className="mt-5">
          <LoginForm />
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <Link href="/auth/register" className="text-brand hover:underline">
            Criar conta
          </Link>
          <Link href="/auth/forgot" className="text-brand hover:underline">
            Esqueci a senha
          </Link>
        </div>
      </div>
    </div>
  );
}
