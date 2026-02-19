import { useState, useEffect, useRef } from 'react';
import { Plus, X, Tag as TagIcon, Check } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { clsx } from 'clsx';

interface Tag {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  scope?: string[];
}

interface InlineTagsProps {
  tags: { tag: Tag }[];
  entityId: string;
  entityType: 'contact' | 'process';
  onRefresh: () => void;
}

export function InlineTags({ tags, entityId, entityType, onRefresh }: InlineTagsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      fetchAvailableTags();
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const fetchAvailableTags = async () => {
    try {
      setLoading(true);
      const scope = entityType === 'contact' ? 'CONTACT' : 'PROCESS';
      const response = await api.get(`/tags?scope=${scope}`);
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Erro ao buscar tags disponiveis', error);
    } finally {
      setLoading(false);
    }
  };

  const attachTag = async (tagId: string) => {
    try {
      await api.post(`/tags/${entityType}/${entityId}/${tagId}`);
      toast.success('Tag adicionada');
      onRefresh();
      setIsMenuOpen(false);
    } catch (error) {
      toast.error('Erro ao adicionar tag');
    }
  };

  const detachTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/tags/${entityType}/${entityId}/${tagId}`);
      toast.success('Tag removida');
      onRefresh();
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  };

  const attachedTagIds = tags.map(t => t.tag.id);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map(({ tag }) => (
        <span
          key={tag.id}
          className="group relative flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all hover:pr-5 overflow-hidden"
          style={{ 
            backgroundColor: `${tag.color}20`, 
            borderColor: `${tag.color}40`,
            color: tag.color 
          }}
        >
          {tag.name}
          <button
            onClick={(e) => detachTag(e, tag.id)}
            className="absolute right-1 opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-opacity"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white hover:border-slate-500 transition-colors"
        >
          <Plus size={12} />
        </button>

        {isMenuOpen && (
          <div className="absolute left-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-[10px] font-bold text-slate-500 px-2 py-1 mb-1 uppercase tracking-wider border-b border-slate-800">
              Adicionar Tag
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {availableTags.filter(t => !attachedTagIds.includes(t.id)).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => attachTag(tag.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-800 flex items-center gap-2 transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-xs text-slate-300 group-hover:text-white">{tag.name}</span>
                </button>
              ))}
              
              {availableTags.filter(t => !attachedTagIds.includes(t.id)).length === 0 && (
                <div className="text-[10px] text-slate-600 px-2 py-2 italic text-center">
                  {loading ? 'Carregando...' : 'Nenhuma tag disponível'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
