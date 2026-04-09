import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../services/api";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  scope?: string[];
  isInternal?: boolean;
}

type EntityType = "contact" | "process" | "financial" | "timeline" | "library";

interface InlineTagsProps {
  tags: Array<{ tag: Tag } | Tag>;
  entityId: string;
  entityType: EntityType;
  onRefresh?: () => void;
  onTagsChange?: () => void;
  className?: string;
  readOnly?: boolean;
}

const ENTITY_SCOPE_MAP: Record<EntityType, string> = {
  contact: "CONTACT",
  process: "PROCESS",
  financial: "FINANCE",
  timeline: "PROCESS",
  library: "LIBRARY",
};

const normalizeTagName = (value: string) =>
  String(value || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);

const normalizeTags = (tags: Array<{ tag: Tag } | Tag>) =>
  (Array.isArray(tags) ? tags : [])
    .map((item) => ("tag" in item ? item.tag : item))
    .filter((item): item is Tag => Boolean(item?.id && item?.name));

export function InlineTags({
  tags,
  entityId,
  entityType,
  onRefresh,
  onTagsChange,
  className,
  readOnly = false,
}: InlineTagsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const attachedTags = useMemo(() => normalizeTags(tags), [tags]);
  const attachedTagIds = useMemo(
    () => attachedTags.map((tag) => tag.id),
    [attachedTags],
  );
  const scope = ENTITY_SCOPE_MAP[entityType];

  const filteredAvailableTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availableTags.filter((tag) => {
      if (attachedTagIds.includes(tag.id)) return false;
      if (entityType === "library" && tag.isInternal) return false;
      if (!normalizedQuery) return true;
      return String(tag.name || "").toLowerCase().includes(normalizedQuery);
    });
  }, [attachedTagIds, availableTags, entityType, query]);

  const notifyChange = () => {
    onRefresh?.();
    onTagsChange?.();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      void fetchAvailableTags();
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const fetchAvailableTags = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tags?scope=${scope}`);
      setAvailableTags(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao buscar tags disponiveis", error);
    } finally {
      setLoading(false);
    }
  };

  const attachTag = async (tagId: string) => {
    try {
      await api.post(`/tags/${entityType}/${entityId}/${tagId}`);
      toast.success("Tag adicionada");
      notifyChange();
      setIsMenuOpen(false);
      setQuery("");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Erro ao adicionar tag",
      );
    }
  };

  const createTag = async () => {
    const name = normalizeTagName(query);
    if (!name) return;

    const existing = availableTags.find(
      (tag) => String(tag.name || "").toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      void attachTag(existing.id);
      return;
    }

    try {
      setCreating(true);
      const response = await api.post("/tags", {
        name,
        scope: [scope],
      });
      const created = response.data as Tag;
      setAvailableTags((prev) => {
        const withoutPrevious = prev.filter((tag) => tag.id !== created.id);
        return [created, ...withoutPrevious];
      });

      if (entityType === "library" && created.isInternal) {
        toast.error("A tag SISTEMA é interna e não pode ser usada manualmente.");
        setQuery("");
        setIsMenuOpen(false);
        return;
      }

      await attachTag(created.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao criar tag");
    } finally {
      setCreating(false);
    }
  };

  const detachTag = async (event: React.MouseEvent, tagId: string) => {
    event.stopPropagation();
    const tag = attachedTags.find((item) => item.id === tagId);
    if (readOnly || tag?.isInternal) return;

    try {
      await api.delete(`/tags/${entityType}/${entityId}/${tagId}`);
      toast.success("Tag removida");
      notifyChange();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao remover tag");
    }
  };

  return (
    <div className={clsx("flex flex-wrap gap-1.5 items-center", className)}>
      {attachedTags.map((tag) => {
        const canRemove = !readOnly && !tag.isInternal;

        return (
          <span
            key={tag.id}
            className={clsx(
              "group relative flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all overflow-hidden",
              canRemove && "hover:pr-5",
            )}
            style={{
              backgroundColor: `${tag.color}20`,
              borderColor: `${tag.color}40`,
              color: tag.textColor || tag.color,
            }}
            title={tag.isInternal ? "Tag interna do sistema" : tag.name}
          >
            {tag.name}
            {canRemove && (
              <button
                onClick={(event) => void detachTag(event, tag.id)}
                className="absolute right-1 opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-opacity"
              >
                <X size={10} />
              </button>
            )}
          </span>
        );
      })}

      {!readOnly && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((value) => !value)}
            className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white hover:border-slate-500 transition-colors"
          >
            <Plus size={12} />
          </button>

          {isMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-[10px] font-bold text-slate-500 px-2 py-1 mb-2 uppercase tracking-wider border-b border-slate-800">
                Tags
              </div>

              <div className="flex gap-2 px-1 pb-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createTag();
                    }
                  }}
                  placeholder="Buscar ou criar tag"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => void createTag()}
                  disabled={creating || !normalizeTagName(query)}
                  className="px-2 py-1.5 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition"
                >
                  {creating ? "..." : "Criar"}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {filteredAvailableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => void attachTag(tag.id)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-800 flex items-center gap-2 transition-colors group"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-xs text-slate-300 group-hover:text-white">
                      {tag.name}
                    </span>
                  </button>
                ))}

                {!loading && filteredAvailableTags.length === 0 && (
                  <div className="px-2 py-2 text-xs text-slate-500">
                    Nenhuma tag disponivel.
                  </div>
                )}

                {loading && (
                  <div className="px-2 py-2 text-xs text-slate-500">
                    Carregando tags...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
