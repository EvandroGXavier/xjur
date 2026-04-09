import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { Check, X, Tag as TagIcon } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { defaultTagColor } from "../../utils/themeColors";

export interface TagData {
  id: string;
  name: string;
  color?: string;
}

type EntityType = "contact" | "process" | "financial" | "timeline" | "library";

interface AdvancedTagFilterProps {
  onFilterChange?: (includedTags: string[], excludedTags: string[]) => void;
  onChange?: (includedTags: string[], excludedTags: string[]) => void;
  scope?: string;
  entityType?: EntityType;
  includedIds?: string[];
  excludedIds?: string[];
  className?: string;
}

type TagState = "INCLUDED" | "EXCLUDED" | null;

const ENTITY_SCOPE_MAP: Record<EntityType, string> = {
  contact: "CONTACT",
  process: "PROCESS",
  financial: "FINANCE",
  timeline: "PROCESS",
  library: "LIBRARY",
};

export function AdvancedTagFilter({
  onFilterChange,
  onChange,
  scope,
  entityType,
  includedIds,
  excludedIds,
  className,
}: AdvancedTagFilterProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagStates, setTagStates] = useState<Record<string, TagState>>({});

  const resolvedScope = useMemo(() => {
    if (scope) return scope;
    if (entityType) return ENTITY_SCOPE_MAP[entityType];
    return undefined;
  }, [entityType, scope]);

  useEffect(() => {
    void fetchTags();
  }, [resolvedScope]);

  useEffect(() => {
    if (!includedIds && !excludedIds) return;

    const nextStates: Record<string, TagState> = {};
    for (const id of includedIds || []) nextStates[id] = "INCLUDED";
    for (const id of excludedIds || []) nextStates[id] = "EXCLUDED";
    setTagStates(nextStates);
  }, [
    includedIds ? includedIds.join(",") : "",
    excludedIds ? excludedIds.join(",") : "",
  ]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const url = resolvedScope ? `/tags?scope=${resolvedScope}` : "/tags";
      const res = await api.get(url);
      setTags(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao carregar tags:", error);
      toast.error("Erro ao carregar etiquetas para o filtro");
    } finally {
      setLoading(false);
    }
  };

  const emitChange = (states: Record<string, TagState>) => {
    const included: string[] = [];
    const excluded: string[] = [];

    Object.entries(states).forEach(([id, state]) => {
      if (state === "INCLUDED") included.push(id);
      if (state === "EXCLUDED") excluded.push(id);
    });

    onChange?.(included, excluded);
    onFilterChange?.(included, excluded);
  };

  const handleTagClick = (tagId: string) => {
    const currentState = tagStates[tagId];
    let nextState: TagState = null;

    if (!currentState) {
      nextState = "INCLUDED";
    } else if (currentState === "INCLUDED") {
      nextState = "EXCLUDED";
    }

    const newStates = { ...tagStates, [tagId]: nextState };
    setTagStates(newStates);
    emitChange(newStates);
  };

  if (loading && tags.length === 0) {
    return (
      <div
        className={clsx(
          "flex items-center gap-2 text-slate-500 text-sm p-2 animate-pulse",
          className,
        )}
      >
        <TagIcon size={14} /> Carregando etiquetas...
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={clsx("flex items-center gap-2 flex-wrap", className)}>
      <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mr-2">
        <TagIcon size={12} /> Filtro por Etiquetas:
      </div>
      {tags.map((tag) => {
        const state = tagStates[tag.id];
        return (
          <button
            key={tag.id}
            onClick={() => handleTagClick(tag.id)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
              !state &&
                "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300",
              state === "INCLUDED" &&
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm",
              state === "EXCLUDED" &&
                "bg-red-500/10 border-red-500/30 text-red-400 shadow-sm",
            )}
            title={
              !state
                ? "Clique para incluir esta etiqueta"
                : state === "INCLUDED"
                  ? "Clique para excluir esta etiqueta"
                  : "Clique para limpar este filtro"
            }
          >
            {state === "INCLUDED" && (
              <Check size={12} className="text-emerald-500" />
            )}
            {state === "EXCLUDED" && <X size={12} className="text-red-500" />}
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tag.color || defaultTagColor }}
            />
            {tag.name}
          </button>
        );
      })}
      <div className="text-[10px] text-slate-500 ml-auto hidden sm:block">
        (1 clique: inclui / 2 cliques: exclui / 3 cliques: limpa)
      </div>
    </div>
  );
}
