"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? resolvedTheme : "light";

  return (
    <div className="inline-flex items-center rounded-control border border-slate-300 bg-surface p-1 dark:border-white/10 dark:bg-elevated">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "grid min-h-11 min-w-11 place-items-center rounded-lg text-xs font-semibold transition-colors",
          activeTheme === "light" ? "bg-primary text-white" : "text-textSecondary hover:bg-slate-100 dark:text-textSecondary dark:hover:bg-slate-800",
        )}
        aria-label="Ativar modo claro"
        aria-pressed={activeTheme === "light"}
      >
        <Sun size={14} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "grid min-h-11 min-w-11 place-items-center rounded-lg text-xs font-semibold transition-colors",
          activeTheme === "dark" ? "bg-primary text-white" : "text-textSecondary hover:bg-slate-100 dark:text-textSecondary dark:hover:bg-slate-800",
        )}
        aria-label="Ativar modo escuro"
        aria-pressed={activeTheme === "dark"}
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
