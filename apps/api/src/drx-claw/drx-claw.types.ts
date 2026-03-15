import { DrxSkill } from "./drx-skill.constants";

export type ProviderId =
  | "LOCAL"
  | "OLLAMA"
  | "LMSTUDIO"
  | "OPENAI"
  | "GEMINI"
  | "CLAUDE"
  | "GROQ"
  | "DEEPSEEK"
  | "OPENAI_COMPATIBLE";

export type ProviderModelOption = {
  id: string;
  label: string;
  source: "live" | "fallback" | "custom" | "selected";
  status: "stable" | "preview" | "alias" | "custom";
};

export type DrxClawConfig = {
  enabled: boolean;
  assistantName: string;
  companyLabel: string;
  provider: string;
  maxIterations: number;
  systemPrompt: string;
  telegramWhitelist: string[];
  local: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  openaiCompatible: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  apiKeys: {
    openai: string;
    gemini: string;
    deepseek: string;
    claude: string;
    groq: string;
  };
  customModels: Record<string, string[]>;
  playground: {
    temperature: number;
    maxTokens: number;
    lastPrompt: string;
    lastResponse: string;
    lastRunAt: string | null;
  };
  skills: DrxSkill[];
};
