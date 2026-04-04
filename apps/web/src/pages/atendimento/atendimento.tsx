import { useState } from "react";
import { 
  MessageSquare, 
  Columns,
  MessageCircle
} from "lucide-react";
import { clsx } from "clsx";
import { AtendimentoPage } from "./atendimento-v2";
import { Kanban } from "../Kanban";

export function Atendimento() {
  const [view, setView] = useState<"chat" | "kanban">("chat");

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header com Abas Estilo Estoque */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 border border-emerald-600/30">
            <MessageCircle size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Atendimento</h1>
            <p className="text-slate-500 text-xs text-uppercase tracking-wider">Gestão Omnichannel & Triagem</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setView("chat")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "chat"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <MessageSquare size={16} />
            Chat Atendimento
          </button>
          <button
            onClick={() => setView("kanban")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "kanban"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Columns size={16} />
            Quadro Kanban
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2">
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black">Online</span>
                <span className="text-[9px] text-slate-500 font-mono">DRX-CLAW v3.0</span>
            </div>
        </div>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 overflow-hidden">
        {view === "chat" && (
            <div className="h-full animate-in fade-in duration-500">
                <AtendimentoPage />
            </div>
        )}
        {view === "kanban" && (
            <div className="h-full animate-in fade-in slide-in-from-bottom-3 duration-500">
                <Kanban />
            </div>
        )}
      </div>
    </div>
  );
}
