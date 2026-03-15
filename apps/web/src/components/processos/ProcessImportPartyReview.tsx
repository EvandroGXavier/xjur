import { clsx } from 'clsx';
import { Briefcase, ShieldAlert, User, Users } from 'lucide-react';

export type ImportedProcessParty = {
    name: string;
    type?: string;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    oab?: string | null;
    representedNames?: string[] | null;
    isClient?: boolean;
    isOpposing?: boolean;
};

export type ImportedPartyClassification = '' | 'CLIENT' | 'OPPOSING';
export type ImportedPartyPole = 'ACTIVE' | 'PASSIVE' | null;

export type ImportedPartyReviewItem = ImportedProcessParty & {
    reviewKey: string;
    normalizedType: string;
    pole: ImportedPartyPole;
    isLawyer: boolean;
    representatives: ImportedPartyReviewItem[];
};

export type ImportedPartyReviewModel = {
    mergedParties: ImportedPartyReviewItem[];
    principalParties: ImportedPartyReviewItem[];
    activeParties: ImportedPartyReviewItem[];
    passiveParties: ImportedPartyReviewItem[];
    neutralParties: ImportedPartyReviewItem[];
    unlinkedLawyers: ImportedPartyReviewItem[];
};

const normalizeText = (value?: string | null) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

const normalizeDocument = (value?: string | null) => String(value || '').replace(/\D/g, '');

const isLawyerType = (value?: string | null) => {
    const normalized = normalizeText(value);
    return ['ADVOGADO', 'PROCURADOR', 'DEFENSOR'].some(term => normalized.includes(term));
};

const normalizeImportedType = (value?: string | null) => {
    const normalized = normalizeText(value);
    if (!normalized) return 'PARTE';
    if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalized.includes(term))) {
        if (normalized.includes('AUTORA')) return 'AUTORA';
        if (normalized.includes('REQUERENTE')) return 'REQUERENTE';
        if (normalized.includes('EXEQUENTE')) return 'EXEQUENTE';
        if (normalized.includes('RECLAMANTE')) return 'RECLAMANTE';
        return 'AUTOR';
    }
    if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalized.includes(term))) {
        if (normalized.includes('REQUERIDA')) return 'REQUERIDA';
        if (normalized.includes('REQUERIDO')) return 'REQUERIDO';
        if (normalized.includes('EXECUTADA')) return 'EXECUTADA';
        if (normalized.includes('EXECUTADO')) return 'EXECUTADO';
        return 'REU';
    }
    if (isLawyerType(normalized)) {
        return normalized.includes('CONTRAR') ? 'ADVOGADO CONTRARIO' : 'ADVOGADO';
    }
    return normalized;
};

const inferPoleFromType = (value?: string | null): ImportedPartyPole => {
    const normalized = normalizeImportedType(value);
    if (['AUTOR', 'AUTORA', 'REQUERENTE', 'EXEQUENTE', 'IMPETRANTE', 'RECLAMANTE', 'APELANTE', 'AGRAVANTE', 'EMBARGANTE'].some(term => normalized.includes(term))) {
        return 'ACTIVE';
    }
    if (['REU', 'REQUERIDO', 'REQUERIDA', 'EXECUTADO', 'EXECUTADA', 'IMPETRADO', 'RECLAMADO', 'RECLAMADA', 'APELADO', 'AGRAVADO', 'EMBARGADO'].some(term => normalized.includes(term))) {
        return 'PASSIVE';
    }
    return null;
};

const inferRepresentativePole = (value?: string | null): ImportedPartyPole => {
    const normalized = normalizeImportedType(value);
    if (normalized.includes('CONTRARIO')) return 'PASSIVE';
    if (isLawyerType(normalized)) return 'ACTIVE';
    return inferPoleFromType(normalized);
};

const mergeRepresentedNames = (values: Array<string | undefined>) => {
    const unique = new Map<string, string>();
    values.forEach(value => {
        const normalized = normalizeText(value);
        if (normalized && !unique.has(normalized)) {
            unique.set(normalized, String(value).trim());
        }
    });
    return Array.from(unique.values());
};

