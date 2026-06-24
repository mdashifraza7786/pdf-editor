import React from 'react';
import { ShieldCheck, History, Settings, LayoutGrid, Cpu, UserCheck } from 'lucide-react';
import { LicenseStatus } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  license: LicenseStatus;
}

export default function Layout({ children, activePath, onNavigate, license }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans bg-grid-overlay">
      {/* SIDEBAR */}
      <aside className="w-64 glass-panel border-r border-border flex flex-col justify-between z-10">
        <div>
          {/* LOGO */}
          <div className="p-6 flex items-center gap-3 border-b border-border/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tight">
                iLovePDF<span className="text-primary font-bold text-xs ml-0.5">LOCAL</span>
              </h1>
              <p className="text-[10px] text-muted-foreground mt-1 font-bold tracking-wider uppercase">Offline Processing</p>
            </div>
          </div>

          {/* NAV LINKS */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => onNavigate('/')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activePath === '/'
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[14px] font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              All Tools
            </button>

            <button
              onClick={() => onNavigate('/history')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activePath === '/history'
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[14px] font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <History className="w-4 h-4" />
              History Logs
            </button>

            <button
              onClick={() => onNavigate('/settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activePath === '/settings'
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[14px] font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </nav>
        </div>

        {/* LICENSE FOOTER TAG */}
        <div className="p-4 border-t border-border/80">
          <div className={`p-4 rounded-xl flex flex-col gap-2 ${
            license.isPro
              ? 'bg-primary/5 border border-primary/20 shadow-inner'
              : 'bg-secondary/40 border border-border shadow-inner'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">License status</span>
              {license.isPro ? (
                <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-primary/20 shadow-sm">
                  PRO MEMBER
                </span>
              ) : (
                <span className="bg-secondary text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-md border border-border">
                  FREE TIER
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {license.isPro ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-xs font-bold text-foreground">Unlimited Active</p>
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Basic Features Active</p>
                    <button
                      onClick={() => onNavigate('/settings')}
                      className="text-[10px] text-primary hover:text-primary/80 font-bold mt-0.5 underline text-left block"
                    >
                      Unlock limits with Pro Key
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* WORKSPACE CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 z-10 glass-panel">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">100% Offline Secured</span>
          </div>
          <div className="text-xs text-muted-foreground font-bold">
            Version 1.0.0
          </div>
        </header>

        {/* DYNAMIC SCROLL CONTAINER */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
