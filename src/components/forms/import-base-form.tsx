"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

export function ImportBaseForm() {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo CSV.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    const response = await fetch("/api/import/base", {
      method: "POST",
      body: formData,
    });
    setLoading(false);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = data?.message ?? "Erro ao importar planilha.";
      setMessage(errorMessage);
      toast.error(errorMessage);
      return;
    }

    const successMessage = data?.message ?? "Planilha cadastrada com sucesso.";
    setMessage(successMessage);
    toast.success(successMessage);
    if (fileRef.current) fileRef.current.value = "";
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input ref={fileRef} type="file" name="file" accept=".csv" required className="text-sm" />
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#1152d4] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Importando..." : "Importar cadastro-base"}
      </button>
      {message ? <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </form>
  );
}