'use client';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-white/10 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-4 py-2.5 text-xs font-display uppercase tracking-widest border-b-2 transition-all relative -mb-[1px] ${
            activeTab === tab.key
              ? 'border-accent text-accent font-bold'
              : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/20'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-2 px-2 py-0.5 text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white/40'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
