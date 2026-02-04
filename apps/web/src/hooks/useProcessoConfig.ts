import { useState } from "react";

export function useProcessoConfig() {
  const [config, setConfig] = useState<any>({
    status_padrao: "ativo",
    auto_capture: true,
    ai_summary: true,
    ai_deadlines: true,
    whatsapp_notif: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveConfig = async (data: any) => {
    setIsSaving(true);
    console.log("Saving config:", data);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setConfig(data);
    setIsSaving(false);
  };

  return {
    config,
    isLoading,
    saveConfig,
    isSaving,
  };
}
