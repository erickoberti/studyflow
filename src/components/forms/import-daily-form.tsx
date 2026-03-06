"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

export function ImportDailyForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um CSV de registro diário.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    const response = await fetch("/api/import/daily", {
      method: "POST",
      body: formData,
    });
    setLoading(false);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = data?.message ?? "Erro ao importar registro diário.";
      setMessage(errorMessage);
      toast.error(errorMessage);
      return;
    }

    const successMessage = data?.message ?? "Registro diário importado com sucesso.";
    setMessage(successMessage);
    toast.success(successMessage);
    if (fileRef.current) fileRef.current.value = "";
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input ref={fileRef} type="file" accept=".csv" required className="text-sm" />
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#1152d4] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Importando..." : "Importar registro diário"}
      </button>
      {message ? <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </form>
  );
}