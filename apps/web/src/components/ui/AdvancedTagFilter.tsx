import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Tag, Check, X, TagIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

export interface TagData {
  id: string;
  name: string;
  color?: string;
}

interface AdvancedTagFilterProps {
  onFilterChange: (includedTags: string[], excludedTags: string[]) => void;
}

export function AdvancedTagFilter({ onFilterChange }: AdvancedTagFilterProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // State: 'INCLUDED' | 'EXCLUDED' | null
  const [tagStates, setTagStates] = useState<Record<string, 'INCLUDED' | 'EXCLUDED' | null>>({});

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tags');
      setTags(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Erro ao carregar tags:', e);
      toast.error('Erro ao carregar etiquetas para o filtro');
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tagId: string) => {
    const currentState = tagStates[tagId];
    let nextState: 'INCLUDED' | 'EXCLUDED' | null = null;

    if (!currentState) {
      nextState = 'INCLUDED';
    } else if (currentState === 'INCLUDED') {
      nextState = 'EXCLUDED';
    } else {
      nextState = null; // Turns off
    }

    const newStates = { ...tagStates, [tagId]: nextState };
    setTagStates(newStates);

    // Prepare arrays to send up
    const included: string[] = [];
    const excluded: string[] = [];

    Object.entries(newStates).forEach(([id, state]) => {
      if (state === 'INCLUDED') included.push(id);
      if (state === 'EXCLUDED') excluded.push(id);
    });

    onFilterChange(included, excluded);
  };

  if (loading && tags.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm p-2 animate-pulse">
        <TagIcon size={14} /> Carregando etiquetas...
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
              !state ? "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300" : "",
              state === 'INCLUDED' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm" : "",
              state === 'EXCLUDED' ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-sm" : ""
            )}
            title={
                !state ? "Clique para INCLUIR (deve ter esta etiqueta)" : 
                state === 'INCLUDED' ? "Clique para EXCLUIR (NÃO pode ter esta etiqueta)" : 
                "Clique para DESMARCAR"
            }
          >
            {state === 'INCLUDED' && <Check size={12} className="text-emerald-500" />}
            {state === 'EXCLUDED' && <X size={12} className="text-red-500" />}
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: tag.color || '#6366f1' }}
            />
            {tag.name}
          </button>
        );
      })}
      
      {/* Help text on hover or subtle display */}
      <div className="text-[10px] text-slate-500 ml-auto hidden sm:block">
        (1 cliq: Requer / 2 cliqs: Ignora / 3 cliqs: Remove)
      </div>
    </div>
  );
}
