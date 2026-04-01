import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { Portal } from './Portal';

export type DateRangeValue = {
  from?: string;
  to?: string;
};

type Preset = {
  key: string;
  label: string;
  getRange: (today: Date) => { from: Date; to: Date };
};

const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');

const parseISODateOrNull = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const dt = parseISO(raw);
    return Number.isFinite(dt.getTime()) ? dt : null;
  } catch {
    return null;
  }
};

const DEFAULT_PRESETS: Preset[] = [
  { key: 'today', label: 'Hoje', getRange: (t) => ({ from: t, to: t }) },
  { key: 'yesterday', label: 'Ontem', getRange: (t) => ({ from: subDays(t, 1), to: subDays(t, 1) }) },
  { key: 'last7', label: 'Últimos 7 dias', getRange: (t) => ({ from: subDays(t, 6), to: t }) },
  {
    key: 'thisWeek',
    label: 'Esta semana',
    getRange: (t) => ({
      from: startOfWeek(t, { weekStartsOn: 1 }),
      to: endOfWeek(t, { weekStartsOn: 1 }),
    }),
  },
  { key: 'thisMonth', label: 'Este mês', getRange: (t) => ({ from: startOfMonth(t), to: endOfMonth(t) }) },
  {
    key: 'lastMonth',
    label: 'Mês passado',
    getRange: (t) => {
      const base = subMonths(t, 1);
      return { from: startOfMonth(base), to: endOfMonth(base) };
    },
  },
];

function buildMonthGrid(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: 42 }).map((_, i) => addDays(start, i));
}

