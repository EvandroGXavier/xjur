import { BadRequestException } from '@nestjs/common';

type Combinator = 'AND' | 'OR';

type Operator =
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

type Node = GroupNode | RuleNode;

type GroupNode = {
    type: 'group';
    combinator?: Combinator;
    children?: Node[];
};

type RuleNode = {
    type: 'rule';
    field?: string;
    operator?: Operator;
    value?: unknown;
    value2?: unknown;
};

const MAX_DEPTH = 6;
const MAX_NODES = 120;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function parseList(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(asString).map(v => v.trim()).filter(Boolean);
    }
    return asString(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function parseNumber(value: unknown) {
    const raw = asString(value).replace(/\./g, '').replace(',', '.').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown) {
    const raw = asString(value).trim();
    if (!raw) return null;
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return null;
    return date;
}

function parseDateEdge(value: unknown, edge: 'start' | 'end') {
    const raw = asString(value).trim();
    if (!raw) return null;

    // Prefer yyyy-mm-dd coming from <input type="date">
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const dt =
            edge === 'start'
                ? new Date(`${raw}T00:00:00.000Z`)
                : new Date(`${raw}T23:59:59.999Z`);
        return Number.isFinite(dt.getTime()) ? dt : null;
    }

    return parseDate(raw);
}

function buildStringFilter(operator: Operator, value: string) {
    const v = value.trim();
    if (!v && operator !== 'is_empty' && operator !== 'is_not_empty') return null;

    if (operator === 'contains') return { contains: v, mode: 'insensitive' as const };
    if (operator === 'not_contains') return { not: { contains: v, mode: 'insensitive' as const } };
    if (operator === 'eq') return { equals: v, mode: 'insensitive' as const };
    if (operator === 'neq') return { not: { equals: v, mode: 'insensitive' as const } };
    if (operator === 'starts_with') return { startsWith: v, mode: 'insensitive' as const };
    if (operator === 'ends_with') return { endsWith: v, mode: 'insensitive' as const };

    return null;
}

function buildNumberFilter(operator: Operator, value: unknown, value2: unknown) {
    if (operator === 'is_empty') return { equals: null };
    if (operator === 'is_not_empty') return { not: null };

    if (operator === 'between') {
        const from = parseNumber(value);
        const to = parseNumber(value2);
        if (from == null || to == null) return null;
        return { gte: from, lte: to };
    }

    if (operator === 'in' || operator === 'not_in') {
        const list = parseList(value).map(parseNumber).filter((n): n is number => n != null);
        if (list.length === 0) return null;
        return operator === 'in' ? { in: list } : { notIn: list };
    }

    const n = parseNumber(value);
    if (n == null) return null;

    if (operator === 'eq') return { equals: n };
    if (operator === 'neq') return { not: n };
    if (operator === 'gt') return { gt: n };
    if (operator === 'gte') return { gte: n };
    if (operator === 'lt') return { lt: n };
    if (operator === 'lte') return { lte: n };

    return null;
}

function buildDateFilter(operator: Operator, value: unknown, value2: unknown) {
    if (operator === 'is_empty') return { equals: null };
    if (operator === 'is_not_empty') return { not: null };

    if (operator === 'between') {
        const from = parseDateEdge(value, 'start');
        const to = parseDateEdge(value2, 'end');
        if (!from || !to) return null;
        return { gte: from, lte: to };
    }

    if (operator === 'on') {
        const raw = asString(value).trim();
        if (!raw) return null;
        // Prefer yyyy-mm-dd coming from <input type="date">
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const start = new Date(`${raw}T00:00:00.000Z`);
            const end = new Date(`${raw}T23:59:59.999Z`);
            return { gte: start, lte: end };
        }
        const date = parseDate(raw);
        if (!date) return null;
        return { equals: date };
    }

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(asString(value).trim());
    const date = isDateOnly ? parseDateEdge(value, operator === 'after' ? 'end' : 'start') : parseDate(value);
    if (!date) return null;

    if (operator === 'before') return { lt: date };
    if (operator === 'after') return { gt: date };
    if (operator === 'eq') return { equals: date };
    if (operator === 'neq') return { not: date };
    if (operator === 'gte') return { gte: isDateOnly ? parseDateEdge(value, 'start')! : date };
    if (operator === 'lte') return { lte: isDateOnly ? parseDateEdge(value, 'end')! : date };

    return null;
}

function buildInListStringWhere(field: string, operator: Operator, value: unknown) {
    const list = parseList(value);
    if (list.length === 0) return null;
    const orEquals = list.map(v => ({ [field]: { equals: v, mode: 'insensitive' as const } }));
    if (operator === 'in') return { OR: orEquals };
    return { NOT: { OR: orEquals } };
}

