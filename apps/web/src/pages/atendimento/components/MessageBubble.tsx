
import React from 'react';
import { 
  FileText, 
  Trash2, 
  CheckCheck,
  User,
  Gavel
} from 'lucide-react';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  msg: any;
  isMe: boolean;
  isSystem: boolean;
  contactName?: string;
  profilePicUrl?: string;
  formatTime: (date: string) => string;
  getMediaUrl: (path: string | null) => string;
  onDelete: (id: string) => void;
  onLinkToProcess?: (msg: any) => void;
  quotedMsg?: any;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  isMe,
  isSystem,
  profilePicUrl,
  formatTime,
  getMediaUrl,
  onDelete,
  onLinkToProcess,
  quotedMsg
}) => {
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
          {msg.content}
        </span>
      </div>
    );
  }

  // Parse reactions if string
  const reactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || []);

  const userStr = localStorage.getItem('user');
  const userObj = userStr ? JSON.parse(userStr) : null;
  const canDelete = userObj?.role === 'OWNER' || userObj?.role === 'ADMIN';

  return (
    <div className={clsx("flex gap-3 mb-4", isMe ? "justify-end" : "justify-start items-end animate-in slide-in-from-left-2")}>
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-700 shadow-sm">
          {profilePicUrl ? (
            <img src={profilePicUrl} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <User size={14} className="text-slate-500" />
          )}
        </div>
      )}
      
      <div className={clsx(
        "max-w-[75%] md:max-w-[60%] rounded-2xl p-3 shadow-md relative group transition-all hover:shadow-lg",
        isMe 
          ? "bg-indigo-600 text-white rounded-br-none" 
          : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700",
        msg.id.startsWith('temp-') && "opacity-70 animate-pulse"
      )}>
        
        {/* Camada de Ações Rápidas (Diferencial DR.X) */}
        {!isSystem && (
           <div className={clsx(
             "absolute -top-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20",
             isMe ? "right-0" : "left-0"
           )}>
            {onLinkToProcess && (
                <button 
                  onClick={() => onLinkToProcess(msg)}
                  className="bg-amber-500 text-white rounded-full p-1.5 shadow-lg hover:bg-amber-600 transition-transform hover:scale-110"
                  title="Vincular ao Processo (DR.X)"
                >
                  <Gavel size={12} />
                </button>
            )}
            {canDelete && (
                <button 
                  onClick={() => onDelete(msg.id)}
                  className="bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-transform hover:scale-110"
                  title="Apagar para todos"
                >
                  <Trash2 size={12} />
                </button>
            )}
          </div>
        )}

        {/* Quoted Message */}
        {quotedMsg && (
            <div className={clsx(
                "mb-2 p-2 rounded-lg border-l-4 text-[11px] bg-black/20 opacity-80 border-indigo-400 cursor-pointer hover:bg-black/30 transition",
                isMe ? "bg-indigo-900/40" : "bg-slate-900/60"
            )}>
                <p className="font-bold text-indigo-300 mb-0.5">Resposta para:</p>
                <p className="line-clamp-2 text-slate-300 italic">
                    {quotedMsg.contentType === 'TEXT' ? quotedMsg.content : `[Mídia: ${quotedMsg.contentType}]`}
                </p>
            </div>
        )}

        <div className="relative">
            {msg.contentType === 'AUDIO' ? (
              <div className="flex flex-col gap-1 min-w-[220px]">
                  <audio 
                    controls 
                    preload="metadata"
                    src={getMediaUrl(msg.mediaUrl)} 
                    className={clsx(
                        "w-full h-10 rounded-lg",
                        isMe ? "accent-white" : "accent-indigo-500"
                    )}
                    onError={(e) => {
                      const target = e.target as HTMLAudioElement;
                      console.error("Audio error:", target.error);
                    }}
                  >
                    Seu navegador não suporta o player.
                  </audio>
                  {!msg.id.startsWith('temp-') && !msg.mediaUrl && (
                    <span className="text-[10px] text-amber-400 italic">Arquivo de áudio não encontrado</span>
                  )}
              </div>
            ) : msg.contentType === 'IMAGE' ? (
              <div className="space-y-2">
                  {msg.mediaUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 group/img">
                        <img 
                          src={getMediaUrl(msg.mediaUrl)} 
                          alt="Imagem" 
                          className="max-w-full cursor-pointer hover:opacity-95 transition"
                          onClick={() => window.open(getMediaUrl(msg.mediaUrl), '_blank')} 
                        />
                    </div>
                  )}
                  {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
              </div>
            ) : (msg.contentType === 'FILE' || msg.contentType === 'DOCUMENT') ? (
              <div 
                className="flex items-center gap-3 bg-black/20 p-3 rounded-xl cursor-pointer hover:bg-black/30 transition border border-white/5" 
                onClick={() => window.open(getMediaUrl(msg.mediaUrl), '_blank')}
              >
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <FileText size={24} className="text-indigo-300" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-sm font-medium truncate block max-w-[180px]">{msg.content || 'Arquivo Anexo'}</span>
                  <span className="text-[10px] text-indigo-300 opacity-70">Clique para visualizar</span>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            )}
        </div>

        {/* Reactions Layer */}
        {reactions.length > 0 && (
            <div className={clsx(
                "absolute -bottom-3 flex gap-0.5 z-10",
                isMe ? "right-2" : "left-2"
            )}>
                {reactions.slice(0, 3).map((r: any, i: number) => (
                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 text-xs shadow-md animate-in zoom-in-50">
                        {r.emoji}
                    </div>
                ))}
                {reactions.length > 3 && (
                    <div className="bg-slate-800 border border-slate-700 rounded-full px-1 py-0.5 text-[9px] text-slate-400 font-bold flex items-center">
                        +{reactions.length - 3}
                    </div>
                )}
            </div>
        )}

        {/* Footer: Hora e Status */}
        <div className={clsx(
            "flex items-center justify-end gap-1 mt-1.5 select-none", 
            isMe ? "text-indigo-200" : "text-slate-500"
        )}>
          <span className="text-[10px] font-medium">{formatTime(msg.createdAt)}</span>
          {isMe && (
            <CheckCheck size={14} className={clsx(
              msg.id.startsWith('temp-') ? 'text-indigo-300/50' : 
              msg.status === 'READ' ? 'text-cyan-300' : 
              msg.status === 'DELIVERED' ? 'text-indigo-200' : 'text-slate-500'
            )} />
          )}
        </div>
      </div>
    </div>
  );
};
