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
    <div className="h-80 rounded-2xl border border-primary/20 bg-[#161126] p-5">
      <p className="mb-4 text-sm font-bold text-slate-300">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 6, right: 16, left: -10, bottom: 16 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#5b4692" opacity={0.45} />
          <XAxis dataKey="shortDate" tick={{ fontSize: 11, fill: "#a8b3cf" }} minTickGap={20} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#a8b3cf" }} />
          <Tooltip
            contentStyle={{
              background: "#120e20",
              border: "1px solid #6d4ac7",
              color: "#f8fafc",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 2, fill: "#c4b5fd" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
