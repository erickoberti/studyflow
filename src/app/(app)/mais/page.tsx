import shell from "@/components/official-shell.module.css";
import visual from "@/components/resource-screens.module.css";
import Link from "next/link";
import { BarChart3, BookOpen, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, FolderKanban, History, ListChecks, Settings, Target } from "lucide-react";

const items = [{ href: "/base", label: "Disciplinas", detail: "Matérias e assuntos do guia", icon: BookOpen }, { href: "/debug/ciclo?simular=200", label: "Verificar ciclo", detail: "Cobertura, sequência e projeção até a prova", icon: CheckCircle2 }, { href: "/registros", label: "Histórico", detail: "Aulas, questões e tempo estudado", icon: ListChecks }, { href: "/metas", label: "Metas", detail: "Foco de hoje e consistência", icon: Target }, { href: "/revisao", label: "Revisões", detail: "Pendências e histórico", icon: History }, { href: "/estatisticas", label: "Estatísticas", detail: "Evolução e desempenho", icon: BarChart3 }, { href: "/simulados", label: "Simulados", detail: "Resultados separados", icon: ClipboardCheck }, { href: "/planejamento", label: "Planejamento", detail: "Edital e rota até a prova", icon: CalendarClock }, { href: "/guias", label: "Guias", detail: "Concursos e planos separados", icon: FolderKanban }, { href: "/configuracoes", label: "Configurações", detail: "Preferências do guia", icon: Settings }];
export default function MorePage() {
  return <div className={`${shell.screen} ${visual.page} ${visual.more}`}>
    <header><span className={visual.eyebrow}>Seu espaço de estudo</span><h1>Mais recursos</h1><p>Organize seu plano, acompanhe os resultados e ajuste suas preferências.</p></header>
    <nav aria-label="Mais recursos" className={visual.resourceGrid}>{items.map((item) => {
      const Icon = item.icon;
      return <Link key={item.href} href={item.href} className={visual.resourceLink}><span className={visual.resourceIcon}><Icon size={20}/></span><span className={visual.resourceText}><strong>{item.label}</strong><span>{item.detail}</span></span><ChevronRight size={18} className="shrink-0 text-textSecondary"/></Link>;
    })}</nav>
  </div>;
}