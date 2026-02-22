import React, { useEffect } from 'react';
import { X, BookOpen, AlertCircle, Info } from 'lucide-react';

export interface HelpSection {
  title: string;
  content: string; // Pode conter HTML simples (b, i, ul, li)
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sections: HelpSection[];
}

export function HelpModal({ isOpen, onClose, title, sections }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <div className="p-6 flex items-center justify-between border-b border-slate-700 sticky top-0 bg-slate-800 rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <BookOpen className="text-indigo-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Manual: {title}</h2>
              <p className="text-sm text-slate-400">Guia de uso avançado</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-3 bg-slate-700/30 p-5 rounded-lg border border-slate-700/50">
              <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2 mb-4">
                <Info size={18} />
                {section.title}
              </h3>
              <div 
                className="text-slate-300 text-sm leading-relaxed space-y-4 prose prose-invert prose-p:my-2 prose-ul:my-2"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          ))}
          
          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-blue-200">
              <strong>Dica de Atalho:</strong> Você pode pressionar <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-white border border-slate-600">Ctrl</kbd> + <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-white border border-slate-600">F1</kbd> em qualquer tela para abrir o manual correspondente a ela.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook Reutilizável para interceptar o CTRL + F1
export function useHelpModal() {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Previne que o F1 padrão do browser abra
      if (e.key === 'F1') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          setIsHelpOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isHelpOpen, setIsHelpOpen };
}
