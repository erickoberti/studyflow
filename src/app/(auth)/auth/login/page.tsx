"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { BrandLogo } from "@/components/brand-logo";

function detectAppMode() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  const ref = document.referrer || "";
  return Boolean(standalone || iosStandalone || ref.startsWith("android-app://"));
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const forced = searchParams.get("mode");
  const [isAppMode, setIsAppMode] = useState(false);

  useEffect(() => {
    if (forced === "app") {
      setIsAppMode(true);
      return;
    }
    if (forced === "web") {
      setIsAppMode(false);
      return;
    }
    setIsAppMode(detectAppMode() || window.innerWidth <= 768);
  }, [forced]);

  const mode = useMemo<"web" | "app">(() => (isAppMode ? "app" : "web"), [isAppMode]);

  return (
    <div className="min-h-screen bg-background-light px-4 py-6 dark:bg-background-dark">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-primary/20 dark:bg-slate-900/90">
          <div className="p-6 pb-2">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <ArrowLeft size={16} /> Voltar
            </Link>
          </div>

          <div className="px-8 pb-8 pt-3">
            <div className="mb-6 flex justify-center">
              <BrandLogo className="h-14 w-14 rounded-xl object-cover" />
            </div>

            <div className="mb-7 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Bem-vindo ao StudyFlow</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize sua rotina de estudos de forma inteligente</p>
            </div>

            <LoginForm mode={mode} />
          </div>

          {!isAppMode ? (
            <div className="border-t border-slate-100 bg-primary/5 px-8 py-4 text-center text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:border-primary/20 dark:bg-primary/10">
              © 2024 StudyFlow Academy. Transformando o aprendizado digital.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}




