"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = ["#895af6", "#6d38e0", "#4f7cff", "#14b8a6", "#f59e0b", "#ef4444"];

export function DisciplinePie({ data }: { data: Array<{ discipline: string; questions: number }> }) {
  return (
    <div className="h-80 rounded-2xl border border-primary/20 bg-[#161126] p-5">
      <p className="mb-4 text-sm font-bold text-slate-300">Desempenho por disciplina</p>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="questions" nameKey="discipline" innerRadius={65} outerRadius={95}>
            {data.map((entry, idx) => (
              <Cell key={entry.discipline} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#120e20", border: "1px solid #533f87", color: "#f8fafc" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
