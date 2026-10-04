"use client";

import { format, parseISO } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EvolutionChart({
  data,
  label,
}: {
  data: Array<{ date: string; percentage: number }>;
  label: string;
}) {
  const chartData = data.map((item) => ({
    ...item,
    shortDate: format(parseISO(item.date), "dd/MM"),
  }));

  return (
    <div className="h-80 rounded-2xl border bg-surface p-5">
      <p className="mb-4 text-sm font-bold text-textSecondary">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 6, right: 16, left: -10, bottom: 16 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.45} />
          <XAxis dataKey="shortDate" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} minTickGap={20} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="percentage" stroke="rgb(var(--primary-rgb))" strokeWidth={3} dot={{ r: 2, fill: "rgb(var(--navigation-rgb))" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
