import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "@/app/(app)/ciclo/cycle-screen.module.css";

type CyclePosition = {
  position: number;
  matter: string;
  subject: string;
  status: string;
  current: boolean;
  next: boolean;
  completed?: boolean;
};

export function CycleOverview({ positions }: { positions: CyclePosition[] }) {
  return <nav className={styles.overview} aria-label="Mapa do ciclo">
    <p>Localize uma posição <span>· selecione o número para ver na sequência</span></p>
    <ol className={styles.map}>
      {positions.map(item => <li key={item.position}>
        <a href={`#cycle-position-${item.position}`} data-current={item.current} data-next={item.next} data-completed={item.completed} aria-current={item.current ? "step" : undefined} aria-label={`Posição ${item.position}: ${item.matter} → ${item.subject} · ${item.status}`}>
          {item.completed ? <Check size={12} aria-hidden="true" /> : null}<span>{item.position}</span>
        </a>
      </li>)}
    </ol>
    <div className={styles.legend}><span><i data-state="current" />Agora</span><span><i data-state="next" />A seguir</span>{positions.some(item => item.completed) ? <span><Check size={13} aria-hidden="true" />Concluída</span> : null}</div>
  </nav>;
}

export function CycleSequenceItem({ position, matter, subject, status, current, next, completed, children }: CyclePosition & { children: ReactNode }) {
  return <li id={`cycle-position-${position}`} tabIndex={-1} className={styles.row} data-current={current} data-next={next} data-completed={completed} aria-current={current ? "step" : undefined}>
    <span className={styles.position}>{position}</span>
    <details className={styles.rowContent}>
      <summary aria-label={`Detalhes da posição ${position}: ${matter} → ${subject}`}>
        <span className={styles.rowTitle}><strong>{matter}</strong> <span aria-hidden="true">→</span> {subject}</span>
        <span className={styles.status}>{completed ? <Check size={13} aria-hidden="true" /> : null}{status}</span>
        <ChevronDown size={16} className={styles.disclosure} aria-hidden="true" />
      </summary>
      <div className={styles.rowDetails}>{children}</div>
    </details>
  </li>;
}
