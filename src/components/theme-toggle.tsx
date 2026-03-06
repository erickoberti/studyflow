"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "rounded-md px-2 py-1 text-xs font-semibold",
          resolvedTheme === "light" ? "bg-brand text-white" : "text-slate-600 dark:text-slate-300",
        )}
        aria-label="Ativar modo claro"
      >
        <Sun size={14} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "rounded-md px-2 py-1 text-xs font-semibold",
          resolvedTheme === "dark" ? "bg-brand text-white" : "text-slate-600 dark:text-slate-300",
        )}
        aria-label="Ativar modo escuro"
      >
        <Moon size={14} />
      </button>
    </div>
  );
}