import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  label: string;
}

export function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-6 py-4 border-b-2 transition-all duration-200 font-medium whitespace-nowrap",
        active
          ? "border-indigo-500 text-indigo-400 bg-indigo-500/5 shadow-[inset_0_-2px_0_0_rgba(99,102,241,1)]"
          : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
      )}
    >
      {Icon && <Icon size={18} className={active ? "text-indigo-400 shake-on-hover" : "text-slate-500"} />}
      <span>{label}</span>
    </button>
  );
}
