'use client';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'indigo';
  subtitle?: string;
}

export default function KPICard({ title, value, icon, trend, subtitle }: KPICardProps) {
  return (
    <div className="bg-white/5 border-2 border-white/10 p-5 relative group overflow-hidden hover:border-white/20 transition-colors h-full">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] font-display uppercase tracking-widest text-white/40 mb-2 font-bold">{title}</p>
          <p className="text-3xl font-black text-white tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend.positive ? 'text-accent' : 'text-red-400'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={trend.positive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
              </svg>
              {trend.value}
            </div>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 flex items-center justify-center shrink-0 text-white/20 group-hover:text-accent/30 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
