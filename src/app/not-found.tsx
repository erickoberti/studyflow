import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-backgroundLight p-5 dark:bg-backgroundDark"><section className="max-w-md text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Erro 404</p><h1 className="mt-2 text-4xl font-semibold">Página não encontrada</h1><p className="mt-3 text-textSecondary">O endereço pode ter mudado ou não está disponível neste guia.</p><Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Voltar ao painel</Link></section></main>;
}
