import React from 'react';
import { RotateCcw } from 'lucide-react';

export type AppSection =
  | 'simulator'
  | 'energy'
  | 'performance'
  | 'lab'
  | 'learn';

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'simulator', label: '3D Simulator' },
  { id: 'energy', label: 'Energy Chain' },
  { id: 'performance', label: 'Performance' },
  { id: 'lab', label: 'Physics Lab' },
  { id: 'learn', label: 'Compare & Learn' },
];

interface TopBarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onResetAll: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSelectSection,
  onResetAll,
}) => {
  return (
    <header className="h-14 border-b border-slate-800/90 bg-[#070B12] px-4 lg:px-6 flex items-center justify-between gap-8 shrink-0 z-30">
      {/* Zone 1: Single-element Brand Wordmark */}
      <a
        href="#simulator"
        onClick={(e) => {
          e.preventDefault();
          onSelectSection('simulator');
        }}
        className="font-display text-base lg:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
      >
        HYDRODRIVE <span className="text-cyan-400">3D</span>
      </a>

      {/* Zone 2: Clean single-line navigation links */}
      <nav aria-label="Primary sections" className="hidden md:flex items-center gap-6 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          Reset Simulation
        </button>
      </div>
    </header>
  );
};

export const MobileNavStrip: React.FC<{
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
}> = ({ activeSection, onSelectSection }) => (
  <nav
    aria-label="Mobile sections"
    className="md:hidden flex items-center gap-1 px-3 py-1.5 border-b border-slate-800 bg-[#0A101B] overflow-x-auto"
  >
    {NAV_ITEMS.map((item) => {
      const active = activeSection === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectSection(item.id)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
            active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'
          }`}
        >
          {item.label}
        </button>
      );
    })}
  </nav>
);
