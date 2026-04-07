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
  isValid,
  isWithinInterval,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
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
const toDisplayDate = (d: Date) => format(d, 'dd/MM/yyyy');

const normalizeDateRange = (from: Date, to: Date) =>
  isAfter(from, to) ? { from: to, to: from } : { from, to };

const parseFlexibleDateOrNull = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const candidates: Date[] = [];

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    candidates.push(parse(raw, 'yyyy-MM-dd', new Date()));
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    candidates.push(parse(raw, 'dd/MM/yyyy', new Date()));
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    candidates.push(parse(raw, 'dd-MM-yyyy', new Date()));
  }

  try {
    candidates.push(parseISO(raw));
  } catch {
    // ignore malformed values
  }

  for (const candidate of candidates) {
    if (isValid(candidate)) {
      return candidate;
    }
  }

  return null;
};

const isInputReadyForValidation = (value: string) => String(value || '').trim().length >= 8;

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
  const from = parseFlexibleDateOrNull(value?.from);
  const to = parseFlexibleDateOrNull(value?.to);

  if (from && to) {
    return `${toDisplayDate(from)} até ${toDisplayDate(to)}`;
  }

  if (from) {
    return `A partir de ${toDisplayDate(from)}`;
  }

  if (to) {
    return `Até ${toDisplayDate(to)}`;
  }

  return placeholder || 'Selecionar período';
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
  const [leftMonth, setLeftMonth] = useState<Date>(() => startOfMonth(today));
  const [rightMonth, setRightMonth] = useState<Date>(() => startOfMonth(addMonths(today, 1)));
  const [draftFrom, setDraftFrom] = useState<Date | null>(() => parseFlexibleDateOrNull(value?.from));
  const [draftTo, setDraftTo] = useState<Date | null>(() => parseFlexibleDateOrNull(value?.to));
  const [fromInput, setFromInput] = useState(() => (draftFrom ? toDisplayDate(draftFrom) : ''));
  const [toInput, setToInput] = useState(() => (draftTo ? toDisplayDate(draftTo) : ''));
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 16, width: 640 });

  const hasValue = Boolean(value?.from || value?.to);

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(window.innerWidth - 32, 860);
    const dropdownHeight = window.innerWidth < 768 ? 650 : 560;

    let top = rect.bottom + 8;
    let left = align === 'left' ? rect.left : rect.right - dropdownWidth;

    if (left < 16) left = 16;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = window.innerWidth - dropdownWidth - 16;
    }

    if (top + dropdownHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - dropdownHeight - 8);
    }

    setPopoverPos({ top, left, width: dropdownWidth });
  };

  useEffect(() => {
    if (!open) return;

    const from = parseFlexibleDateOrNull(value?.from);
    const to = parseFlexibleDateOrNull(value?.to);
    const nextLeft = startOfMonth(from || today);
    const nextRight = startOfMonth(to || addMonths(nextLeft, 1));

    setDraftFrom(from);
    setDraftTo(to);
    setFromInput(from ? toDisplayDate(from) : '');
    setToInput(to ? toDisplayDate(to) : '');
    setLeftMonth(nextLeft);
    setRightMonth(nextRight);

    updatePopoverPosition();

    const handleReposition = () => updatePopoverPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, value?.from, value?.to, today, align]);

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

  const leftGrid = useMemo(() => buildMonthGrid(leftMonth), [leftMonth]);
  const rightGrid = useMemo(() => buildMonthGrid(rightMonth), [rightMonth]);

  const selectedInterval =
    draftFrom && draftTo ? normalizeDateRange(draftFrom, draftTo) : null;

  const parsedFromInput = parseFlexibleDateOrNull(fromInput);
  const parsedToInput = parseFlexibleDateOrNull(toInput);
  const fromInputInvalid = Boolean(fromInput.trim()) && isInputReadyForValidation(fromInput) && !parsedFromInput;
  const toInputInvalid = Boolean(toInput.trim()) && isInputReadyForValidation(toInput) && !parsedToInput;
  const canApplyDraft = Boolean(parsedFromInput && parsedToInput);

  const syncInputFromDate = (field: 'from' | 'to', date: Date | null) => {
    const formatted = date ? toDisplayDate(date) : '';
    if (field === 'from') {
      setFromInput(formatted);
      return;
    }
    setToInput(formatted);
  };

  const clear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    setFromInput('');
    setToInput('');
    onChange({ from: '', to: '' });
  };

  const applyPreset = (preset: Preset) => {
    const range = normalizeDateRange(...Object.values(preset.getRange(new Date())));
    setDraftFrom(range.from);
    setDraftTo(range.to);
    setFromInput(toDisplayDate(range.from));
    setToInput(toDisplayDate(range.to));
    setLeftMonth(startOfMonth(range.from));
    setRightMonth(startOfMonth(range.to));
    onChange({ from: toISODate(range.from), to: toISODate(range.to) });
    setOpen(false);
  };

  const handleManualInputChange = (field: 'from' | 'to', raw: string) => {
    if (field === 'from') {
      setFromInput(raw);
    } else {
      setToInput(raw);
    }

    const parsed = parseFlexibleDateOrNull(raw);

    if (!raw.trim()) {
      if (field === 'from') {
        setDraftFrom(null);
      } else {
        setDraftTo(null);
      }
      return;
    }

    if (!parsed) {
      if (field === 'from') {
        setDraftFrom(null);
      } else {
        setDraftTo(null);
      }
      return;
    }

    if (field === 'from') {
      setDraftFrom(parsed);
      setLeftMonth(startOfMonth(parsed));
    } else {
      setDraftTo(parsed);
      setRightMonth(startOfMonth(parsed));
    }
  };

  const handleManualInputBlur = (field: 'from' | 'to') => {
    const raw = field === 'from' ? fromInput : toInput;
    const parsed = parseFlexibleDateOrNull(raw);
    if (!raw.trim() || !parsed) return;
    syncInputFromDate(field, parsed);
  };

  const onDayClick = (day: Date) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      syncInputFromDate('from', day);
      syncInputFromDate('to', null);
      return;
    }

    if (isSameDay(day, draftFrom)) {
      setDraftTo(day);
      syncInputFromDate('to', day);
      return;
    }

    if (isBefore(day, draftFrom)) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
      syncInputFromDate('from', day);
      syncInputFromDate('to', draftFrom);
      return;
    }

    setDraftTo(day);
    syncInputFromDate('to', day);
  };

  const applyDraft = () => {
    if (!parsedFromInput || !parsedToInput) return;
    const normalized = normalizeDateRange(parsedFromInput, parsedToInput);
    setDraftFrom(normalized.from);
    setDraftTo(normalized.to);
    setFromInput(toDisplayDate(normalized.from));
    setToInput(toDisplayDate(normalized.to));
    onChange({ from: toISODate(normalized.from), to: toISODate(normalized.to) });
    setOpen(false);
  };

  const renderMonth = ({
    month,
    days,
    onPrev,
    onNext,
  }: {
    month: Date;
    days: Date[];
    onPrev: () => void;
    onNext: () => void;
  }) => {
    const monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR });
    const weekDays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

    return (
      <div className="w-full min-w-0 md:w-[248px]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="truncate text-center text-[13px] font-black uppercase tracking-wider text-slate-100">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-500">
          {weekDays.map((w, idx) => (
            <div key={`${monthLabel}-${idx}`} className="py-1 text-center">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d) => {
            const inMonth = isSameMonth(d, month);
            const isStart = Boolean(selectedInterval && isSameDay(d, selectedInterval.from));
            const isEnd = Boolean(selectedInterval && isSameDay(d, selectedInterval.to));
            const inRange = Boolean(
              selectedInterval &&
                isWithinInterval(d, { start: selectedInterval.from, end: selectedInterval.to }),
            );
            const isSingle =
              Boolean(draftFrom && draftTo && isSameDay(draftFrom, draftTo) && isSameDay(d, draftFrom));

            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => onDayClick(d)}
                className={clsx(
                  'flex h-9 w-full items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                  !inMonth && 'text-slate-700 opacity-35 hover:opacity-100',
                  inMonth && 'text-slate-300 hover:bg-slate-800',
                  inRange && 'bg-indigo-500/10 text-indigo-300',
                  (isStart || isEnd || isSingle) &&
                    'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600',
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
          'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-inner transition-all hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        aria-label="Selecionar período"
        title={label}
      >
        <span className={clsx('flex min-w-0 items-center gap-2 text-sm font-medium', !hasValue && 'text-slate-500')}>
          <Calendar size={16} className={clsx(hasValue ? 'text-indigo-400' : 'text-slate-500')} />
          <span className="truncate">{label}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {hasValue && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
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
              maxWidth: 'calc(100vw - 32px)',
            }}
            className="z-[9999] overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="border-b border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Clock size={12} className="text-indigo-400" />
                  Definir Faixa de Tempo
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="self-start rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Data inicial
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fromInput}
                    onChange={(e) => handleManualInputChange('from', e.target.value)}
                    onBlur={() => handleManualInputBlur('from')}
                    placeholder="dd/mm/aaaa ou aaaa-mm-dd"
                    className={clsx(
                      'w-full rounded-xl border bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-indigo-500/20',
                      fromInputInvalid
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-slate-800 focus:border-indigo-500',
                    )}
                  />
                  {fromInputInvalid && (
                    <p className="text-[11px] text-red-300">Informe uma data inicial válida.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Data final
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={toInput}
                    onChange={(e) => handleManualInputChange('to', e.target.value)}
                    onBlur={() => handleManualInputBlur('to')}
                    placeholder="dd/mm/aaaa ou aaaa-mm-dd"
                    className={clsx(
                      'w-full rounded-xl border bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-indigo-500/20',
                      toInputInvalid
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-slate-800 focus:border-indigo-500',
                    )}
                  />
                  {toInputInvalid && (
                    <p className="text-[11px] text-red-300">Informe uma data final válida.</p>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Você pode digitar manualmente as datas ou usar os calendários abaixo. Os meses agora navegam de forma independente.
              </p>
            </div>

            <div className="flex max-h-[70vh] flex-col overflow-y-auto md:flex-row">
              <div className="border-b border-slate-800 bg-slate-900/50 p-3 md:w-[180px] md:border-b-0 md:border-r">
                <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Atalhos
                </div>
                <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left text-[11px] font-bold text-slate-300 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-400"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {renderMonth({
                    month: leftMonth,
                    days: leftGrid,
                    onPrev: () => setLeftMonth((current) => subMonths(current, 1)),
                    onNext: () => setLeftMonth((current) => addMonths(current, 1)),
                  })}
                  <div className="hidden md:block">
                    {renderMonth({
                      month: rightMonth,
                      days: rightGrid,
                      onPrev: () => setRightMonth((current) => subMonths(current, 1)),
                      onNext: () => setRightMonth((current) => addMonths(current, 1)),
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-800 bg-slate-950/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {selectedInterval ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-emerald-500">De {toDisplayDate(selectedInterval.from)}</span>
                    <ArrowRight size={10} />
                    <span className="text-emerald-500">Até {toDisplayDate(selectedInterval.to)}</span>
                  </span>
                ) : draftFrom ? (
                  <span>Selecione ou digite a data final.</span>
                ) : (
                  <span>Aguardando seleção ou digitação...</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={!canApplyDraft}
                  className={clsx(
                    'rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg',
                    !canApplyDraft
                      ? 'cursor-not-allowed bg-slate-800 text-slate-600 opacity-50'
                      : 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-500 active:scale-95',
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
