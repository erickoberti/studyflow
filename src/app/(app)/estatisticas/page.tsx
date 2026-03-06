import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics";

function priorityLabel(priority: string) {
  if (priority === "urgente") return "Urgente (<60%)";
  if (priority === "atencao") return "Atenção (60-69%)";
  if (priority === "bom") return "Bom (70-79%)";
  return "Forte (80%+)";
}

export default async function EstatisticasPage() {
  const user = await requireUser();
  const dashboard = await getDashboardData(user.id);

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-black text-ink dark:text-white">Painel por disciplina</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Disciplina</th>
                <th className="py-2">Questões</th>
                <th className="py-2">Acertos</th>
                <th className="py-2">Percentual</th>
                <th className="py-2">Faixa</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.disciplineStats.map((item) => (
                <tr key={item.discipline} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2">{item.discipline}</td>
                  <td className="py-2">{item.questions}</td>
                  <td className="py-2">{item.correct}</td>
                  <td className="py-2">{item.percentage.toFixed(1)}%</td>
                  <td className="py-2">{priorityLabel(item.priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-black text-ink dark:text-white">Painel por assunto</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Assunto</th>
                <th className="py-2">Disciplina</th>
                <th className="py-2">Questões</th>
                <th className="py-2">Peso</th>
                <th className="py-2">Percentual</th>
                <th className="py-2">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.subjectStats.map((item) => (
                <tr key={`${item.discipline}-${item.subject}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2">{item.subject}</td>
                  <td className="py-2">{item.discipline}</td>
                  <td className="py-2">{item.questions}</td>
                  <td className="py-2">{item.weight}</td>
                  <td className="py-2">{item.percentage.toFixed(1)}%</td>
                  <td className="py-2">{priorityLabel(item.priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
