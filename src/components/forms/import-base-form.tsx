"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";

type FeedbackState =
  | { tone: "success"; text: string }
  | { tone: "error"; text: string }
  | null;

export function ImportBaseForm() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileRef.current?.files?.[0];
    if (!file) {
      const message = "Selecione um arquivo CSV.";
      setFeedback({ tone: "error", text: message });
      toast.error(message);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setFeedback(null);

      const response = await fetch("/api/import/base", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = data?.message ?? "Erro ao importar planilha.";
        setFeedback({ tone: "error", text: errorMessage });
        toast.error(errorMessage);
        return;
      }

      const successMessage = data?.message ?? "Planilha importada com sucesso.";
      setFeedback({ tone: "success", text: successMessage });
      toast.success(successMessage);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => {
        router.refresh();
      }, 900);
    } catch {
      const errorMessage = "Nao foi possivel enviar o arquivo agora. Tente novamente.";
      setFeedback({ tone: "error", text: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#120e20]">
        <p className="text-sm font-black text-slate-900 dark:text-white">Como importar</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#161126]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">1. Baixe o modelo</p>
            <a
              href="/api/import/base/template"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
            >
              <Download className="h-4 w-4" />
              Baixar modelo CSV
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#161126]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">2. Preencha estas colunas</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Seq, Assunto, Peso, Disciplina, Onde marcar no TEC</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#161126]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">3. Envie o arquivo</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Salve em CSV e envie aqui mesmo.</p>
          </div>
        </div>
      </div>

      <label className="block cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary/40 hover:bg-primary/5 dark:border-white/10 dark:bg-[#120e20] dark:hover:border-primary/50 dark:hover:bg-primary/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white">Arquivo CSV do ciclo</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {fileName || "Use o modelo baixado acima para evitar erro no formato."}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-black text-primary">
            <UploadCloud className="h-4 w-4" />
            {fileName ? "Trocar arquivo" : "Escolher CSV"}
          </div>
        </div>

        {fileName ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".csv"
          required
          className="hidden"
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
            setFeedback(null);
          }}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Importando planilha..." : "Importar planilha do ciclo"}
      </button>

      {feedback ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          }`}
        >
          {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>{feedback.text}</p>
        </div>
      ) : null}
    </form>
  );
}
