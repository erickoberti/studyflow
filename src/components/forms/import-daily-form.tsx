"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

export function ImportDailyForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um CSV de registro diario.");
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
      const errorMessage = data?.message ?? "Erro ao importar registro diario.";
      setMessage(errorMessage);
      toast.error(errorMessage);
      return;
    }

    const successMessage = data?.message ?? "Registro diario importado com sucesso.";
    setMessage(successMessage);
    toast.success(successMessage);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-primary/25 bg-[#120e20] px-4 py-3 text-sm text-slate-300 hover:border-primary/50">
        <div className="flex items-center gap-2">
          <UploadCloud size={16} className="text-primarySoft" />
          <span className="max-w-[300px] truncate">{fileName || "Escolher arquivo CSV"}</span>
        </div>
        <span className="rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primarySoft">Procurar</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          required
          className="hidden"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "Importando..." : "Importar registro diario"}
      </button>

      {message ? <p className="text-xs font-semibold text-emerald-400">{message}</p> : null}
    </form>
  );
}
