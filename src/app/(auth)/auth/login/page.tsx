import Image from "next/image";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(137,90,246,0.25),transparent_45%)]" />
      <div className="relative w-full max-w-[760px] rounded-3xl border border-primary/20 bg-[#0e111b]/95 p-8 shadow-soft sm:p-10">
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-[28px] border border-primary/20 bg-primary/10 p-3">
          <Image src="/brand/studyflow-logo.png" alt="StudyFlow" width={88} height={88} className="h-20 w-20 rounded-xl object-cover" priority />
        </div>

        <h1 className="text-center text-6xl font-black text-slate-100 sm:text-7xl">Bem-vindo ao StudyFlow</h1>
        <p className="mt-5 text-center text-4xl text-slate-400 sm:text-5xl">Sua jornada de aprendizado começa aqui.</p>

        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
