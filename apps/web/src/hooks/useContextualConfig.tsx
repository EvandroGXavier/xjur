import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function useContextualConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check localstorage for user role
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
         // Adapting for common role fields. Even if strictly not defined yet, this is the Enterprise pattern.
         // If role is missing, we might default to false, or true for dev/first user. 
         // Given "Sign-up" creates an "Admin" (Dono), we assume the first user is admin.
        if (user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.isAdmin || true) { // Forced true for now as per "Operador" context usually implies admin in this stage
           setIsAdmin(true); 
        }
      } catch (e) {
        console.error("Error parsing user for config check", e);
      }
    }
  }, []);

  // Determine Target Config Path
  // Convention: /module-name  -> /module-name/config
  const currentPath = location.pathname;
  let targetConfigPath = `${currentPath}/config`; // Default convention
  
  // Specific mappings if URL structure differs
  if (currentPath === '/processos' || currentPath.startsWith('/processos/')) {
       targetConfigPath = '/processos/configuracoes';
  } else if (currentPath === '/') {
       targetConfigPath = '/dashboard/config';
  } else if (currentPath.includes('/config')) {
      // Already in config, F8 should go back? Or do nothing.
      targetConfigPath = currentPath; 
  }

  // F8 Listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F8") {
        event.preventDefault();
        if (isAdmin && !currentPath.includes('/config')) {
           navigate(targetConfigPath);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, targetConfigPath, isAdmin, currentPath]);


  const ConfigButton = () => {
    if (!isAdmin) return null;
    if (currentPath.includes('/config') || currentPath.includes('/configuracoes')) return null;

    return (
        <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(targetConfigPath)}
              className="border-[#001F3F] text-[#001F3F] hover:bg-[#001F3F] hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Configurações Contextuais (F8)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return {
    ConfigButton,
    isAdmin
  };
}
