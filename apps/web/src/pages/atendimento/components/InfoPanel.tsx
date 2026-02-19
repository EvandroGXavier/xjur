
import React from 'react';
import { 
  User, 
  MessageSquare, 
  Info, 
  Gavel, 
  FileText, 
  Link as LinkIcon,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { clsx } from 'clsx';

interface InfoPanelProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  processes: any[];
  onLinkProcess: (processId: string) => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ 
  ticket, 
  isOpen, 
  onClose,
  processes,
  onLinkProcess
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full animate-in slide-in-from-right shadow-2xl z-30">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <h2 className="font-bold flex items-center gap-2">
          <Info size={18} className="text-indigo-400" />
          Detalhes do Contato
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Contact Info Header */}
        <div className="p-6 flex flex-col items-center border-b border-slate-800/50">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-indigo-500/30 overflow-hidden mb-4 shadow-xl">
             {ticket.contact?.profilePicUrl ? (
                <img src={ticket.contact.profilePicUrl} alt="Foto" className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-900/20 text-indigo-400 text-2xl font-bold">
                  {ticket.contact?.name?.substring(0, 2).toUpperCase()}
                </div>
             )}
          </div>
          <h3 className="text-lg font-bold text-white text-center">{ticket.contact?.name}</h3>
          <span className="text-sm text-slate-400 mt-1">{ticket.contact?.phone || 'Sem telefone'}</span>
          <div className="mt-4 flex gap-2">
             <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full border border-indigo-500/20 font-bold uppercase">
               {ticket.contact?.category || 'Lead'}
             </span>
             {ticket.waitingReply && (
               <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full border border-amber-500/20 font-bold uppercase">
                 Aguardando
               </span>
             )}
          </div>
        </div>

        {/* Section: Processes */}
        <div className="p-4 border-b border-slate-800/50">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Gavel size={14} /> Processos Relacionados
          </h4>
          
          <div className="space-y-2">
            {processes.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/30 border border-dashed border-slate-700 text-center">
                <p className="text-xs text-slate-500">Nenhum processo vinculado.</p>
                <button className="text-[10px] text-indigo-400 hover:underline mt-2">Buscar e Vincular</button>
              </div>
            ) : (
              processes.map(proc => (
                <div key={proc.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer group">
                   <div className="flex justify-between items-start">
                     <span className="text-[10px] font-mono text-indigo-400">{proc.code || 'DOC-001'}</span>
                     <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase">{proc.status}</span>
                   </div>
                   <p className="text-xs font-semibold text-slate-200 mt-1 truncate">{proc.title || proc.cnj}</p>
                   <div className="mt-2 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-[10px] text-indigo-400 flex items-center gap-1">
                        Ver detalhes <ChevronLeft size={10} className="rotate-180" />
                      </button>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section: Shared Media (Quick access) */}
        <div className="p-4 border-b border-slate-800/50">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <FileText size={14} /> Mídias do Chat
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {/* Mock Media Items for UI preview */}
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition cursor-pointer">
                <FileText size={20} className="text-slate-500" />
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-[10px] text-indigo-400 hover:underline text-center">Ver Galeria Completa</button>
        </div>

        {/* Section: Tags */}
        <div className="p-4">
           <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Etiquetas</h4>
           <div className="flex flex-wrap gap-1.5">
             <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">#Juridico</span>
             <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">#Pendente</span>
             <button className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] hover:bg-slate-700 transition">+</button>
           </div>
        </div>
      </div>
      
      {/* Footer Action */}
      <div className="p-4 bg-slate-800/30 border-t border-slate-800">
         <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition">
           Abrir Ficha Completa
         </button>
      </div>
    </div>
  );
};
