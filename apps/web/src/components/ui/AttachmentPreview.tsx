import { useState, useRef, ReactNode, useEffect } from 'react';
import { FileText, X } from 'lucide-react';

interface AttachmentPreviewProps {
  url: string;
  title: string;
  children: ReactNode;
  delayClose?: number; // Delay to close popup in ms (e.g. 500ms)
}

export function AttachmentPreview({ url, title, children, delayClose = 400 }: AttachmentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  const handleMouseEnterTrigger = (e: React.MouseEvent) => {
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

      // If not enough space on right, show on left
      if (spaceRight < 620) {
        x = rect.left - 610;
      }
      
      // If not enough space on bottom, show slightly up
      if (spaceBottom < 720) {
        y = Math.max(10, window.innerHeight - 720);
      }

      setPosition({ x, y });
      setIsOpen(true);
    }
  };

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
        className="inline-block"
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
              <a 
                href={url} 
                target="_blank"
                rel="noopener noreferrer" 
                className="text-slate-400 hover:text-white"
                title="Abrir em Nova Aba"
              >
                <span className="text-[10px] font-bold border border-slate-600 px-1 rounded hover:bg-slate-700">EXT</span>
              </a>
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
          <div className="flex-1 bg-white relative">
            <iframe 
              src={url} 
              className="w-full h-full border-0 bg-slate-100"
              title={title}
            />
          </div>
        </div>
      )}
    </>
  );
}
