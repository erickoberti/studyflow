import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(137,90,246,0.25),transparent_45%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-primary/20 bg-[#161126] p-7 shadow-soft">
        <div className="mb-3 flex items-center gap-3">
          <Image src="/brand/studyflow-logo.png" alt="StudyFlow" width={38} height={38} className="h-9 w-9 rounded-lg object-cover" priority />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primarySoft">STUDYFLOW</p>
        </div>
        <h1 className="mt-2 text-3xl font-black text-white">Entrar</h1>

        <div className="mt-5">
          <LoginForm />
        </div>

        <div className="mt-5 flex justify-between text-sm">
          <Link href="/auth/register" className="text-primarySoft hover:underline">
            Criar conta
          </Link>
          <Link href="/auth/forgot" className="text-primarySoft hover:underline">
            Esqueci a senha
          </Link>
        </div>
      </div>
    </div>
  );
}



