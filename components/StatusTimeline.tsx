'use client';

interface TimelineStep {
  label: string;
  time?: string;
  completed: boolean;
  active?: boolean;
}

interface StatusTimelineProps {
  steps: TimelineStep[];
}

export default function StatusTimeline({ steps }: StatusTimelineProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center flex-1 last:flex-none">
          {/* Step circle + label */}
          <div className="flex flex-col items-center">
            <div
              className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                step.completed
                  ? 'bg-accent border-accent text-black'
                  : step.active
                  ? 'bg-transparent border-accent text-accent'
                  : 'bg-transparent border-white/20 text-white/40'
              }`}
            >
              {step.completed ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <p className={`text-[10px] mt-1.5 text-center max-w-[80px] uppercase tracking-wider ${step.completed ? 'text-accent font-bold' : step.active ? 'text-accent font-bold' : 'text-white/40'}`}>
              {step.label}
            </p>
            {step.time && <p className="text-[10px] text-white/30 mt-0.5">{step.time}</p>}
          </div>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${step.completed ? 'bg-accent' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