export const buildImportedPartyReview = (parties: ImportedProcessParty[]): ImportedPartyReviewModel => {
    const merged = new Map<string, ImportedPartyReviewItem>();

    for (const party of Array.isArray(parties) ? parties : []) {
        const name = String(party?.name || '').replace(/\s+/g, ' ').trim();
        const normalizedName = normalizeText(name);
        const normalizedDocument = normalizeDocument(party?.document);
        if (!normalizedName && !normalizedDocument) continue;

        const normalizedType = normalizeImportedType(party?.type);
        const isLawyer = isLawyerType(normalizedType);
        const pole = inferPoleFromType(normalizedType);
        const reviewKey =
            pole && !isLawyer
                ? `${normalizedDocument || normalizedName}::${pole}`
                : `${normalizedDocument || normalizedName}::${normalizedType || 'PARTE'}`;
        const existing = merged.get(reviewKey);

        merged.set(reviewKey, {
            ...(existing || {}),
            ...party,
            name,
            type: normalizedType,
            normalizedType,
            reviewKey,
            pole,
            isLawyer,
            representatives: existing?.representatives || [],
            representedNames: mergeRepresentedNames([...(existing?.representedNames || []), ...((party?.representedNames || []) as string[])]),
            isClient: party?.isClient ?? existing?.isClient,
            isOpposing: party?.isOpposing ?? existing?.isOpposing,
            document: existing?.document || party?.document || null,
            email: existing?.email || party?.email || null,
            phone: existing?.phone || party?.phone || null,
            oab: existing?.oab || party?.oab || null,
        });
    }

    const mergedParties = Array.from(merged.values());
    const principals = mergedParties
        .filter(item => !item.isLawyer && item.pole)
        .map(item => ({ ...item, representatives: [] as ImportedPartyReviewItem[] }));
    const principalNameMap = new Map<string, ImportedPartyReviewItem[]>();

    principals.forEach(item => {
        const current = principalNameMap.get(normalizeText(item.name)) || [];
        current.push(item);
        principalNameMap.set(normalizeText(item.name), current);
    });

    const principalByKey = new Map(principals.map(item => [item.reviewKey, item]));
    const unlinkedLawyers: ImportedPartyReviewItem[] = [];

    mergedParties
        .filter(item => item.isLawyer)
        .forEach(lawyer => {
            const explicitTargets = (lawyer.representedNames || [])
                .flatMap(name => principalNameMap.get(normalizeText(name)) || []);
            const fallbackPole = inferRepresentativePole(lawyer.normalizedType);
            const targets = explicitTargets.length > 0
                ? explicitTargets
                : fallbackPole
                  ? principals.filter(item => item.pole === fallbackPole)
                  : [];

            const uniqueTargets = Array.from(new Map(targets.map(item => [item.reviewKey, item])).values());
            if (uniqueTargets.length === 0) {
                unlinkedLawyers.push({ ...lawyer, representatives: [] });
                return;
            }

            uniqueTargets.forEach(target => {
                const current = principalByKey.get(target.reviewKey);
                if (!current) return;
                current.representatives = [...current.representatives, { ...lawyer, representatives: [] }];
            });
        });

    const orderedPrincipals = principals.map(item => principalByKey.get(item.reviewKey) || item);

    return {
        mergedParties,
        principalParties: orderedPrincipals,
        activeParties: orderedPrincipals.filter(item => item.pole === 'ACTIVE'),
        passiveParties: orderedPrincipals.filter(item => item.pole === 'PASSIVE'),
        neutralParties: mergedParties.filter(item => !item.isLawyer && !item.pole),
        unlinkedLawyers,
    };
};

export const applyImportedPartyClassification = (
    review: ImportedPartyReviewModel,
    classification: Record<string, ImportedPartyClassification>,
) => {
    return review.mergedParties.map(party => {
        if (party.isLawyer || !party.pole) {
            const { reviewKey, normalizedType, representatives, pole, isLawyer, ...rawParty } = party;
            return rawParty;
        }

        const flag = classification[party.reviewKey] || '';
        const { reviewKey, normalizedType, representatives, pole, isLawyer, ...rawParty } = party;
        return {
            ...rawParty,
            isClient: flag === 'CLIENT',
            isOpposing: flag === 'OPPOSING',
        };
    });
};

