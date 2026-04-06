import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass?: string; // e.g. "text-emerald-400 bg-emerald-600/20 border-emerald-600/30"
  activeTabColorClass?: string; // e.g. "bg-emerald-600 shadow-emerald-900/20"
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: any) => void;
  actions?: React.ReactNode;
  statusText?: string;
  versionText?: string;
}

/**
 * ModuleHeader - Reusable header component for Dr.X modules.
 * Implements DRY and standardized UI patterns for top-level pages.
 */
export function ModuleHeader({
  title,
  subtitle,
  icon: Icon,
  iconColorClass = "text-emerald-400 bg-emerald-600/20 border-emerald-600/30",
  activeTabColorClass = "bg-emerald-600 shadow-lg shadow-emerald-900/20",
  tabs,
  activeTab,
  onTabChange,
  actions,
  statusText,
  versionText,
}: ModuleHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg shrink-0">
      <div className="flex items-center gap-3">
        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center border", iconColorClass)}>
          <Icon size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-slate-500 text-[10px] tracking-wider uppercase font-medium">{subtitle}</p>}
        </div>
      </div>

      {tabs && (
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap outline-none",
                  isActive
                    ? `${activeTabColorClass} text-white`
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        {actions}
        {(statusText || versionText) && (
          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3 ml-2">
            <div className="flex flex-col items-end">
              {statusText && <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black leading-tight">{statusText}</span>}
              {versionText && <span className="text-[9px] text-slate-500 font-mono leading-tight">{versionText}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
