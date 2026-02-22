"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export default function StrendexChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Radar
          name="Strendex"
          dataKey="value"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}