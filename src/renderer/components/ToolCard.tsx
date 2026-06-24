import React from 'react';
import * as Icons from 'lucide-react';
import { ToolInfo } from '../types';

interface ToolCardProps {
  tool: ToolInfo;
  onClick: () => void;
  isLocked: boolean;
}

export default function ToolCard({ tool, onClick, isLocked }: ToolCardProps) {
  // Dynamically resolve lucide icons
  const LucideIcon = (Icons as any)[tool.icon] || Icons.File;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start text-left p-6 rounded-2xl glass-panel glass-panel-hover transition-all duration-300 group overflow-hidden"
    >
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:to-primary/[0.03] transition-all duration-300 pointer-events-none" />

      {/* ICON */}
      <div className="p-3.5 rounded-xl bg-secondary border border-border text-foreground group-hover:border-primary/25 group-hover:text-primary group-hover:bg-primary/5 transition-all duration-300 shadow-sm">
        <LucideIcon className="w-6 h-6" />
      </div>

      {/* TEXT TITLE & DESCRIPTION */}
      <h3 className="font-bold text-foreground mt-5 leading-tight group-hover:text-primary transition-colors duration-200">
        {tool.name}
      </h3>
      <p className="text-xs text-muted-foreground mt-2 font-medium leading-relaxed">
        {tool.description}
      </p>

      {/* LOCK / PRO BADGE */}
      {tool.isPremium && (
        <span className={`absolute top-4 right-4 text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-wider border transition-all duration-300 ${
          isLocked
            ? 'bg-primary/10 text-primary border-primary/25 shadow-sm'
            : 'bg-secondary text-muted-foreground border-border'
        }`}>
          PRO
        </span>
      )}
    </button>
  );
}
