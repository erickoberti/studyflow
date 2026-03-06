"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = ["#0f6ad9", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#14b8a6"];

export function DisciplinePie({ data }: { data: Array<{ discipline: string; questions: number }> }) {
  return (
    <div className="h-72 rounded-card border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Distribuição por disciplina</p>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="questions" nameKey="discipline" innerRadius={65} outerRadius={95}>
            {data.map((entry, idx) => (
              <Cell key={entry.discipline} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

