
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    default: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium border inline-flex items-center gap-1", styles[variant], className)}>
      {children}
    </span>
  );
}
