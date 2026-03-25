import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { clsx } from 'clsx';

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
  {
    key: 'lastWeek',
    label: 'Semana passada',
    getRange: (t) => {
      const base = subWeeks(t, 1);
      return {
        from: startOfWeek(base, { weekStartsOn: 1 }),
        to: endOfWeek(base, { weekStartsOn: 1 }),
      };
    },
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
  { key: 'thisYear', label: 'Este ano', getRange: (t) => ({ from: startOfYear(t), to: endOfYear(t) }) },
  {
    key: 'lastYear',
    label: 'Ano passado',
    getRange: (t) => {
      const base = subYears(t, 1);
      return { from: startOfYear(base), to: endOfYear(base) };
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
}: {
  value?: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  placeholder?: string;
  disabled?: boolean;
  presets?: Preset[];
  className?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(today));
  const [draftFrom, setDraftFrom] = useState<Date | null>(() => parseISODateOrNull(value?.from));
  const [draftTo, setDraftTo] = useState<Date | null>(() => parseISODateOrNull(value?.to));

  const hasValue = Boolean(value?.from && value?.to);

  useEffect(() => {
    if (!open) return;
    const from = parseISODateOrNull(value?.from);
    const to = parseISODateOrNull(value?.to);
    setDraftFrom(from);
    setDraftTo(to);
    setMonthStart(startOfMonth(from || today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

    // second click
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
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    return (
      <div className="w-[280px]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-200 capitalize">{monthLabel}</div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
          {weekDays.map((w) => (
            <div key={w} className="text-center py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
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
                  'h-9 w-9 rounded-md text-sm transition-colors flex items-center justify-center',
                  !inMonth && 'text-slate-600 hover:text-slate-300',
                  inMonth && 'text-slate-200 hover:bg-slate-800',
                  inRange && 'bg-indigo-500/15',
                  (isStart || isEnd || isSingle) && 'bg-indigo-600 text-white hover:bg-indigo-600',
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
          'w-full px-3 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between gap-3',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        aria-label="Selecionar período"
        title={label}
      >
        <span className={clsx('flex items-center gap-2 min-w-0', !hasValue && 'text-slate-400')}>
          <Calendar size={16} className={clsx(hasValue ? 'text-indigo-300' : 'text-slate-500')} />
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
              className="p-1 rounded hover:bg-slate-800 text-slate-300"
              title="Limpar período"
              aria-label="Limpar período"
            >
              <X size={14} />
            </button>
          )}
          <ChevronRight size={16} className="text-slate-500" />
        </span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-[120] mt-2 w-[920px] max-w-[92vw] right-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Selecionar período</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthStart((m) => subMonths(m, 1))}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-200"
                title="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setMonthStart((m) => addMonths(m, 1))}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-200"
                title="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-200"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col lg:flex-row gap-4">
            <div className="flex gap-4 flex-1 overflow-x-auto">
              {renderMonth(leftMonth, leftGrid)}
              {renderMonth(rightMonth, rightGrid)}
            </div>

            <div className="w-full lg:w-[240px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">Presets</div>
              <div className="grid gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-colors text-sm text-left"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setDraftFrom(null);
                    setDraftTo(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors text-sm text-left"
                >
                  Período customizado
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {draftFrom && draftTo ? (
                <span>
                  Selecionado: <b className="text-slate-200">{format(draftFrom, 'dd/MM/yyyy')}</b> até{' '}
                  <b className="text-slate-200">{format(draftTo, 'dd/MM/yyyy')}</b>
                </span>
              ) : draftFrom ? (
                <span>
                  Selecione a data final (início: <b className="text-slate-200">{format(draftFrom, 'dd/MM/yyyy')}</b>)
                </span>
              ) : (
                <span>Selecione a data inicial.</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyDraft}
                disabled={!draftFrom || !draftTo}
                className={clsx(
                  'px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors',
                  (!draftFrom || !draftTo) && 'opacity-60 cursor-not-allowed',
                )}
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

