'use client';

interface Alert {
  id: string | number;
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
  time?: string;
  action?: { label: string; onClick: () => void };
}

interface AlertsPanelProps {
  title?: string;
  alerts: Alert[];
}

const typeStyles = {
  warning: { border: 'border-l-yellow-500', dot: 'bg-yellow-500' },
  info: { border: 'border-l-blue-500', dot: 'bg-blue-500' },
  success: { border: 'border-l-green-500', dot: 'bg-green-500' },
  error: { border: 'border-l-red-500', dot: 'bg-red-500' },
};

export default function AlertsPanel({ title = 'Alerts', alerts }: AlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-white/5 border-2 border-white/10 p-5">
      <h3 className="text-xs font-display font-bold uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {title}
      </h3>
      <div className="space-y-2.5">
        {alerts.map((alert) => {
          const s = typeStyles[alert.type];
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-3 bg-white/5 border-l-[3px] ${s.border}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80">{alert.message}</p>
                {alert.time && <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{alert.time}</p>}
              </div>
              {alert.action && (
                <button
                  onClick={alert.action.onClick}
                  className="text-xs font-bold text-accent hover:underline whitespace-nowrap uppercase tracking-wider"
                >
                  {alert.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
