import Link from "next/link";

export default function ForgotPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-card border border-slate-200 bg-surface p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Recuperar senha</h1>
        <p className="mt-1 text-sm text-textSecondary">A recuperação de senha está temporariamente indisponível.</p>
        <Link href="/auth/login" className="mt-3 block text-sm text-brand hover:underline">
          Voltar para login
        </Link>
      </div>
    </div>
  );
}