function buildRuleWhere(rule: RuleNode) {
    const field = asString(rule.field).trim();
    const operator = rule.operator;

    if (!field || !operator) return null;

    const TEXT_FIELDS = new Set([
        'cnj',
        'title',
        'code',
        'court',
        'courtSystem',
        'vars',
        'district',
        'judge',
        'responsibleLawyer',
        'area',
        'subject',
        'folder',
        'localFolder',
        'status',
        'category',
    ]);

    const NUMBER_FIELDS = new Set(['value']);
    const DATE_FIELDS = new Set(['distributionDate', 'createdAt', 'updatedAt']);

    if (field === 'clientName' || field === 'partyName') {
        const v = asString(rule.value);
        if (operator === 'is_empty') {
            if (field === 'clientName') return { processParties: { none: { isClient: true } } };
            return { processParties: { none: {} } };
        }
        if (operator === 'is_not_empty') {
            if (field === 'clientName') return { processParties: { some: { isClient: true } } };
            return { processParties: { some: {} } };
        }

        if (operator === 'in' || operator === 'not_in') {
            const list = parseList(rule.value);
            if (list.length === 0) return null;
            const partyWhere = {
                ...(field === 'clientName' ? { isClient: true } : {}),
                contact: { name: { in: list } },
            };
            return operator === 'in'
                ? { processParties: { some: partyWhere } }
                : { processParties: { none: partyWhere } };
        }

        const stringFilter = buildStringFilter(operator, v);
        if (!stringFilter) return null;
        const partyWhere = {
            ...(field === 'clientName' ? { isClient: true } : {}),
            contact: { name: stringFilter },
        };

        const isNegative =
            operator === 'not_contains' ||
            operator === 'neq';

        return isNegative ? { processParties: { none: partyWhere } } : { processParties: { some: partyWhere } };
    }

    if (TEXT_FIELDS.has(field)) {
        if (operator === 'is_empty') {
            return { OR: [{ [field]: null }, { [field]: '' }] };
        }
        if (operator === 'is_not_empty') {
            return { AND: [{ NOT: { [field]: null } }, { NOT: { [field]: '' } }] };
        }
        if (operator === 'in' || operator === 'not_in') {
            return buildInListStringWhere(field, operator, rule.value);
        }
        const stringFilter = buildStringFilter(operator, asString(rule.value));
        if (!stringFilter) return null;
        return { [field]: stringFilter };
    }

    if (NUMBER_FIELDS.has(field)) {
        const numberFilter = buildNumberFilter(operator, rule.value, rule.value2);
        if (!numberFilter) return null;
        return { [field]: numberFilter };
    }

    if (DATE_FIELDS.has(field)) {
        const dateFilter = buildDateFilter(operator, rule.value, rule.value2);
        if (!dateFilter) return null;
        return { [field]: dateFilter };
    }

    return null;
}

function countNodes(node: Node): number {
    if (node.type === 'rule') return 1;
    const children = Array.isArray(node.children) ? node.children : [];
    return 1 + children.reduce((sum, c) => sum + countNodes(c), 0);
}

function buildNodeWhere(node: Node, depth: number): any | null {
    if (depth > MAX_DEPTH) {
        throw new BadRequestException('Filtro avançado excede o limite de profundidade.');
    }

    if (node.type === 'rule') {
        return buildRuleWhere(node);
    }

    const combinator: Combinator = node.combinator === 'OR' ? 'OR' : 'AND';
    const children = Array.isArray(node.children) ? node.children : [];
    const compiled = children.map(c => buildNodeWhere(c, depth + 1)).filter(Boolean);
    if (compiled.length === 0) return null;

    return combinator === 'AND' ? { AND: compiled } : { OR: compiled };
}

export function buildAdvancedProcessWhere(advancedFilterRaw?: string) {
    if (!advancedFilterRaw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(advancedFilterRaw);
    } catch {
        throw new BadRequestException('advancedFilter deve ser um JSON válido.');
    }

    if (!isPlainObject(parsed)) {
        throw new BadRequestException('advancedFilter deve ser um objeto.');
    }

    const type = asString(parsed.type);
    if (type !== 'group') {
        throw new BadRequestException('advancedFilter deve ter type="group".');
    }

    const node = parsed as unknown as Node;
    const total = countNodes(node);
    if (total > MAX_NODES) {
        throw new BadRequestException(`Filtro avançado excede o limite de ${MAX_NODES} nós.`);
    }

    const where = buildNodeWhere(node, 0);
    return where;
}
