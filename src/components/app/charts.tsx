"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

const PALETTE = ["#0f2a4a", "#3b82c4", "#60a5fa", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b", "#22c55e", "#0ea5e9"];
const tooltipStyle = { fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl" as const };

export function MonthlyChart({ data }: { data: { month: string; submitted: number; accepted: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "Cairo" }} reversed />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} orientation="right" width={30} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#eef4fb" }} />
        <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: 12 }} />
        <Bar dataKey="submitted" name="الأبحاث المقدمة" fill="#0f2a4a" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="accepted" name="المقبولة / المنشورة" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend layout="vertical" align="left" verticalAlign="middle" wrapperStyle={{ fontFamily: "Cairo", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, name = "العدد" }: { data: { name: string; value: number }[]; name?: string }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-muted-foreground">لا توجد بيانات</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} reversed />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fontFamily: "Cairo" }} orientation="right" />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#eef4fb" }} />
        <Bar dataKey="value" name={name} fill="#3b82c4" radius={[4, 0, 0, 4]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