const roleBadgeClass = (pole: ImportedPartyPole, isLawyer: boolean) => {
    if (isLawyer) return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
    if (pole === 'ACTIVE') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (pole === 'PASSIVE') return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    return 'border-slate-700 bg-slate-800/80 text-slate-300';
};

const classificationButtonClass = (active: boolean, tone: 'client' | 'opposing') =>
    clsx(
        'rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors',
        active
            ? tone === 'client'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200',
    );

function PrincipalPartyCard({
    party,
    classification,
    onClassificationChange,
}: {
    party: ImportedPartyReviewItem;
    classification: ImportedPartyClassification;
    onClassificationChange: (reviewKey: string, value: ImportedPartyClassification) => void;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={clsx('rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', roleBadgeClass(party.pole, party.isLawyer))}>
                            {party.type}
                        </span>
                        <span className="text-sm font-semibold text-white">{party.name}</span>
                        {party.document && <span className="font-mono text-[11px] text-slate-400">{party.document}</span>}
                    </div>
                    {party.oab && <div className="mt-1 text-[11px] text-slate-500">OAB: {party.oab}</div>}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onClassificationChange(party.reviewKey, classification === 'CLIENT' ? '' : 'CLIENT')}
                        className={classificationButtonClass(classification === 'CLIENT', 'client')}
                    >
                        Cliente
                    </button>
                    <button
                        type="button"
                        onClick={() => onClassificationChange(party.reviewKey, classification === 'OPPOSING' ? '' : 'OPPOSING')}
                        className={classificationButtonClass(classification === 'OPPOSING', 'opposing')}
                    >
                        Contrário
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Briefcase size={12} />
                    Procuradores
                </div>
                {party.representatives.length > 0 ? (
                    <div className="mt-3 space-y-2">
                        {party.representatives.map(representative => (
                            <div key={representative.reviewKey} className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                                <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]', roleBadgeClass(null, true))}>
                                    {representative.type}
                                </span>
                                <span>{representative.name}</span>
                                {representative.document && <span className="font-mono text-[11px] text-slate-500">{representative.document}</span>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-3 text-sm text-slate-500">Nenhum procurador identificado para esta parte.</div>
                )}
            </div>
        </div>
    );
}

export function ProcessImportPartyReview({
    review,
    classification,
    onClassificationChange,
}: {
    review: ImportedPartyReviewModel;
    classification: Record<string, ImportedPartyClassification>;
    onClassificationChange: (reviewKey: string, value: ImportedPartyClassification) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                    <Users size={14} />
                    Revisão das Partes
                </div>
                <p className="mt-2 text-sm text-slate-400">
                    Defina quem é cliente e quem é contrário antes de concluir a importação. O polo do processo permanece como veio do PJe.
                </p>
            </div>

            {review.activeParties.length > 0 && (
                <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">Polo Ativo</div>
                    {review.activeParties.map(party => (
                        <PrincipalPartyCard
                            key={party.reviewKey}
                            party={party}
                            classification={classification[party.reviewKey] || ''}
                            onClassificationChange={onClassificationChange}
                        />
                    ))}
                </div>
            )}

            {review.passiveParties.length > 0 && (
                <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">Polo Passivo</div>
                    {review.passiveParties.map(party => (
                        <PrincipalPartyCard
                            key={party.reviewKey}
                            party={party}
                            classification={classification[party.reviewKey] || ''}
                            onClassificationChange={onClassificationChange}
                        />
                    ))}
                </div>
            )}

            {review.neutralParties.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <User size={12} />
                        Outros Envolvidos
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                        {review.neutralParties.map(party => (
                            <div key={party.reviewKey} className="flex flex-wrap items-center gap-2">
                                <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]', roleBadgeClass(party.pole, party.isLawyer))}>
                                    {party.type}
                                </span>
                                <span>{party.name}</span>
                                {party.document && <span className="font-mono text-[11px] text-slate-500">{party.document}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {review.unlinkedLawyers.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
                        <ShieldAlert size={12} />
                        Procuradores Sem Vínculo Confirmado
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-amber-100/90">
                        {review.unlinkedLawyers.map(party => (
                            <div key={party.reviewKey}>{party.name}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
