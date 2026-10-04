"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = ["rgb(var(--primary-rgb))", "rgb(var(--navigation-rgb))", "#5b8cff", "rgb(var(--success-rgb))", "rgb(var(--warning-rgb))", "rgb(var(--critical-rgb))", "#22c55e", "#ec4899"];

export function DisciplinePie({ data }: { data: Array<{ discipline: string; questions: number }> }) {
  const safeData = data.filter((item) => item.questions > 0);

  return (
    <div className="h-80 rounded-2xl border bg-surface p-5">
      <p className="mb-4 text-sm font-bold text-textSecondary">Desempenho por disciplina</p>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 20, left: 20, bottom: 20 }}>
          <Pie data={safeData} dataKey="questions" nameKey="discipline" innerRadius={62} outerRadius={94} minAngle={4} paddingAngle={1}>
            {safeData.map((entry, idx) => (
              <Cell key={entry.discipline} fill={colors[idx % colors.length]} stroke="var(--surface)" strokeOpacity={0.8} strokeWidth={1.2} />
            ))}
          </Pie>
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 30 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