function formatRangeLabel(value?: DateRangeValue, placeholder?: string) {
  const from = parseISODateOrNull(value?.from);
  const to = parseISODateOrNull(value?.to);
  if (!from || !to) return placeholder || 'Selecionar período';
  const left = format(from, 'dd/MM/yyyy');
  const right = format(to, 'dd/MM/yyyy');
  return `${left} até ${right}`;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  disabled,
  presets = DEFAULT_PRESETS,
  className,
  align = 'right',
}: {
  value?: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  placeholder?: string;
  disabled?: boolean;
  presets?: Preset[];
  className?: string;
  align?: 'left' | 'right';
}) {
  const today = useMemo(() => new Date(), []);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(today));
  const [draftFrom, setDraftFrom] = useState<Date | null>(() => parseISODateOrNull(value?.from));
  const [draftTo, setDraftTo] = useState<Date | null>(() => parseISODateOrNull(value?.to));
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });

  const hasValue = Boolean(value?.from && value?.to);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    
    // Atualiza o rascunho com o valor real ao abrir
    const from = parseISODateOrNull(value?.from);
    const to = parseISODateOrNull(value?.to);
    setDraftFrom(from);
    setDraftTo(to);
    setMonthStart(startOfMonth(from || today));

    // Calcula posição para o Portal
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 640; // Reduzido para 640px
    const dropdownHeight = 360; // Altura aproximada do calendário + presets
    
    let top = rect.bottom + window.scrollY + 8;
    let left = align === 'left' ? rect.left : rect.right - dropdownWidth;
    
    // Ajuste se sair da tela (viewport check horizontal)
    if (left < 16) left = 16;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = window.innerWidth - dropdownWidth - 16;
    }

    // Ajuste se sair da tela (viewport check vertical)
    if (rect.bottom + dropdownHeight > window.innerHeight - 16) {
      top = rect.top + window.scrollY - dropdownHeight - 8;
    }

    setPopoverPos({ top, left, width: dropdownWidth });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', handleDown);
    return () => window.removeEventListener('mousedown', handleDown);
  }, [open]);

  const leftMonth = monthStart;
  const rightMonth = addMonths(monthStart, 1);
  const leftGrid = useMemo(() => buildMonthGrid(leftMonth), [leftMonth]);
  const rightGrid = useMemo(() => buildMonthGrid(rightMonth), [rightMonth]);

  const selectedInterval =
    draftFrom && draftTo
      ? {
          start: isBefore(draftFrom, draftTo) ? draftFrom : draftTo,
          end: isAfter(draftFrom, draftTo) ? draftFrom : draftTo,
        }
      : null;

  const applyPreset = (preset: Preset) => {
    const range = preset.getRange(new Date());
    onChange({ from: toISODate(range.from), to: toISODate(range.to) });
    setOpen(false);
  };

  const clear = () => {
    onChange({ from: '', to: '' });
  };

  const onDayClick = (day: Date) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }

    if (isSameDay(day, draftFrom)) {
      setDraftTo(day);
      return;
    }

    if (isBefore(day, draftFrom)) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
      return;
    }

    setDraftTo(day);
  };

  const applyDraft = () => {
    if (!draftFrom || !draftTo) return;
    onChange({ from: toISODate(draftFrom), to: toISODate(draftTo) });
    setOpen(false);
  };

  const renderMonth = (month: Date, days: Date[]) => {
    const monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR });
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
      <div className="w-[210px]">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-[13px] font-black uppercase text-slate-100 tracking-wider">
            {monthLabel}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-500 mb-1">
          {weekDays.map((w, idx) => (
            <div key={idx} className="text-center py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d) => {
            const inMonth = isSameMonth(d, month);
            const isStart = Boolean(selectedInterval && isSameDay(d, selectedInterval.start));
            const isEnd = Boolean(selectedInterval && isSameDay(d, selectedInterval.end));
            const inRange = Boolean(
              selectedInterval && isWithinInterval(d, { start: selectedInterval.start, end: selectedInterval.end }),
            );
            const isSingle = Boolean(draftFrom && draftTo && isSameDay(draftFrom, draftTo) && isSameDay(d, draftFrom));

            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => onDayClick(d)}
                className={clsx(
                  'h-7 w-7 rounded-lg text-[11px] transition-all flex items-center justify-center font-bold',
                  !inMonth && 'text-slate-700 opacity-30 hover:opacity-100',
                  inMonth && 'text-slate-300 hover:bg-slate-800',
                  inRange && 'bg-indigo-500/10 text-indigo-300',
                  (isStart || isEnd || isSingle) && 'bg-indigo-600 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20',
                )}
                title={format(d, 'dd/MM/yyyy')}
              >
                {format(d, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const label = formatRangeLabel(value, placeholder);

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-between gap-3 shadow-inner hover:border-slate-700 transition-all',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        aria-label="Selecionar período"
        title={label}
      >
        <span className={clsx('flex items-center gap-2 min-w-0 text-sm font-medium', !hasValue && 'text-slate-500')}>
          <Calendar size={16} className={clsx(hasValue ? 'text-indigo-400' : 'text-slate-500')} />
          <span className="truncate">{label}</span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          {hasValue && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              title="Limpar período"
            >
              <X size={14} />
            </button>
          )}
          <ChevronRight size={14} className={clsx('text-slate-600 transition-transform', open && 'rotate-90')} />
        </span>
      </button>

      {open && (
        <Portal>
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
            }}
            className="z-[9999] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock size={12} className="text-indigo-400" />
                Definir Faixa de Tempo
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMonthStart((m) => subMonths(m, 1))}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setMonthStart((m) => addMonths(m, 1))}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex">
              <div className="w-[160px] border-r border-slate-700 bg-slate-900/50 p-3 space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">Atalhos</div>
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4">
                <div className="flex gap-4 items-start">
                  {renderMonth(leftMonth, leftGrid)}
                  <div className="w-[210px] hidden md:block">
                    {renderMonth(rightMonth, rightGrid)}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {draftFrom && draftTo ? (
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-500">De {format(draftFrom, 'dd/MM/yyyy')}</span>
                    <ArrowRight size={10} />
                    <span className="text-emerald-500">Até {format(draftTo, 'dd/MM/yyyy')}</span>
                  </span>
                ) : draftFrom ? (
                  <span>Selecione a data final...</span>
                ) : (
                  <span>Aguardando seleção...</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={!draftFrom || !draftTo}
                  className={clsx(
                    'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg',
                    (!draftFrom || !draftTo) 
                      ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20 active:scale-95',
                  )}
                >
                  Confirmar Período
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

const ArrowRight = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

