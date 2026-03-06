"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EvolutionChart({
  data,
  label,
}: {
  data: Array<{ date: string; percentage: number }>;
  label: string;
}) {
  return (
    <div className="h-80 rounded-2xl border border-primary/20 bg-[#161126] p-5">
      <p className="mb-4 text-sm font-bold text-slate-300">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#4b3b7a" opacity={0.4} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip contentStyle={{ background: "#120e20", border: "1px solid #533f87", color: "#f8fafc" }} />
          <Line type="monotone" dataKey="percentage" stroke="#895af6" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
