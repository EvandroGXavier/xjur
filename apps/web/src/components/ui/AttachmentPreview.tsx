import { useState, useRef, ReactNode, useEffect } from 'react';
import { FileText } from 'lucide-react';

interface AttachmentPreviewProps {
  url: string;
  title: string;
  children: ReactNode;
  delayClose?: number; // Delay to close popup in ms (e.g. 500ms)
  className?: string;
}

export function AttachmentPreview({ url, title, children, delayClose = 400, className }: AttachmentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSupportedType, setIsSupportedType] = useState(true);
  
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  const handleMouseEnterTrigger = (_e: React.MouseEvent) => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    
    if (triggerRef.current && !isOpen) {
      const rect = triggerRef.current.getBoundingClientRect();
      
      const spaceRight = window.innerWidth - rect.right;
      const spaceBottom = window.innerHeight - rect.bottom;
      
      let x = rect.right + 10;
      let y = rect.top - 20;

      if (spaceRight < 620) {
        x = rect.left - 610;
      }
      
      if (spaceBottom < 720) {
        y = Math.max(10, window.innerHeight - 720);
      }

      setPosition({ x, y });
      setIsOpen(true);
      
      // Fetch content with auth
      if (!blobUrl && !loading) {
          loadBlob();
      }
    }
  };

  const loadBlob = async () => {
    try {
        setLoading(true);
        const { fetchProtectedMediaBlob } = await import('../../services/protectedMedia');
        // A prop 'url' já vem com o path completo (ex: http://localhost:3000/api/contacts/...)
        // Mas o fetchProtectedMediaBlob espera o path relativo ou resolve internamente.
        // Já configuramos getApiUrl para lidar com path. 
        // Vamos extrair apenas a parte do path se for uma URL absoluta
        const pathOnly = url.includes('/api/') ? url.split('/api')[1] : url;
        
        const blob = await fetchProtectedMediaBlob(pathOnly);
        
        // Browsers only preview certain types in iframe. Others trigger download automatically.
        const supportedTypes = ['application/pdf', 'image/', 'text/', 'video/', 'audio/'];
        const isSupported = supportedTypes.some(type => blob.type.startsWith(type));
        
        const isExcel = blob.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                        blob.type === 'application/vnd.ms-excel' ||
                        title.toLowerCase().endsWith('.xls') || 
                        title.toLowerCase().endsWith('.xlsx');
        
        if (isExcel || !isSupported) {
            setIsSupportedType(false);
        } else {
            setIsSupportedType(true);
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
        }
    } catch (err) {
        console.error("Erro ao carregar preview protegido", err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      return () => {
          if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
          }
      };
  }, [blobUrl]);

  const handleMouseLeaveTrigger = () => {
    closeTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, delayClose);
  };

  const handleMouseEnterPopup = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  };

  const handleMouseLeavePopup = () => {
    closeTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, delayClose);
  };

  return (
    <>
      {/* Trigger Area */}
      <div 
        ref={triggerRef}
        className={className || "inline-block"}
        onMouseEnter={handleMouseEnterTrigger}
        onMouseLeave={handleMouseLeaveTrigger}
      >
        {children}
      </div>

      {/* Hover Popup */}
      {isOpen && (
        <div 
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col overflow-hidden w-[600px] h-[700px] animate-in fade-in zoom-in-95 duration-200"
          style={{ top: position.y, left: position.x }}
          onMouseEnter={handleMouseEnterPopup}
          onMouseLeave={handleMouseLeavePopup}
        >
          {/* Header */}
          <div className="bg-slate-900 px-3 py-2 border-b border-slate-700 flex items-center justify-between handle cursor-move select-none">
            <div className="flex items-center gap-2 text-slate-300">
              <FileText size={14} className="text-indigo-400" />
              <span className="text-xs font-medium truncate max-w-[350px]">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={async () => {
                    const { openProtectedMedia } = await import('../../services/protectedMedia');
                    const pathOnly = url.includes('/api/') ? url.split('/api')[1] : url;
                    openProtectedMedia(pathOnly);
                }}
                className="text-slate-400 hover:text-white"
                title="Abrir em Nova Aba"
              >
                <span className="text-[10px] font-bold border border-slate-600 px-1 rounded hover:bg-slate-800 transition">EXT</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-red-400 p-0.5 rounded hover:bg-slate-800 transition"
                title="Fechar (X)"
              >
                <span className="font-bold text-xs">✕</span>
              </button>
            </div>
          </div>
          
          {/* Content iframe */}
          <div className="flex-1 bg-white relative flex items-center justify-center">
            {loading ? (
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500">Carregando visualização...</span>
                </div>
            ) : blobUrl ? (
                <iframe 
                  src={blobUrl} 
                  className="w-full h-full border-0 bg-slate-100"
                  title={title}
                />
            ) : !isSupportedType ? (
                <div className="flex flex-col items-center justify-center gap-4 px-10 text-center text-slate-500 h-full">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileText size={32} />
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700">Pré-visualização Indisponível</p>
                        <p className="text-xs mt-1">Este tipo de arquivo ({title.split('.').pop()?.toUpperCase()}) não pode ser exibido diretamente pelo navegador.</p>
                        <p className="text-xs mt-2 text-indigo-500 font-medium">Use os botões de "Abrir" ou "Baixar" para ver o conteúdo.</p>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-slate-500 text-center px-4">
                    Não foi possível carregar a visualização protegida.<br/>
                    Tente abrir em uma nova aba.
                </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
