import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import type { WeeklyStudyTime } from "@/lib/daily-goals";
import { StudyProgress } from "./study-ui";
import styles from "./weekly-study-time.module.css";

function duration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)}h${remainder ? String(remainder).padStart(2, "0") : ""}`;
}

function WeeklyProgress({ week, detailed = false }: { week: WeeklyStudyTime; detailed?: boolean }) {
  const remaining = week.plannedMinutes - week.studiedMinutes;
  return <div>
    <div className={styles.progressHeading}>
      <p><strong>{duration(week.studiedMinutes)}</strong> de {duration(week.plannedMinutes)} planejadas</p>
      <span>{week.plannedMinutes === 0 ? "Sem meta de horas" : remaining > 0 ? `Faltam ${duration(remaining)}` : "Meta semanal atingida"}</span>
    </div>
    {week.plannedMinutes > 0 && <div className={styles.progressBar}>
      <StudyProgress label="Progresso da meta semanal de horas" value={week.studiedMinutes} max={week.plannedMinutes} />
      {detailed && <b>{Math.round(week.studiedMinutes * 100 / week.plannedMinutes)}%</b>}
    </div>}
  </div>;
}

export function StudyTimeCard({ week }: { week: WeeklyStudyTime }) {
  return <section className={styles.card} aria-labelledby="study-time-title">
    <header className={styles.header}>
      <h2 id="study-time-title">Tempo de estudo</h2>
      <Link href="/metas">Ver metas <ArrowRight size={16} aria-hidden /></Link>
    </header>
    <dl className={styles.averages}>
      <div>
        <dt><Clock3 size={18} aria-hidden /> Média diária</dt>
        <dd><strong>{duration(week.dailyAverage)}</strong><span>Nesta semana, até hoje</span></dd>
        <dd>Meta de hoje · {week.todayGoal === null ? "Descanso" : duration(week.todayGoal)}</dd>
      </div>
      <div>
        <dt><CalendarDays size={18} aria-hidden /> Média semanal</dt>
        <dd><strong>{duration(week.weeklyAverage)}</strong><span>Últimas 4 semanas completas</span></dd>
        <dd>Meta semanal · {duration(week.plannedMinutes)}</dd>
      </div>
    </dl>
    <p className={styles.period}>Nesta semana</p>
    <WeeklyProgress week={week} />
  </section>;
}

const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const rangeFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

export function WeeklyTimePlan({ week }: { week: WeeklyStudyTime }) {
  const columns = week.days.map((day, index) => ({
    ...day,
    label: `${labels[index]} ${Number(day.date.slice(-2))}`,
    planned: day.plannedMinutes === null ? "Descanso" : duration(day.plannedMinutes),
    studied: day.studiedMinutes === null ? "—" : duration(day.studiedMinutes),
  }));
  const first = new Date(week.days[0].date + "T12:00:00Z");
  const last = new Date(week.days[6].date + "T12:00:00Z");
  return <section className={styles.card} aria-labelledby="week-plan-title">
    <header className={styles.planHeader}>
      <h2 id="week-plan-title">Tempo de estudo na semana</h2>
      <p>{rangeFormat.formatRange(first, last)}</p>
    </header>
    <WeeklyProgress week={week} detailed />
    <table className={styles.desktopTable} aria-label="Tempo planejado e estudado de segunda a domingo">
      <thead><tr><td />{columns.map(day => <th scope="col" key={day.date} data-today={day.today}>
        {day.label}{day.today && <small>Hoje</small>}
      </th>)}</tr></thead>
      <tbody>
        <tr><th scope="row">Planejado</th>{columns.map(day => <td key={day.date} data-today={day.today}>{day.planned}</td>)}</tr>
        <tr><th scope="row">Estudado</th>{columns.map(day => <td key={day.date} data-today={day.today}>{day.studied}</td>)}</tr>
      </tbody>
    </table>
    <table className={styles.mobileTable} aria-label="Tempo planejado e estudado de segunda a domingo">
      <thead><tr><th scope="col">Dia</th><th scope="col">Planejado</th><th scope="col">Estudado</th></tr></thead>
      <tbody>{columns.map(day => <tr key={day.date} data-today={day.today}>
        <th scope="row">{day.label}{day.today && <small>Hoje</small>}</th><td>{day.planned}</td><td>{day.studied}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
