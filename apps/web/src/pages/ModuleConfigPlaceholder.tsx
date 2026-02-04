import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function ModuleConfigPlaceholder() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract module name from path (e.g. /financial/config -> Financial)
  const pathParts = location.pathname.split('/');
  const moduleName = pathParts[1] ? pathParts[1].charAt(0).toUpperCase() + pathParts[1].slice(1) : 'Módulo';

  const handleBack = () => {
      // Go back to the module root (remove /config or /configuracoes)
      const parts = location.pathname.split('/');
      // Assuming structure /module/config
      const parentPath = parts.slice(0, parts.length - 1).join('/'); 
      navigate(parentPath || '/');
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#001F3F]">Configuração: {moduleName}</h1>
            <p className="text-muted-foreground text-sm">Ajustes específicos deste módulo.</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-slate-50 text-center min-h-[400px]">
            <div className="bg-yellow-100 p-4 rounded-full mb-4">
                <Construction className="h-12 w-12 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold text-[#001F3F] mb-2">Em Desenvolvimento</h2>
            <p className="text-slate-500 max-w-md">
                A tela de configuração para o módulo <strong>{moduleName}</strong> está sendo construída.
                <br/>
                Em breve você poderá ajustar as preferências neste painel.
            </p>
        </div>
      </div>
    </AppLayout>
  );
}
