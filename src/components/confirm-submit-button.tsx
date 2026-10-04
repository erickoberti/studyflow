"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  message: string;
  title?: string;
};

export function ConfirmSubmitButton({ children, className, message, title }: Props) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className={className} title={title} onClick={() => setOpen(true)}>{children}</button>
      {open ? <div role="presentation" className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onKeyDown={(event) => { if (event.key !== "Tab") return; if (event.shiftKey && document.activeElement === cancelRef.current) { event.preventDefault(); confirmRef.current?.focus(); } else if (!event.shiftKey && document.activeElement === confirmRef.current) { event.preventDefault(); cancelRef.current?.focus(); } }} className="w-full max-w-md rounded-t-card bg-surface p-5 shadow-xl dark:bg-panelDark sm:rounded-card sm:p-6">
          <h2 id="confirm-title" className="text-xl font-bold text-slate-950 dark:text-white">Confirmar exclusão</h2>
          <p id="confirm-description" className="mt-2 text-sm text-textSecondary dark:text-textSecondary">{message}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={cancelRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="min-h-11 rounded-control border border-slate-300 px-4 text-sm font-semibold dark:border-white/10">Cancelar</button>
            <button ref={confirmRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.form?.requestSubmit(); }} className="min-h-11 rounded-control bg-rose-700 px-4 text-sm font-semibold text-white">Excluir</button>
          </div>
        </section>
      </div> : null}
    </>
  );
}
