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
    <div className="flex items-center justify-between gap-2 bg-slate-900 py-0.5 px-3 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-3">
        <div className={clsx("w-7 h-7 rounded flex items-center justify-center border", iconColorClass)}>
          <Icon size={16} />
        </div>
        <h1 className="text-[11px] font-black text-white tracking-tight uppercase">{title}</h1>
        
        {tabs && onTabChange && (
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 ml-2">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-all",
                    isActive 
                      ? clsx("text-white", activeTabColorClass || "bg-indigo-600 shadow-lg shadow-indigo-900/20")
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  )}
                >
                  <TabIcon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
