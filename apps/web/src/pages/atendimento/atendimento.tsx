import { useState, useMemo } from "react";
import { 
  MessageSquare, 
  Columns,
  MessageCircle
} from "lucide-react";
import { AtendimentoPage } from "./atendimento-v2";
import { Kanban } from "../Kanban";
import { ModuleHeader } from "../../components/ui/ModuleHeader";

type ViewType = "chat" | "kanban";

export function Atendimento() {
  const [view, setView] = useState<ViewType>("chat");

  const tabs = useMemo(() => [
    { id: "chat", label: "Chat Atendimento", icon: MessageSquare },
    { id: "kanban", label: "Quadro Kanban", icon: Columns },
  ], []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <ModuleHeader
        title="Atendimento"
        subtitle="Gestão Omnichannel & Triagem"
        icon={MessageCircle}
        tabs={tabs}
        activeTab={view}
        onTabChange={(id) => setView(id as ViewType)}
        statusText="Online"
        versionText="DRX-CLAW v3.0"
      />

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
