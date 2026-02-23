"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface ChartProps {
  data: { subject: string; value: number }[];
}

export default function StrendexChart({ data }: ChartProps) {
  return (
    <div className="w-full h-[400px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} 
          />
          <Radar
            name="Performance"
            dataKey="value"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}