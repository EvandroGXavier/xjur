import { useMemo } from 'react';
import { Filter, Plus, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ProcessAdvancedFilterCombinator = 'AND' | 'OR';

export type ProcessAdvancedFilterField =
  | 'cnj'
  | 'title'
  | 'code'
  | 'category'
  | 'status'
  | 'court'
  | 'courtSystem'
  | 'vars'
  | 'district'
  | 'judge'
  | 'responsibleLawyer'
  | 'area'
  | 'subject'
  | 'folder'
  | 'localFolder'
  | 'value'
  | 'distributionDate'
  | 'createdAt'
  | 'updatedAt'
  | 'clientName'
  | 'partyName';

export type ProcessAdvancedFilterOperator =
  | 'contains'
  | 'not_contains'
  | 'eq'
  | 'neq'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'on'
  | 'before'
  | 'after'
  | 'is_empty'
  | 'is_not_empty';

export type ProcessAdvancedFilterNode = ProcessAdvancedFilterGroup | ProcessAdvancedFilterRule;

export type ProcessAdvancedFilterGroup = {
  id: string;
  type: 'group';
  combinator: ProcessAdvancedFilterCombinator;
  children: ProcessAdvancedFilterNode[];
};

export type ProcessAdvancedFilterRule = {
  id: string;
  type: 'rule';
  field: ProcessAdvancedFilterField;
  operator: ProcessAdvancedFilterOperator;
  value?: string;
  value2?: string;
};

export type ProcessAdvancedFilterOptions = {
  statuses?: string[];
  categories?: string[];
  areas?: string[];
};

export const EMPTY_PROCESS_ADVANCED_FILTER: ProcessAdvancedFilterGroup = {
  id: 'root',
  type: 'group',
  combinator: 'AND',
  children: [],
};

const FIELD_DEFS: Array<{
  value: ProcessAdvancedFilterField;
  label: string;
  kind: 'text' | 'number' | 'date' | 'enum';
  optionKey?: keyof ProcessAdvancedFilterOptions;
  placeholder?: string;
}> = [
  { value: 'district', label: 'Comarca', kind: 'text', placeholder: 'Ex: Belo Horizonte' },
  { value: 'vars', label: 'Vara / Órgão', kind: 'text', placeholder: 'Ex: 2ª Vara Cível' },
  { value: 'court', label: 'Tribunal', kind: 'text', placeholder: 'Ex: TJMG' },
  { value: 'courtSystem', label: 'Sistema', kind: 'text', placeholder: 'Ex: PJe' },
  { value: 'value', label: 'Valor da causa', kind: 'number', placeholder: 'Ex: 15000.00' },
  { value: 'distributionDate', label: 'Distribuição', kind: 'date' },
  { value: 'status', label: 'Status', kind: 'enum', optionKey: 'statuses' },
  { value: 'category', label: 'Categoria', kind: 'enum', optionKey: 'categories' },
  { value: 'area', label: 'Área', kind: 'enum', optionKey: 'areas' },
  { value: 'judge', label: 'Magistrado', kind: 'text' },
  { value: 'responsibleLawyer', label: 'Advogado responsável', kind: 'text' },
  { value: 'subject', label: 'Assunto', kind: 'text' },
  { value: 'cnj', label: 'CNJ', kind: 'text' },
  { value: 'code', label: 'Código interno', kind: 'text' },
  { value: 'title', label: 'Título', kind: 'text' },
  { value: 'folder', label: 'Pasta (nuvem)', kind: 'text' },
  { value: 'localFolder', label: 'Pasta (local)', kind: 'text' },
  { value: 'clientName', label: 'Cliente (parte marcada como cliente)', kind: 'text' },
  { value: 'partyName', label: 'Qualquer parte', kind: 'text' },
  { value: 'createdAt', label: 'Criado em', kind: 'date' },
  { value: 'updatedAt', label: 'Atualizado em', kind: 'date' },
];

const OP_LABEL: Record<ProcessAdvancedFilterOperator, string> = {
  contains: 'contém',
  not_contains: 'não contém',
  eq: 'igual a',
  neq: 'diferente de',
  starts_with: 'começa com',
  ends_with: 'termina com',
  gt: 'maior que',
  gte: 'maior/igual',
  lt: 'menor que',
  lte: 'menor/igual',
  between: 'entre',
  in: 'em (lista)',
  not_in: 'não em (lista)',
  on: 'na data',
  before: 'antes de',
  after: 'depois de',
  is_empty: 'vazio',
  is_not_empty: 'preenchido',
};

function newId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoAny = (globalThis as any).crypto;
  return typeof cryptoAny?.randomUUID === 'function'
    ? cryptoAny.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRule(): ProcessAdvancedFilterRule {
  return {
    id: newId(),
    type: 'rule',
    field: 'district',
    operator: 'contains',
    value: '',
  };
}

function createGroup(): ProcessAdvancedFilterGroup {
  return {
    id: newId(),
    type: 'group',
    combinator: 'AND',
    children: [createRule()],
  };
}

function updateNodeById(
  node: ProcessAdvancedFilterNode,
  id: string,
  updater: (n: ProcessAdvancedFilterNode) => ProcessAdvancedFilterNode,
): ProcessAdvancedFilterNode {
  if (node.id === id) return updater(node);
  if (node.type === 'group') {
    return {
      ...node,
      children: node.children.map((child) => updateNodeById(child, id, updater)),
    };
  }
  return node;
}

function addChildToGroup(
  node: ProcessAdvancedFilterNode,
  groupId: string,
  childToAdd: ProcessAdvancedFilterNode,
): ProcessAdvancedFilterNode {
  if (node.type === 'group' && node.id === groupId) {
    return { ...node, children: [...node.children, childToAdd] };
  }
  if (node.type === 'group') {
    return { ...node, children: node.children.map((c) => addChildToGroup(c, groupId, childToAdd)) };
  }
  return node;
}

function removeNodeById(
  node: ProcessAdvancedFilterNode,
  id: string,
  isRoot = false,
): ProcessAdvancedFilterNode {
  if (node.type === 'group') {
    const children = node.children
      .filter((c) => c.id !== id)
      .map((c) => removeNodeById(c, id, false));
    return { ...node, children: isRoot ? children : children };
  }
  return node;
}

function getFieldDef(field: ProcessAdvancedFilterField) {
  return FIELD_DEFS.find((f) => f.value === field) || FIELD_DEFS[0];
}

function getOperatorsForKind(kind: 'text' | 'number' | 'date' | 'enum'): ProcessAdvancedFilterOperator[] {
  if (kind === 'number') return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty', 'is_not_empty', 'in', 'not_in'];
  if (kind === 'date') return ['on', 'before', 'after', 'between', 'is_empty', 'is_not_empty'];
  if (kind === 'enum') return ['eq', 'neq', 'in', 'not_in', 'is_empty', 'is_not_empty'];
  return ['contains', 'not_contains', 'eq', 'neq', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'in', 'not_in'];
}

function isRuleActive(rule: ProcessAdvancedFilterRule) {
  if (!rule.field || !rule.operator) return false;
  if (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') return true;
  if (rule.operator === 'between') return Boolean(rule.value?.trim()) && Boolean(rule.value2?.trim());
  return Boolean(rule.value?.trim());
}

export function countActiveProcessAdvancedFilters(root: ProcessAdvancedFilterGroup) {
  const walk = (node: ProcessAdvancedFilterNode): number => {
    if (node.type === 'rule') return isRuleActive(node) ? 1 : 0;
    return node.children.reduce((sum, child) => sum + walk(child), 0);
  };
  return walk(root);
}

export function pruneProcessAdvancedFilter(root: ProcessAdvancedFilterGroup): ProcessAdvancedFilterGroup {
  const pruneNode = (node: ProcessAdvancedFilterNode): ProcessAdvancedFilterNode | null => {
    if (node.type === 'rule') {
      return isRuleActive(node) ? node : null;
    }
    const prunedChildren = node.children.map(pruneNode).filter(Boolean) as ProcessAdvancedFilterNode[];
    if (prunedChildren.length === 0) return null;
    return { ...node, children: prunedChildren };
  };

  const pruned = pruneNode(root);
  if (!pruned || pruned.type !== 'group') {
    return { ...root, children: [] };
  }
  return pruned;
}

export function stripProcessAdvancedFilterIds(node: ProcessAdvancedFilterNode): any {
  if (node.type === 'rule') {
    const { id: _id, ...rest } = node;
    return rest;
  }
  const { id: _id, children, ...rest } = node;
  return { ...rest, children: children.map(stripProcessAdvancedFilterIds) };
}

type AdvancedProcessFilterModalProps = {
  open: boolean;
  value: ProcessAdvancedFilterGroup;
  onChange: (next: ProcessAdvancedFilterGroup) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  options?: ProcessAdvancedFilterOptions;
};

export function AdvancedProcessFilterModal({
  open,
  value,
  onChange,
  onClose,
  onClear,
  onApply,
  options,
}: AdvancedProcessFilterModalProps) {
  const activeCount = useMemo(() => countActiveProcessAdvancedFilters(value), [value]);

  const setCombinator = (groupId: string, combinator: ProcessAdvancedFilterCombinator) => {
    onChange(
      updateNodeById(value, groupId, (node) => {
        if (node.type !== 'group') return node;
        return { ...node, combinator };
      }) as ProcessAdvancedFilterGroup,
    );
  };

  const addRule = (groupId: string) => onChange(addChildToGroup(value, groupId, createRule()) as ProcessAdvancedFilterGroup);
  const addGroup = (groupId: string) => onChange(addChildToGroup(value, groupId, createGroup()) as ProcessAdvancedFilterGroup);

  const removeNode = (id: string) => {
    if (id === value.id) return;
    onChange(removeNodeById(value, id, true) as ProcessAdvancedFilterGroup);
  };

  const updateRule = (ruleId: string, patch: Partial<ProcessAdvancedFilterRule>) => {
    onChange(
      updateNodeById(value, ruleId, (node) => {
        if (node.type !== 'rule') return node;
        const next = { ...node, ...patch };
        const kind = getFieldDef(next.field).kind;
        const allowedOps = getOperatorsForKind(kind);
        if (!allowedOps.includes(next.operator)) {
          next.operator = allowedOps[0];
          next.value = '';
          next.value2 = '';
        }
        if (next.operator === 'is_empty' || next.operator === 'is_not_empty') {
          next.value = '';
          next.value2 = '';
        }
        if (next.operator !== 'between') {
          next.value2 = '';
        }
        return next;
      }) as ProcessAdvancedFilterGroup,
    );
  };

  if (!open) return null;

  const GroupEditor = ({ group, depth }: { group: ProcessAdvancedFilterGroup; depth: number }) => {
    const isRoot = depth === 0;
    const hasAnyChild = group.children.length > 0;
    const indent = depth * 12;

    return (
      <div
        className={clsx(
          'rounded-xl border border-slate-800 bg-slate-950/40',
          depth > 0 && 'bg-slate-950/20',
        )}
        style={{ marginLeft: indent }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grupo</span>
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setCombinator(group.id, 'AND')}
                className={clsx(
                  'px-3 py-1.5 text-xs font-bold transition',
                  group.combinator === 'AND'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800',
                )}
              >
                E (AND)
              </button>
              <button
                onClick={() => setCombinator(group.id, 'OR')}
                className={clsx(
                  'px-3 py-1.5 text-xs font-bold transition',
                  group.combinator === 'OR'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800',
                )}
              >
                OU (OR)
              </button>
            </div>
            {!hasAnyChild && (
              <span className="text-xs text-slate-500">(adicione regras para começar)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => addRule(group.id)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition flex items-center gap-2 text-xs font-bold"
              title="Adicionar condição"
            >
              <Plus size={14} /> Condição
            </button>
            <button
              onClick={() => addGroup(group.id)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition flex items-center gap-2 text-xs font-bold"
              title="Adicionar grupo"
            >
              <Plus size={14} /> Grupo
            </button>
            {!isRoot && (
              <button
                onClick={() => removeNode(group.id)}
                className="p-2 rounded-lg text-red-300 hover:bg-red-500/10 transition"
                title="Remover grupo"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {group.children.map((child) =>
            child.type === 'group' ? (
              <GroupEditor key={child.id} group={child} depth={depth + 1} />
            ) : (
              <RuleEditor key={child.id} rule={child} onRemove={() => removeNode(child.id)} />
            ),
          )}
        </div>
      </div>
    );
  };

  const RuleEditor = ({
    rule,
    onRemove,
  }: {
    rule: ProcessAdvancedFilterRule;
    onRemove: () => void;
  }) => {
    const def = getFieldDef(rule.field);
    const operators = getOperatorsForKind(def.kind);
    const showValue = rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty';
    const showBetween = rule.operator === 'between';

    const enumOptions: string[] = (() => {
      if (def.kind !== 'enum') return [];
      const key = def.optionKey;
      const base = (key && options?.[key]) || [];
      const fallback =
        def.value === 'category' ? ['JUDICIAL', 'EXTRAJUDICIAL', 'ADMINISTRATIVO'] : [];
      return Array.from(new Set([...base, ...fallback])).filter(Boolean);
    })();

    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-slate-900/40 border border-slate-800 rounded-xl p-3">
        <div className="md:col-span-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Campo</label>
          <select
            value={rule.field}
            onChange={(e) => updateRule(rule.id, { field: e.target.value as any })}
            className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {FIELD_DEFS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Operador</label>
          <select
            value={rule.operator}
            onChange={(e) => updateRule(rule.id, { operator: e.target.value as any })}
            className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op]}
              </option>
            ))}
          </select>
        </div>

        <div className={clsx('md:col-span-4', !showValue && 'hidden md:block')}>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Valor</label>
          <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
            {showValue && def.kind === 'enum' ? (
              <>
                <select
                  value={rule.value || ''}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className={clsx(
                    'w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500',
                    showBetween && 'md:col-span-1',
                  )}
                >
                  <option value="">Selecione...</option>
                  {enumOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </>
            ) : showValue ? (
              <input
                type={def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : 'text'}
                value={rule.value || ''}
                onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                placeholder={
                  rule.operator === 'in' || rule.operator === 'not_in'
                    ? 'Separe por vírgula'
                    : def.placeholder || 'Digite...'
                }
                step={def.kind === 'number' ? '0.01' : undefined}
                className={clsx(
                  'w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500',
                  showBetween && 'md:col-span-1',
                )}
              />
            ) : null}

            {showBetween && (
              <input
                type={def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : 'text'}
                value={rule.value2 || ''}
                onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                placeholder="até"
                step={def.kind === 'number' ? '0.01' : undefined}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        </div>

        <div className="md:col-span-1 flex items-end justify-end">
          <button
            onClick={onRemove}
            className="p-2 rounded-lg text-red-300 hover:bg-red-500/10 transition"
            title="Remover condição"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 px-6 py-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Filter size={18} className="text-indigo-300" />
                Filtro Avançado de Processos
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Monte combinações com E/OU (AND/OR). Use "Grupo" para criar lógicas mais complexas.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-300 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              {activeCount} condição(ões) ativa(s)
            </span>
            <span className="text-xs text-slate-500">
              Dica: "em (lista)" aceita valores separados por vírgula.
            </span>
          </div>

          <GroupEditor group={value} depth={0} />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={onClear}
              className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition font-bold"
            >
              Limpar
            </button>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={onApply}
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition font-bold shadow-lg shadow-indigo-500/20"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
