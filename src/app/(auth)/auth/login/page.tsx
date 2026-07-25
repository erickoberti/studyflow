"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
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

  useEffect(() => {
    router.prefetch("/offline/dashboard");
    router.prefetch("/offline/registro");
    router.prefetch("/offline/registros");
    router.prefetch("/offline/ciclo");
    router.prefetch("/offline/base");
    router.prefetch("/offline/guias");
    router.prefetch("/offline/configuracoes");
  }, [router]);

  const mode = useMemo<"web" | "app">(() => (isAppMode ? "app" : "web"), [isAppMode]);

  return (
    <div className="min-h-[100dvh] bg-backgroundLight px-4 py-[max(1.5rem,env(safe-area-inset-top))] dark:bg-backgroundDark sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-primary/20 dark:bg-panelDark">
          <div className="p-5 pb-0 sm:p-6 sm:pb-0">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-primary dark:text-slate-300">
              <ArrowLeft size={16} /> Voltar
            </Link>
          </div>

          <div className="px-6 pb-7 pt-5 sm:px-8 sm:pb-8">
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-3" aria-label="StudyFlow">
                <BrandLogo className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-primary/20" />
                <span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">StudyFlow</span>
              </div>
            </div>

            <div className="mb-7 text-center">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Bem-vindo de volta</h1>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Acesse sua rotina de estudos</p>
            </div>

            <LoginForm mode={mode} />
          </div>

          {!isAppMode ? (
            <div className="border-t border-slate-100 bg-primary/5 px-6 py-4 text-center text-xs font-medium text-slate-500 dark:border-primary/20 dark:bg-primary/10 dark:text-slate-400">
              © 2026 StudyFlow
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}




